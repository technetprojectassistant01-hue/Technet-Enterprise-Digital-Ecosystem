import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ATTENDANCE_VIEW_ROLES, HR_ROLES } from "../lib/roles";
import { loadAbsences } from "../lib/absences";
import { isDay, parseRange } from "../lib/attendanceReport";
import { dayToDate } from "../lib/overtime";

/**
 * Absences (2026-10-01): technicians with no check-in on a working day, absent until they check in
 * (lib/absences.ts). Readable by everyone who reads the attendance register; HR (and Admin)
 * excuse a day with a note, or undo that.
 */
const router = Router();
router.use(requireAuth);

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, employeeCode: true } as const;

/** Absences in ?from=&to= (Mauritius days, inclusive), optionally for one ?employeeId=. */
router.get("/", requireRole(...ATTENDANCE_VIEW_ROLES), async (req, res) => {
  const range = parseRange(req.query.from, req.query.to);
  if ("error" in range) return res.status(400).json({ error: range.error });
  const employeeId = typeof req.query.employeeId === "string" && req.query.employeeId ? req.query.employeeId : undefined;

  const absences = await loadAbsences(range.from, range.to, employeeId);
  const employees = await prisma.employee.findMany({
    where: { id: { in: [...new Set(absences.map((a) => a.employeeId))] } },
    select: EMPLOYEE_SELECT,
  });
  const byId = new Map(employees.map((e) => [e.id, e]));
  res.json({ absences: absences.map((a) => ({ ...a, employee: byId.get(a.employeeId) ?? null })) });
});

/** Excuses one day ({ employeeId, date, note }) - e.g. sick, or sent to work elsewhere. */
router.post("/excuse", requireRole(...HR_ROLES), async (req, res) => {
  const { employeeId, date, note } = req.body ?? {};
  if (typeof employeeId !== "string" || !isDay(date)) return res.status(400).json({ error: "employeeId and date (YYYY-MM-DD) are required" });
  const text = typeof note === "string" ? note.trim().slice(0, 300) : "";
  if (!text) return res.status(400).json({ error: "Say why the absence is excused" });
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const excuse = await prisma.absenceExcuse.upsert({
    where: { employeeId_date: { employeeId, date: dayToDate(date) } },
    create: { employeeId, date: dayToDate(date), note: text, excusedById: req.user!.sub },
    update: { note: text, excusedById: req.user!.sub },
  });
  res.json({ excuse });
});

/** Undoes an excuse - the day shows as Absent again (unless there is a check-in). */
router.delete("/excuse", requireRole(...HR_ROLES), async (req, res) => {
  const { employeeId, date } = req.query;
  if (typeof employeeId !== "string" || !isDay(date)) return res.status(400).json({ error: "employeeId and date (YYYY-MM-DD) are required" });
  await prisma.absenceExcuse.deleteMany({ where: { employeeId, date: dayToDate(date) } });
  res.status(204).end();
});

export default router;
