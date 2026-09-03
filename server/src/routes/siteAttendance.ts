import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { distanceMeters, SITE_GEOFENCE_RADIUS_METERS } from "../lib/geo";
import { notifyEmployee } from "../lib/notifications";
import { parseClockTime } from "../lib/clockTime";
import { checkLocationAgainstGps } from "../lib/locationMatch";

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

/** Upper bound on a single leg's travel cost - a sanity guard against a fat-fingered entry, not a policy. */
const MAX_TRANSPORT_COST = 100_000;

/**
 * Travel cost for one leg, in MUR. Absent/blank is a valid answer ("if applicable"), so this
 * returns a tri-state: `{ value }` for a usable number including none, `{ error }` for junk.
 * Accepts a numeric string as well as a number - the form sends `e.target.value`, and
 * `Number.isFinite("250")` is false, which is exactly how the quotation payment-terms percentage
 * silently failed every real submission once already (CLAUDE.md §9). The client converts too;
 * this is the belt to that pair of braces.
 */
export function parseTransportCost(value: unknown): { value: number | null } | { error: string } {
  if (value === undefined || value === null || value === "") return { value: null };
  const amount = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return { error: "Transport cost must be a number" };
  }
  if (amount < 0) return { error: "Transport cost cannot be negative" };
  if (amount > MAX_TRANSPORT_COST) return { error: `Transport cost looks wrong - keep it under ${MAX_TRANSPORT_COST}` };
  return { value: Math.round(amount * 100) / 100 };
}

/** The typed arrival/departure time. Optional, but rejected outright if present and unparseable. */
export function parseDeclaredTime(value: unknown): { value: string | null } | { error: string } {
  if (value === undefined || value === null || value === "") return { value: null };
  const parsed = parseClockTime(value);
  if (!parsed) return { error: "Time must be in HH:MM format" };
  return { value: parsed };
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

/** Parses "YYYY-MM-DD" to UTC midnight - same convention as every other filter in this codebase. */
function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * An explicit from/to day range wins over `month` when both days are supplied. A week is the
 * point of this - and a week regularly straddles a month boundary, which the month-only version
 * could never express. `to` is inclusive of that whole day, so the exclusive end is the next
 * midnight. Falls back to the month behaviour so existing callers are unaffected.
 */
function reportRange(query: Record<string, unknown>): { start: Date; end: Date } {
  const from = parseDateOnly(query.from);
  const to = parseDateOnly(query.to);
  if (from && to && to >= from) {
    return { start: from, end: new Date(to.getTime() + 24 * 60 * 60 * 1000) };
  }
  return monthRange(query.month);
}

/** Team-wide view for managers: who's checked in right now, plus the given month's history (defaults to this month). */
router.get("/", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const { start, end } = reportRange(req.query as Record<string, unknown>);
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
      totalTransportCost: number;
      locationMismatchCount: number;
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
        totalTransportCost: 0,
        locationMismatchCount: 0,
      });
    }
    const entry = summaryByEmployee.get(key)!;
    entry.days.add(v.checkInAt.toISOString().slice(0, 10));
    entry.totalCheckIns += 1;
    // Both legs of the trip. Decimal columns come back as Prisma.Decimal, hence the Number().
    entry.totalTransportCost += Number(v.checkInTransportCost ?? 0) + Number(v.checkOutTransportCost ?? 0);
    if (v.checkOutAt) {
      entry.totalHoursOnSite += (v.checkOutAt.getTime() - v.checkInAt.getTime()) / 3_600_000;
    }
    // Only outright mismatches are counted. UNCHECKABLE is the ordinary result for text like
    // "Office" and carries no meaning, so folding it in here would make honest weeks look bad.
    if (v.checkInLocationMatch === "MISMATCH") entry.locationMismatchCount += 1;
    if (v.checkOutLocationMatch === "MISMATCH") entry.locationMismatchCount += 1;
  }
  const summary = Array.from(summaryByEmployee.values())
    .map((s) => ({
      employee: s.employee,
      daysPresent: s.days.size,
      totalCheckIns: s.totalCheckIns,
      totalHoursOnSite: Math.round(s.totalHoursOnSite * 10) / 10,
      totalTransportCost: Math.round(s.totalTransportCost * 100) / 100,
      locationMismatchCount: s.locationMismatchCount,
    }))
    .sort((a, b) => b.daysPresent - a.daysPresent);

  res.json({ current, history, summary });
});

// A supervisor-triggered nudge, not a live remote GPS ping: it asks the technician to open the
// app, and the widget then verifies on mount. True push-to-device would need new infrastructure
// (a push subscription); this reuses the existing notification system for a cheap, honest version.
// The message deliberately doesn't mention location - the technician's own widget no longer
// surfaces the tracking back at them, so telling them to "verify your location" here would
// reintroduce exactly what that change removed.
router.post("/:id/request-verification", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const session = await prisma.siteAttendance.findUnique({ where: { id }, select: { employeeId: true, checkOutAt: true } });
  if (!session) return res.status(404).json({ error: "Site attendance session not found" });
  if (session.checkOutAt) return res.status(400).json({ error: "This technician has already checked out" });

  await notifyEmployee(session.employeeId, "LOCATION_CHECK_REQUESTED", "Your supervisor asked you to open the app", {
    message: "Please open My Attendance on the dashboard.",
    link: "/dashboard",
  });
  res.json({ ok: true });
});

/**
 * Closes a session the technician forgot to check out of.
 *
 * Deliberately records no coordinates: nobody observed where they were, and writing a position
 * nobody captured would put a fabricated location into the record this system exists to be
 * trusted on. `checkOutByManager` keeps an administrative close from reading as a real one.
 *
 * `checkOutAt` is optional and exists because "now" is usually the wrong answer - a session left
 * open since last week would otherwise book a 163-hour visit into that month's hours. A manager
 * who knows the technician actually left at 17:00 on the 27th can say so.
 */
router.post("/:id/close", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { checkOutAt, note } = req.body ?? {};

  const session = await prisma.siteAttendance.findUnique({
    where: { id },
    select: { id: true, checkInAt: true, checkOutAt: true },
  });
  if (!session) return res.status(404).json({ error: "Site attendance session not found" });
  if (session.checkOutAt) return res.status(400).json({ error: "This session is already closed" });

  let closedAt = new Date();
  if (checkOutAt !== undefined && checkOutAt !== null && checkOutAt !== "") {
    const parsed = new Date(checkOutAt);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: "Provide a valid check-out date and time" });
    }
    if (parsed <= session.checkInAt) {
      return res.status(400).json({ error: "Check-out must be after the check-in" });
    }
    if (parsed.getTime() > Date.now() + 60_000) {
      return res.status(400).json({ error: "Check-out cannot be in the future" });
    }
    closedAt = parsed;
  }

  const siteAttendance = await prisma.siteAttendance.update({
    where: { id },
    data: {
      checkOutAt: closedAt,
      checkOutByManager: true,
      checkOutNote: typeof note === "string" && note.trim() ? note.trim().slice(0, 200) : "Closed by management",
    },
    include: { employee: { select: EMPLOYEE_SELECT }, workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE },
  });
  res.json({ siteAttendance });
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
  if (!note) return res.status(400).json({ error: "A location is required to check in" });

  const declaredTime = parseDeclaredTime((req.body as { timeIn?: unknown })?.timeIn);
  if ("error" in declaredTime) return res.status(400).json({ error: declaredTime.error });
  const transportCost = parseTransportCost((req.body as { transportCost?: unknown })?.transportCost);
  if ("error" in transportCost) return res.status(400).json({ error: transportCost.error });

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { employeeId: employee.id, checkOutAt: null },
  });
  if (openVisit) return res.status(400).json({ error: "You are already checked in" });

  // Advisory only, and it never blocks: a technician checks in successfully whatever this says.
  const locationCheck = await checkLocationAgainstGps(note, coords);

  const siteAttendance = await prisma.siteAttendance.create({
    data: {
      employeeId: employee.id,
      checkInLat: coords.lat,
      checkInLng: coords.lng,
      checkInNote: note,
      checkInDeclaredTime: declaredTime.value,
      checkInTransportCost: transportCost.value,
      checkInLocationMatch: locationCheck.match,
      checkInLocationDistanceMeters: locationCheck.distanceMeters,
    },
    include: { workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE },
  });
  res.status(201).json({ siteAttendance });
});

router.post("/check-out", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });

  const declaredTime = parseDeclaredTime((req.body as { timeOut?: unknown })?.timeOut);
  if ("error" in declaredTime) return res.status(400).json({ error: declaredTime.error });
  const transportCost = parseTransportCost((req.body as { transportCost?: unknown })?.transportCost);
  if ("error" in transportCost) return res.status(400).json({ error: transportCost.error });

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { employeeId: employee.id, checkOutAt: null },
  });
  if (!openVisit) return res.status(404).json({ error: "You are not currently checked in" });

  const checkOutNote = parseNote(req.body);
  const locationCheck = await checkLocationAgainstGps(checkOutNote, coords);

  const siteAttendance = await prisma.siteAttendance.update({
    where: { id: openVisit.id },
    data: {
      checkOutAt: new Date(),
      checkOutLat: coords.lat,
      checkOutLng: coords.lng,
      checkOutNote,
      checkOutDeclaredTime: declaredTime.value,
      checkOutTransportCost: transportCost.value,
      checkOutLocationMatch: locationCheck.match,
      checkOutLocationDistanceMeters: locationCheck.distanceMeters,
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
