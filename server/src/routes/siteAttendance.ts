import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";

const router = Router();

router.use(requireAuth);

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };

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
      where: { workOrderId: null, checkOutAt: null },
      include: { employee: { select: EMPLOYEE_SELECT } },
      orderBy: { checkInAt: "desc" },
    }),
    prisma.siteAttendance.findMany({
      where: { workOrderId: null, checkInAt: { gte: start, lt: end } },
      include: { employee: { select: EMPLOYEE_SELECT } },
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
      where: { employeeId: employee.id, workOrderId: null, checkOutAt: null },
    }),
    prisma.siteAttendance.findMany({
      where: { employeeId: employee.id, workOrderId: null },
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
    where: { employeeId: employee.id, workOrderId: null, checkOutAt: null },
  });
  if (openVisit) return res.status(400).json({ error: "You are already checked in" });

  const siteAttendance = await prisma.siteAttendance.create({
    data: {
      employeeId: employee.id,
      checkInLat: coords.lat,
      checkInLng: coords.lng,
      checkInNote: note,
    },
  });
  res.status(201).json({ siteAttendance });
});

router.post("/check-out", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { employeeId: employee.id, workOrderId: null, checkOutAt: null },
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
  });
  res.json({ siteAttendance });
});

export default router;
