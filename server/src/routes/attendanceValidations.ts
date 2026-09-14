import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { HR_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { notifyEmployee, notifyRoles } from "../lib/notifications";
import { dayToDate } from "../lib/overtime";
import { buildAttendanceReport, dayOf, isStale, parseRange, rangeFingerprint, todayInMauritius } from "../lib/attendanceReport";

/**
 * Attendance validation. An employee asks Admin/HR to validate their attendance for a date range
 * (My Attendance → Export PDF); Admin/HR review it on Technet Workforce → Validations and validate
 * or reject it. The attendance PDF prints as DRAFT until a validation covers the range — and goes
 * back to DRAFT if the attendance changes after it was validated (`stale`).
 */
const router = Router();
router.use(requireAuth);

const DECIDER_SELECT = { select: { id: true, name: true, email: true } } as const;

type ValidationRow = Awaited<ReturnType<typeof prisma.attendanceValidation.findMany>>[number];

/** The shape the client gets: days as "YYYY-MM-DD", plus whether a validated range has since changed. */
async function present<T extends ValidationRow>(row: T) {
  return {
    ...row,
    fromDate: dayOf(row.fromDate),
    toDate: dayOf(row.toDate),
    fingerprint: undefined,
    stale: row.status === "VALIDATED" ? await isStale(row) : false,
  };
}

function rangeLabel(from: string, to: string) {
  return from === to ? from : `${from} to ${to}`;
}

// ---- The employee's own requests ------------------------------------------------------------

async function ownEmployee(userId: string) {
  return prisma.employee.findUnique({ where: { userId }, select: { id: true, firstName: true, lastName: true } });
}

router.get("/mine", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const employee = await ownEmployee(req.user!.sub);
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });
  const rows = await prisma.attendanceValidation.findMany({
    where: { employeeId: employee.id },
    include: { decidedBy: DECIDER_SELECT },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });
  res.json({ validations: await Promise.all(rows.map(present)) });
});

router.post("/mine", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const employee = await ownEmployee(req.user!.sub);
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const range = parseRange(req.body?.from, req.body?.to);
  if ("error" in range) return res.status(400).json({ error: range.error });
  if (range.to > todayInMauritius()) return res.status(400).json({ error: "You can't ask to validate days that haven't happened yet" });

  const pending = await prisma.attendanceValidation.findFirst({
    where: { employeeId: employee.id, status: "PENDING", fromDate: dayToDate(range.from), toDate: dayToDate(range.to) },
  });
  if (pending) return res.status(409).json({ error: "You've already asked for this range to be validated" });

  const covering = await prisma.attendanceValidation.findMany({
    where: { employeeId: employee.id, status: "VALIDATED", fromDate: { lte: dayToDate(range.from) }, toDate: { gte: dayToDate(range.to) } },
  });
  for (const c of covering) {
    if (!(await isStale(c))) return res.status(409).json({ error: "This range is already validated" });
  }

  const created = await prisma.attendanceValidation.create({
    data: { employeeId: employee.id, fromDate: dayToDate(range.from), toDate: dayToDate(range.to) },
    include: { decidedBy: DECIDER_SELECT },
  });
  await notifyRoles(HR_ROLES, "ATTENDANCE_VALIDATION_REQUESTED", `${employee.firstName} ${employee.lastName} asked to validate their attendance`, {
    message: rangeLabel(range.from, range.to),
    link: "/dashboard/workforce/validations",
  });
  res.status(201).json({ validation: await present(created) });
});

/** Withdraws a pending request or clears a rejected one. A validated request stays on record. */
router.delete("/mine/:id", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const employee = await ownEmployee(req.user!.sub);
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });
  const { count } = await prisma.attendanceValidation.deleteMany({
    where: { id: req.params.id as string, employeeId: employee.id, status: { in: ["PENDING", "REJECTED"] } },
  });
  if (count === 0) return res.status(404).json({ error: "Request not found, or it has already been validated" });
  res.status(204).end();
});

// ---- Admin/HR review ------------------------------------------------------------------------

const EMPLOYEE_SELECT = { select: { id: true, firstName: true, lastName: true, employeeCode: true } } as const;

router.get("/", requireRole(...HR_ROLES), async (req, res) => {
  const status = req.query.status;
  const where = status === "PENDING" || status === "VALIDATED" || status === "REJECTED" ? { status: status as typeof status } : {};
  const rows = await prisma.attendanceValidation.findMany({
    where,
    include: { decidedBy: DECIDER_SELECT, employee: EMPLOYEE_SELECT },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });
  res.json({ validations: await Promise.all(rows.map(present)) });
});

/** The report for a request, as it prints right now — so HR can check it before deciding. */
router.get("/:id/pdf", requireRole(...HR_ROLES), async (req, res) => {
  const row = await prisma.attendanceValidation.findUnique({ where: { id: req.params.id as string } });
  if (!row) return res.status(404).json({ error: "Validation request not found" });
  const report = await buildAttendanceReport(row.employeeId, dayOf(row.fromDate), dayOf(row.toDate));
  if (!report) return res.status(404).json({ error: "Employee not found" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
  report.doc.pipe(res);
});

/**
 * Validates a request, or re-validates one whose attendance changed since. The fingerprint of the
 * range is taken now, so the validation covers exactly what HR could see at this moment.
 */
router.post("/:id/validate", requireRole(...HR_ROLES), async (req, res) => {
  const row = await prisma.attendanceValidation.findUnique({ where: { id: req.params.id as string } });
  if (!row) return res.status(404).json({ error: "Validation request not found" });
  if (row.status === "VALIDATED" && !(await isStale(row))) return res.status(409).json({ error: "This request is already validated" });

  const from = dayOf(row.fromDate);
  const to = dayOf(row.toDate);
  const validation = await prisma.attendanceValidation.update({
    where: { id: row.id },
    data: {
      status: "VALIDATED",
      fingerprint: await rangeFingerprint(row.employeeId, from, to),
      note: null,
      decidedById: req.user!.sub,
      decidedAt: new Date(),
    },
    include: { decidedBy: DECIDER_SELECT, employee: EMPLOYEE_SELECT },
  });
  await notifyEmployee(row.employeeId, "ATTENDANCE_VALIDATED", `Your attendance for ${rangeLabel(from, to)} was validated`, {
    message: "You can now download it without the DRAFT mark.",
    link: "/dashboard",
  });
  res.json({ validation: await present(validation) });
});

router.post("/:id/reject", requireRole(...HR_ROLES), async (req, res) => {
  const row = await prisma.attendanceValidation.findUnique({ where: { id: req.params.id as string } });
  if (!row) return res.status(404).json({ error: "Validation request not found" });
  const note = typeof req.body?.note === "string" && req.body.note.trim() ? req.body.note.trim().slice(0, 500) : null;

  const validation = await prisma.attendanceValidation.update({
    where: { id: row.id },
    data: { status: "REJECTED", fingerprint: null, note, decidedById: req.user!.sub, decidedAt: new Date() },
    include: { decidedBy: DECIDER_SELECT, employee: EMPLOYEE_SELECT },
  });
  await notifyEmployee(
    row.employeeId,
    "ATTENDANCE_VALIDATION_REJECTED",
    `Your attendance for ${rangeLabel(dayOf(row.fromDate), dayOf(row.toDate))} was not validated`,
    { message: note ?? undefined, link: "/dashboard" },
  );
  res.json({ validation: await present(validation) });
});

/** Undoes a decision: back to pending. */
router.post("/:id/reopen", requireRole(...HR_ROLES), async (req, res) => {
  const row = await prisma.attendanceValidation.findUnique({ where: { id: req.params.id as string } });
  if (!row) return res.status(404).json({ error: "Validation request not found" });
  const validation = await prisma.attendanceValidation.update({
    where: { id: row.id },
    data: { status: "PENDING", fingerprint: null, note: null, decidedById: null, decidedAt: null },
    include: { decidedBy: DECIDER_SELECT, employee: EMPLOYEE_SELECT },
  });
  res.json({ validation: await present(validation) });
});

export default router;
