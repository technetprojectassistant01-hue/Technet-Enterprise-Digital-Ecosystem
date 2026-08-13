import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { distanceMeters, SITE_GEOFENCE_RADIUS_METERS } from "../lib/geo";

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

/** The work order this employee is actively on right now, if any — used to auto-link and geofence daily check-in. */
async function findCurrentWorkOrder(employeeId: string) {
  const inProgress = await prisma.workOrder.findFirst({
    where: { status: "IN_PROGRESS", technicians: { some: { employeeId } } },
    orderBy: { updatedAt: "desc" },
  });
  if (inProgress) return inProgress;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  return prisma.workOrder.findFirst({
    where: {
      status: "SCHEDULED",
      technicians: { some: { employeeId } },
      scheduledDate: { gte: todayStart, lt: todayEnd },
    },
    orderBy: { scheduledDate: "asc" },
  });
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

  const [current, history] = await Promise.all([
    prisma.siteAttendance.findMany({
      where: { checkOutAt: null },
      include: { employee: { select: EMPLOYEE_SELECT }, workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE },
      orderBy: { checkInAt: "desc" },
    }),
    prisma.siteAttendance.findMany({
      where: { checkInAt: { gte: start, lt: end } },
      include: { employee: { select: EMPLOYEE_SELECT }, workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE },
      orderBy: { checkInAt: "desc" },
    }),
  ]);

  res.json({ current, history });
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

  const currentWorkOrder = await findCurrentWorkOrder(employee.id);
  if (currentWorkOrder?.siteLat != null && currentWorkOrder.siteLng != null) {
    const distance = distanceMeters(coords.lat, coords.lng, Number(currentWorkOrder.siteLat), Number(currentWorkOrder.siteLng));
    if (distance > SITE_GEOFENCE_RADIUS_METERS) {
      return res.status(400).json({
        error: `You're about ${Math.round(distance)}m from the assigned site — check-in requires being within ${SITE_GEOFENCE_RADIUS_METERS}m.`,
      });
    }
  }

  const siteAttendance = await prisma.siteAttendance.create({
    data: {
      employeeId: employee.id,
      workOrderId: currentWorkOrder?.id ?? null,
      checkInLat: coords.lat,
      checkInLng: coords.lng,
      checkInNote: note,
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

  const pendingExit = await prisma.siteVerification.findFirst({
    where: { siteAttendanceId: openVisit.id, status: "OUTSIDE_SITE", exitReason: null },
    orderBy: { checkedAt: "desc" },
  });
  if (!pendingExit) return res.status(404).json({ error: "No unexplained site departure to update" });

  const verification = await prisma.siteVerification.update({
    where: { id: pendingExit.id },
    data: {
      exitReason: reason as ExitReason,
      exitReasonNote: typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null,
    },
  });
  res.json({ verification });
});

export default router;
