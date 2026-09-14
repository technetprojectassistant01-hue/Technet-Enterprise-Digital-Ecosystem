import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { HR_ROLES } from "../lib/roles";
import { notifyEmployee } from "../lib/notifications";
import {
  MAURITIUS_OFFSET_MINUTES,
  computeOvertimeDays,
  dayToDate,
  mauritiusMonthRange,
} from "../lib/overtime";

/**
 * Overtime approval for HR (and Admin). Overtime is calculated from site attendance against the
 * standard hours; each day with overtime is pending until HR approves or rejects it. Only approved
 * overtime appears on the technician's own My Attendance (siteAttendance.ts /me/history).
 */
const router = Router();
router.use(requireAuth);
router.use(requireRole(...HR_ROLES));

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, employeeCode: true };
const VISIT_SELECT = {
  employeeId: true,
  checkInAt: true,
  checkInDeclaredTime: true,
  checkOutAt: true,
  checkOutDeclaredTime: true,
} as const;

function currentMauritiusMonth(): string {
  return new Date(Date.now() + MAURITIUS_OFFSET_MINUTES * 60_000).toISOString().slice(0, 7);
}

function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dayToDate(value).getTime());
}

/** Recomputes one employee's overtime for one Mauritius day from their attendance. */
async function overtimeFor(employeeId: string, day: string) {
  const start = new Date(dayToDate(day).getTime() - MAURITIUS_OFFSET_MINUTES * 60_000);
  const end = new Date(start.getTime() + 86_400_000);
  const visits = await prisma.siteAttendance.findMany({
    where: { employeeId, checkInAt: { gte: start, lt: end } },
    select: VISIT_SELECT,
  });
  return computeOvertimeDays(visits).find((d) => d.date === day) ?? null;
}

/** Every overtime day in a month (?month=YYYY-MM), with HR's decision if there is one. */
router.get("/", async (req, res) => {
  const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : currentMauritiusMonth();
  const { start, end } = mauritiusMonthRange(month);

  const [visits, decisions] = await Promise.all([
    prisma.siteAttendance.findMany({ where: { checkInAt: { gte: start, lt: end } }, select: VISIT_SELECT }),
    prisma.overtimeDecision.findMany({
      where: { date: { gte: dayToDate(`${month}-01`), lt: new Date(end.getTime() + MAURITIUS_OFFSET_MINUTES * 60_000) } },
      include: { decidedBy: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const days = computeOvertimeDays(visits);
  const decisionByKey = new Map(decisions.map((d) => [`${d.employeeId}|${d.date.toISOString().slice(0, 10)}`, d]));

  const employeeIds = [...new Set([...days.map((d) => d.employeeId), ...decisions.map((d) => d.employeeId)])];
  const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: EMPLOYEE_SELECT });
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const items = days.map((d) => {
    const key = `${d.employeeId}|${d.date}`;
    const decision = decisionByKey.get(key) ?? null;
    decisionByKey.delete(key);
    return { ...d, employee: employeeById.get(d.employeeId) ?? null, status: decision?.status ?? "PENDING", decision };
  });
  // A decision whose overtime no longer calculates (attendance was corrected) still shows, so HR can see it.
  for (const decision of decisionByKey.values()) {
    const date = decision.date.toISOString().slice(0, 10);
    items.push({
      employeeId: decision.employeeId,
      date,
      minutes: 0,
      firstIn: "",
      lastOut: "",
      employee: employeeById.get(decision.employeeId) ?? null,
      status: decision.status,
      decision,
    });
  }
  items.sort((a, b) => (a.date === b.date ? 0 : b.date.localeCompare(a.date)));

  res.json({ month, items });
});

/** Approves or rejects one employee's overtime for one day. Minutes are recalculated here, not trusted from the client. */
router.post("/decide", async (req, res) => {
  const { employeeId, date, approve, note } = req.body ?? {};
  if (typeof employeeId !== "string" || !employeeId || !isDay(date) || typeof approve !== "boolean") {
    return res.status(400).json({ error: "employeeId, date (YYYY-MM-DD) and approve are required" });
  }

  const day = await overtimeFor(employeeId, date);
  if (!day) return res.status(409).json({ error: "There is no overtime to decide for that day" });

  const status = approve ? "APPROVED" : "REJECTED";
  const cleanNote = typeof note === "string" && note.trim() ? note.trim() : null;
  const decision = await prisma.overtimeDecision.upsert({
    where: { employeeId_date: { employeeId, date: dayToDate(date) } },
    create: { employeeId, date: dayToDate(date), minutes: day.minutes, status, note: cleanNote, decidedById: req.user!.sub },
    update: { minutes: day.minutes, status, note: cleanNote, decidedById: req.user!.sub, decidedAt: new Date() },
  });

  const hours = `${Math.floor(day.minutes / 60)}h ${day.minutes % 60}m`;
  await notifyEmployee(
    employeeId,
    approve ? "OVERTIME_APPROVED" : "OVERTIME_REJECTED",
    approve ? `Your overtime on ${date} (${hours}) was approved` : `Your overtime on ${date} (${hours}) was not approved`,
    { message: cleanNote ?? undefined, link: "/dashboard" },
  );

  res.json({ decision });
});

/** Clears a decision so the day goes back to pending. */
router.delete("/:employeeId/:date", async (req, res) => {
  const { employeeId, date } = req.params as { employeeId: string; date: string };
  if (!isDay(date)) return res.status(400).json({ error: "Invalid date" });
  await prisma.overtimeDecision.deleteMany({ where: { employeeId, date: dayToDate(date) } });
  res.status(204).end();
});

export default router;
