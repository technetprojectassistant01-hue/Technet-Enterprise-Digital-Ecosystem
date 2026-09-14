import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { HR_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { notifyEmployee } from "../lib/notifications";
import { dayToDate, mauritiusMonthRange } from "../lib/overtime";
import { buildAttendanceReport, dayOf, isStale, rangeFingerprint, todayInMauritius } from "../lib/attendanceReport";

/**
 * Attendance validation, done by Admin/HR at the end of each month (Technet Workforce →
 * Validations): for each employee with attendance that month, open the PDF and validate it. The
 * employee's attendance PDF (My Attendance → Export PDF) is marked DRAFT until a validation covers
 * the dates — and goes back to DRAFT if the attendance changes after it was validated (`stale`).
 * Employees don't request validation themselves (user decision, 2026-09-14).
 */
const router = Router();
router.use(requireAuth);

const DECIDER_SELECT = { select: { id: true, name: true, email: true } } as const;

function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** First and last Mauritius day of a "YYYY-MM" month. */
function monthDays(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** The validation row for exactly this employee and month, if any. */
function findMonthValidation(employeeId: string, month: string) {
  const { from, to } = monthDays(month);
  return prisma.attendanceValidation.findFirst({
    where: { employeeId, status: "VALIDATED", fromDate: dayToDate(from), toDate: dayToDate(to) },
    include: { decidedBy: DECIDER_SELECT },
    orderBy: { decidedAt: "desc" },
  });
}

// ---- The employee's own validated periods (for the export dialog) ---------------------------

router.get("/mine", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub }, select: { id: true } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });
  const rows = await prisma.attendanceValidation.findMany({
    where: { employeeId: employee.id, status: "VALIDATED" },
    orderBy: { fromDate: "desc" },
    take: 36,
  });
  const validations = await Promise.all(
    rows.map(async (row) => ({ id: row.id, fromDate: dayOf(row.fromDate), toDate: dayOf(row.toDate), stale: await isStale(row) })),
  );
  res.json({ validations });
});

// ---- Admin/HR: validate a month per employee ------------------------------------------------

router.use(requireRole(...HR_ROLES));

/** Everyone with attendance in the month (?month=YYYY-MM), with their validation state. */
router.get("/month", async (req, res) => {
  if (!isMonth(req.query.month)) return res.status(400).json({ error: "month (YYYY-MM) is required" });
  const month = req.query.month;
  const { start, end } = mauritiusMonthRange(month);

  const visits = await prisma.siteAttendance.findMany({
    where: { checkInAt: { gte: start, lt: end } },
    select: { employeeId: true, checkInAt: true },
  });
  const byEmployee = new Map<string, { checkIns: number; days: Set<string> }>();
  for (const v of visits) {
    const entry = byEmployee.get(v.employeeId) ?? { checkIns: 0, days: new Set<string>() };
    entry.checkIns += 1;
    entry.days.add(new Date(v.checkInAt.getTime() + 4 * 3_600_000).toISOString().slice(0, 10));
    byEmployee.set(v.employeeId, entry);
  }

  const employees = await prisma.employee.findMany({
    where: { id: { in: [...byEmployee.keys()] } },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const items = await Promise.all(
    employees.map(async (employee) => {
      const validation = await findMonthValidation(employee.id, month);
      const stale = validation ? await isStale(validation) : false;
      const stats = byEmployee.get(employee.id)!;
      return {
        employee,
        checkIns: stats.checkIns,
        daysPresent: stats.days.size,
        state: !validation ? "NOT_VALIDATED" : stale ? "CHANGED" : "VALIDATED",
        validatedAt: validation?.decidedAt ?? null,
        validatedBy: validation?.decidedBy ?? null,
      };
    }),
  );

  const { to } = monthDays(month);
  res.json({ month, monthEnded: to <= todayInMauritius(), items });
});

/** The employee's PDF for the month, as it prints right now. */
router.get("/month/pdf", async (req, res) => {
  const { employeeId, month } = req.query;
  if (typeof employeeId !== "string" || !isMonth(month)) return res.status(400).json({ error: "employeeId and month are required" });
  const { from, to } = monthDays(month);
  const report = await buildAttendanceReport(employeeId, from, to);
  if (!report) return res.status(404).json({ error: "Employee not found" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
  report.doc.pipe(res);
});

/**
 * Validates one employee's month (or re-validates it after a change). Only once the month's last
 * day has arrived — attendance mid-month is still being filled in. The fingerprint is taken now,
 * so the validation covers exactly what HR could see at this moment.
 */
async function validateMonth(employeeId: string, month: string, userId: string) {
  const { from, to } = monthDays(month);
  const fingerprint = await rangeFingerprint(employeeId, from, to);
  const existing = await findMonthValidation(employeeId, month);
  if (existing && existing.fingerprint === fingerprint) return { changed: false };
  if (existing) {
    await prisma.attendanceValidation.update({
      where: { id: existing.id },
      data: { fingerprint, decidedById: userId, decidedAt: new Date() },
    });
  } else {
    await prisma.attendanceValidation.create({
      data: { employeeId, fromDate: dayToDate(from), toDate: dayToDate(to), status: "VALIDATED", fingerprint, decidedById: userId, decidedAt: new Date() },
    });
  }
  await notifyEmployee(employeeId, "ATTENDANCE_VALIDATED", `Your attendance for ${monthLabel(month)} was validated`, {
    message: "You can now download it without the DRAFT mark.",
    link: "/dashboard",
  });
  return { changed: true };
}

function monthNotOver(month: string) {
  return monthDays(month).to > todayInMauritius();
}

router.post("/month/validate", async (req, res) => {
  const { employeeId, month } = req.body ?? {};
  if (typeof employeeId !== "string" || !isMonth(month)) return res.status(400).json({ error: "employeeId and month are required" });
  if (monthNotOver(month)) return res.status(400).json({ error: "A month can be validated from its last day" });
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  res.json(await validateMonth(employeeId, month, req.user!.sub));
});

/** Validates every employee with attendance in the month who isn't already validated (or has changed). */
router.post("/month/validate-all", async (req, res) => {
  const { month } = req.body ?? {};
  if (!isMonth(month)) return res.status(400).json({ error: "month (YYYY-MM) is required" });
  if (monthNotOver(month)) return res.status(400).json({ error: "A month can be validated from its last day" });
  const { start, end } = mauritiusMonthRange(month);
  const employeeIds = (
    await prisma.siteAttendance.findMany({ where: { checkInAt: { gte: start, lt: end } }, select: { employeeId: true }, distinct: ["employeeId"] })
  ).map((v) => v.employeeId);
  let validated = 0;
  for (const employeeId of employeeIds) {
    if ((await validateMonth(employeeId, month, req.user!.sub)).changed) validated += 1;
  }
  res.json({ validated });
});

/** Removes a month's validation, so the employee's PDF is DRAFT again. */
router.post("/month/unvalidate", async (req, res) => {
  const { employeeId, month } = req.body ?? {};
  if (typeof employeeId !== "string" || !isMonth(month)) return res.status(400).json({ error: "employeeId and month are required" });
  const { from, to } = monthDays(month);
  await prisma.attendanceValidation.deleteMany({ where: { employeeId, fromDate: dayToDate(from), toDate: dayToDate(to) } });
  res.status(204).end();
});

export default router;
