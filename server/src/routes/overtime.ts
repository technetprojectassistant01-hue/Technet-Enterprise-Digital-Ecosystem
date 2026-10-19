import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { HR_ROLES } from "../lib/roles";
import { notifyEmployee } from "../lib/notifications";
import {
  MAURITIUS_OFFSET_MINUTES,
  computeOvertimeDays,
  dayToDate,
  mauritiusDay,
  mauritiusMonthRange,
} from "../lib/overtime";
import { overtimeForDay } from "../lib/overtimeQueue";
import { findExcessiveOvertimeDays, findInvertedSessions, findOverlappingSessions } from "../lib/attendanceDataIssues";
import { payWarnings } from "../lib/attendanceSummary";
import { todayInMauritius } from "../lib/attendanceReport";
import { parseOvertimeRecord } from "../lib/overtimeRecords";

/**
 * Overtime approval for HR (and Admin). Overtime is calculated from site attendance against the
 * standard hours; each day with overtime is pending until HR approves or rejects it. Only approved
 * overtime appears on the technician's own My Attendance (siteAttendance.ts /me/history).
 * HR can also type an overtime record in by hand (POST /records, lib/overtimeRecords.ts), which
 * replaces that day's calculated overtime.
 */
const router = Router();
router.use(requireAuth);
router.use(requireRole(...HR_ROLES));

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, employeeCode: true };
const VISIT_SELECT = {
  id: true,
  employeeId: true,
  checkInAt: true,
  checkInDeclaredTime: true,
  checkOutAt: true,
  checkOutDeclaredTime: true,
} as const;
const SESSION_SELECT = { id: true, employeeId: true, checkInAt: true, checkOutAt: true } as const;

function currentMauritiusMonth(): string {
  return new Date(Date.now() + MAURITIUS_OFFSET_MINUTES * 60_000).toISOString().slice(0, 7);
}

function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dayToDate(value).getTime());
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

  // Spec section 6: approving overtime on a day with open or confirmed anomalies gets a warning
  // (never a block). Counted per employee per Mauritius day of the visit's check-in.
  const anomalyRows = await prisma.attendanceAnomaly.findMany({
    where: { status: { in: ["OPEN", "CONFIRMED_VIOLATION"] }, siteAttendance: { checkInAt: { gte: start, lt: end } } },
    select: { employeeId: true, siteAttendance: { select: { checkInAt: true } } },
  });
  const anomalyCountByKey = new Map<string, number>();
  for (const a of anomalyRows) {
    if (!a.siteAttendance) continue;
    const key = `${a.employeeId}|${mauritiusDay(a.siteAttendance.checkInAt)}`;
    anomalyCountByKey.set(key, (anomalyCountByKey.get(key) ?? 0) + 1);
  }

  // A visit open over 12 hours (checked out late, often the next morning) overstates overtime -
  // warn before approval, never block (2026-10-03: 24h+ days were approved this way in September).
  const longVisitByKey = new Map<string, number>();
  for (const w of payWarnings(visits, [], [])) {
    const key = `${w.employeeId}|${w.day}`;
    longVisitByKey.set(key, Math.max(longVisitByKey.get(key) ?? 0, w.openMinutes));
  }

  const items = days.map((d) => {
    const key = `${d.employeeId}|${d.date}`;
    const decision = decisionByKey.get(key) ?? null;
    decisionByKey.delete(key);
    return {
      ...d,
      employee: employeeById.get(d.employeeId) ?? null,
      status: decision?.status ?? "PENDING",
      decision,
      anomalyCount: anomalyCountByKey.get(key) ?? 0,
      longVisitMinutes: longVisitByKey.get(key) ?? null,
    };
  });
  // A decision whose overtime no longer calculates (attendance was corrected) still shows, so HR can
  // see it - as does a manual record on a day the app calculated no overtime for (minutes stays 0:
  // it is the *calculated* figure).
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
      anomalyCount: anomalyCountByKey.get(`${decision.employeeId}|${date}`) ?? 0,
      longVisitMinutes: longVisitByKey.get(`${decision.employeeId}|${date}`) ?? null,
    });
  }
  items.sort((a, b) => (a.date === b.date ? 0 : b.date.localeCompare(a.date)));

  res.json({ month, items });
});

/**
 * All-time data-integrity report: sessions with an impossible check-out, sessions that overlap
 * for the same employee, and overtime days over 12 hours - almost always a missed check-out or
 * a data-entry mistake, never a real attendance state. Read-only: nothing here is changed
 * automatically, and an already-approved OvertimeDecision is untouched even if its day also shows
 * up as excessive. HR reads this and corrects records by hand if they judge it necessary.
 */
router.get("/data-issues", async (req, res) => {
  const [sessions, overtimeVisits] = await Promise.all([
    prisma.siteAttendance.findMany({ select: SESSION_SELECT, orderBy: { checkInAt: "asc" } }),
    prisma.siteAttendance.findMany({ select: VISIT_SELECT }),
  ]);

  const inverted = findInvertedSessions(sessions);
  const overlapping = findOverlappingSessions(sessions);
  const excessiveOvertime = findExcessiveOvertimeDays(computeOvertimeDays(overtimeVisits));

  const employeeIds = [
    ...new Set([
      ...inverted.map((s) => s.employeeId),
      ...overlapping.map((p) => p.first.employeeId),
      ...excessiveOvertime.map((d) => d.employeeId),
    ]),
  ];
  const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: EMPLOYEE_SELECT });
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  res.json({
    inverted: inverted.map((s) => ({ ...s, employee: employeeById.get(s.employeeId) ?? null })),
    overlapping: overlapping.map((p) => ({
      employeeId: p.first.employeeId,
      employee: employeeById.get(p.first.employeeId) ?? null,
      first: p.first,
      second: p.second,
    })),
    excessiveOvertime: excessiveOvertime.map((d) => ({ ...d, employee: employeeById.get(d.employeeId) ?? null })),
  });
});

/** Approves or rejects one employee's overtime for one day. Minutes are recalculated here, not trusted from the client. */
router.post("/decide", async (req, res) => {
  const { employeeId, date, approve, note } = req.body ?? {};
  if (typeof employeeId !== "string" || !employeeId || !isDay(date) || typeof approve !== "boolean") {
    return res.status(400).json({ error: "employeeId, date (YYYY-MM-DD) and approve are required" });
  }

  const existing = await prisma.overtimeDecision.findUnique({
    where: { employeeId_date: { employeeId, date: dayToDate(date) } },
    select: { manual: true },
  });
  if (existing?.manual) {
    return res.status(409).json({ error: "This day has a manual overtime record. Edit or delete the record instead." });
  }

  const day = await overtimeForDay(employeeId, date);
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

/**
 * Saves a manual overtime record (AiFace "Overtime Records"): HR types the type, start, end and
 * reason, and is stored as the approver. It replaces whatever was on that employee-day - a pending
 * calculated figure, an earlier decision or an earlier record (the user's choice, 2026-10-19:
 * "replace that day's overtime", so the same hours are never counted twice).
 */
router.post("/records", async (req, res) => {
  const parsed = parseOvertimeRecord(req.body, todayInMauritius());
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const r = parsed.value;

  const employee = await prisma.employee.findUnique({ where: { id: r.employeeId }, select: { id: true } });
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const fields = {
    minutes: r.minutes,
    status: "APPROVED" as const,
    note: r.reason,
    manual: true,
    type: r.type,
    startTime: r.startTime,
    endTime: r.endTime,
    decidedById: req.user!.sub,
  };
  const decision = await prisma.overtimeDecision.upsert({
    where: { employeeId_date: { employeeId: r.employeeId, date: dayToDate(r.date) } },
    create: { employeeId: r.employeeId, date: dayToDate(r.date), ...fields },
    update: { ...fields, decidedAt: new Date() },
  });

  const hours = `${Math.floor(r.minutes / 60)}h ${r.minutes % 60}m`;
  await notifyEmployee(employee.id, "OVERTIME_APPROVED", `Overtime recorded for you on ${r.date} (${hours})`, {
    message: `${r.startTime} → ${r.endTime}: ${r.reason}`,
    link: "/dashboard",
  });

  res.status(201).json({ decision });
});

/** Clears a decision (or deletes a manual record) so the day goes back to its calculated overtime, pending. */
router.delete("/:employeeId/:date", async (req, res) => {
  const { employeeId, date } = req.params as { employeeId: string; date: string };
  if (!isDay(date)) return res.status(400).json({ error: "Invalid date" });
  await prisma.overtimeDecision.deleteMany({ where: { employeeId, date: dayToDate(date) } });
  res.status(204).end();
});

export default router;
