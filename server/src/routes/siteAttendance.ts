import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { distanceMeters, SITE_GEOFENCE_RADIUS_METERS } from "../lib/geo";
import { notifyEmployee } from "../lib/notifications";

const router = Router();

router.use(requireAuth);

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };
const WORK_ORDER_SUMMARY_SELECT = {
  select: { id: true, workOrderNumber: true, title: true, siteLat: true, siteLng: true },
} as const;
const VERIFICATIONS_INCLUDE = { orderBy: { checkedAt: "desc" as const } };

const EXIT_REASONS = ["MATERIALS", "ANOTHER_SITE", "SUPERVISOR_INSTRUCTION", "EMERGENCY", "OTHER"] as const;
type ExitReason = (typeof EXIT_REASONS)[number];

function parseCoords(body: unknown): { lat: number; lng: number } | null {
  const { lat, lng } = (body as { lat?: unknown; lng?: unknown }) ?? {};
  if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
  if (typeof lng !== "number" || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function parseNote(body: unknown): string | null {
  const note = (body as { note?: unknown } | null)?.note;
  return typeof note === "string" && note.trim() ? note.trim().slice(0, 200) : null;
}

/**
 * Among several same-day candidate work orders for one technician, prefers whichever's site is
 * physically closest to where they're actually checking in — recency alone can pick the wrong job
 * (e.g. an earlier job left open) and silently geofence against the wrong site all day.
 */
function pickClosestBySite<T extends { siteLat: unknown; siteLng: unknown }>(
  candidates: T[],
  coords?: { lat: number; lng: number } | null,
): T | null {
  if (!coords) return null;
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (candidate.siteLat == null || candidate.siteLng == null) continue;
    const distance = distanceMeters(coords.lat, coords.lng, Number(candidate.siteLat), Number(candidate.siteLng));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** The work order this employee is actively on right now, if any — used to auto-link and geofence daily check-in. */
async function findCurrentWorkOrder(employeeId: string, coords?: { lat: number; lng: number } | null) {
  const inProgress = await prisma.workOrder.findMany({
    where: { status: { in: ["IN_PROGRESS", "WAITING_FOR_PARTS"] }, technicians: { some: { employeeId } } },
    orderBy: { updatedAt: "desc" },
  });
  if (inProgress.length > 0) {
    return pickClosestBySite(inProgress, coords) ?? inProgress[0];
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const scheduledToday = await prisma.workOrder.findMany({
    where: {
      status: "SCHEDULED",
      technicians: { some: { employeeId } },
      scheduledDate: { gte: todayStart, lt: todayEnd },
    },
    orderBy: { scheduledDate: "asc" },
  });
  if (scheduledToday.length === 0) return null;
  return pickClosestBySite(scheduledToday, coords) ?? scheduledToday[0];
}

/** [start, end) bounds for a "YYYY-MM" month string, falling back to the current UTC month. */
function monthRange(value: unknown): { start: Date; end: Date } {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  const now = new Date();
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end };
}

/** Team-wide view for managers: who's checked in right now, plus the given month's history (defaults to this month). */
router.get("/", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const { start, end } = monthRange(req.query.month);
  const { employeeId } = req.query;
  const employeeFilter = typeof employeeId === "string" && employeeId ? { employeeId } : {};

  const [current, history] = await Promise.all([
    prisma.siteAttendance.findMany({
      where: { checkOutAt: null, ...employeeFilter },
      include: { employee: { select: EMPLOYEE_SELECT }, workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE },
      orderBy: { checkInAt: "desc" },
    }),
    prisma.siteAttendance.findMany({
      where: { checkInAt: { gte: start, lt: end }, ...employeeFilter },
      include: { employee: { select: EMPLOYEE_SELECT }, workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE },
      orderBy: { checkInAt: "desc" },
    }),
  ]);

  // Per-technician roll-up for the month, built from the same `history` rows rather than a
  // separate query - keeps "days present" (distinct calendar days) and the on-site/outside-site
  // verification trust counters right next to the register that already has this data.
  const summaryByEmployee = new Map<
    string,
    {
      employee: (typeof history)[number]["employee"];
      days: Set<string>;
      totalCheckIns: number;
      totalHoursOnSite: number;
      onSiteCount: number;
      outsideSiteCount: number;
    }
  >();
  for (const v of history) {
    if (!v.employee) continue;
    const key = v.employeeId;
    if (!summaryByEmployee.has(key)) {
      summaryByEmployee.set(key, {
        employee: v.employee,
        days: new Set(),
        totalCheckIns: 0,
        totalHoursOnSite: 0,
        onSiteCount: 0,
        outsideSiteCount: 0,
      });
    }
    const entry = summaryByEmployee.get(key)!;
    entry.days.add(v.checkInAt.toISOString().slice(0, 10));
    entry.totalCheckIns += 1;
    if (v.checkOutAt) {
      entry.totalHoursOnSite += (v.checkOutAt.getTime() - v.checkInAt.getTime()) / 3_600_000;
    }
    for (const verification of v.verifications) {
      if (verification.status === "ON_SITE") entry.onSiteCount += 1;
      else if (verification.status === "OUTSIDE_SITE") entry.outsideSiteCount += 1;
    }
  }
  const summary = Array.from(summaryByEmployee.values())
    .map((s) => ({
      employee: s.employee,
      daysPresent: s.days.size,
      totalCheckIns: s.totalCheckIns,
      totalHoursOnSite: Math.round(s.totalHoursOnSite * 10) / 10,
      onSiteCount: s.onSiteCount,
      outsideSiteCount: s.outsideSiteCount,
    }))
    .sort((a, b) => b.daysPresent - a.daysPresent);

  res.json({ current, history, summary });
});

// A supervisor-triggered nudge, not a live remote GPS ping: notifies the technician to open the
// app and tap "Verify My Location" themselves. True push-to-device would need new infrastructure
// (a push subscription); this reuses the existing notification system for a cheap, honest version.
router.post("/:id/request-verification", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const session = await prisma.siteAttendance.findUnique({ where: { id }, select: { employeeId: true, checkOutAt: true } });
  if (!session) return res.status(404).json({ error: "Site attendance session not found" });
  if (session.checkOutAt) return res.status(400).json({ error: "This technician has already checked out" });

  await notifyEmployee(session.employeeId, "LOCATION_CHECK_REQUESTED", "A supervisor asked you to verify your location", {
    message: "Open My Attendance and tap Verify My Location.",
    link: "/dashboard",
  });
  res.json({ ok: true });
});

router.get("/me", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const [current, history] = await Promise.all([
    prisma.siteAttendance.findFirst({
      where: { employeeId: employee.id, checkOutAt: null },
      include: { workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE },
    }),
    prisma.siteAttendance.findMany({
      where: { employeeId: employee.id },
      include: { workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE },
      orderBy: { checkInAt: "desc" },
      take: 10,
    }),
  ]);

  res.json({ current, history });
});

router.post("/check-in", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });
  const note = parseNote(req.body);
  if (!note) return res.status(400).json({ error: "A location note is required to check in" });

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { employeeId: employee.id, checkOutAt: null },
  });
  if (openVisit) return res.status(400).json({ error: "You are already checked in" });

  // Site location is resolved from a typed address, which is only ever approximate — being far
  // from it is recorded and shown to managers, never used to block a technician from working.
  const currentWorkOrder = await findCurrentWorkOrder(employee.id, coords);
  const initialVerification =
    currentWorkOrder?.siteLat != null && currentWorkOrder.siteLng != null
      ? (() => {
          const distance = distanceMeters(coords.lat, coords.lng, Number(currentWorkOrder.siteLat), Number(currentWorkOrder.siteLng));
          return {
            lat: coords.lat,
            lng: coords.lng,
            distanceMeters: Math.round(distance),
            status: distance <= SITE_GEOFENCE_RADIUS_METERS ? ("ON_SITE" as const) : ("OUTSIDE_SITE" as const),
          };
        })()
      : null;

  const siteAttendance = await prisma.siteAttendance.create({
    data: {
      employeeId: employee.id,
      workOrderId: currentWorkOrder?.id ?? null,
      checkInLat: coords.lat,
      checkInLng: coords.lng,
      checkInNote: note,
      verifications: initialVerification ? { create: initialVerification } : undefined,
    },
    include: { workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE },
  });
  res.status(201).json({ siteAttendance });
});

router.post("/check-out", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { employeeId: employee.id, checkOutAt: null },
  });
  if (!openVisit) return res.status(404).json({ error: "You are not currently checked in" });

  const siteAttendance = await prisma.siteAttendance.update({
    where: { id: openVisit.id },
    data: {
      checkOutAt: new Date(),
      checkOutLat: coords.lat,
      checkOutLng: coords.lng,
      checkOutNote: parseNote(req.body),
    },
    include: { workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE },
  });
  res.json({ siteAttendance });
});

/** A periodic (not continuous) re-check of the technician's location while checked in and linked to a work order. */
router.post("/verify-location", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { employeeId: employee.id, checkOutAt: null },
    include: { workOrder: true },
  });
  if (!openVisit) return res.status(404).json({ error: "You are not currently checked in" });

  if (openVisit.workOrder?.siteLat == null || openVisit.workOrder.siteLng == null) {
    return res.json({ skipped: true });
  }

  const distance = distanceMeters(
    coords.lat,
    coords.lng,
    Number(openVisit.workOrder.siteLat),
    Number(openVisit.workOrder.siteLng),
  );
  const verification = await prisma.siteVerification.create({
    data: {
      siteAttendanceId: openVisit.id,
      lat: coords.lat,
      lng: coords.lng,
      distanceMeters: Math.round(distance),
      status: distance <= SITE_GEOFENCE_RADIUS_METERS ? "ON_SITE" : "OUTSIDE_SITE",
    },
  });
  res.status(201).json({ verification });
});

router.post("/exit-reason", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const { reason, note } = req.body ?? {};
  if (typeof reason !== "string" || !EXIT_REASONS.includes(reason as ExitReason)) {
    return res.status(400).json({ error: "A valid reason is required" });
  }

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { employeeId: employee.id, checkOutAt: null },
  });
  if (!openVisit) return res.status(404).json({ error: "You are not currently checked in" });

  const recentChecks = await prisma.siteVerification.findMany({
    where: { siteAttendanceId: openVisit.id },
    orderBy: { checkedAt: "desc" },
  });
  // One reason covers the whole current excursion: every consecutive unexplained OUTSIDE_SITE
  // check back to the last ON_SITE check (or the start), not just the single latest row — a
  // technician away for 30+ minutes can miss several 10-minute periodic checks before explaining.
  const pendingIds: string[] = [];
  for (const check of recentChecks) {
    if (check.status !== "OUTSIDE_SITE" || check.exitReason) break;
    pendingIds.push(check.id);
  }
  if (pendingIds.length === 0) return res.status(404).json({ error: "No unexplained site departure to update" });

  const exitReasonNote = typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null;
  await prisma.siteVerification.updateMany({
    where: { id: { in: pendingIds } },
    data: { exitReason: reason as ExitReason, exitReasonNote },
  });
  const verification = await prisma.siteVerification.findUniqueOrThrow({ where: { id: pendingIds[0] } });
  res.json({ verification });
});

export default router;
