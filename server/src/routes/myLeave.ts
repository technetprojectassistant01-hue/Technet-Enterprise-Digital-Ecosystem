import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { HR_ROLES } from "../lib/roles";
import { notifyRoles } from "../lib/notifications";
import {
  parseDateOnly,
  holidaysBetween,
  leaveRequestInclude,
  LeaveValidationError,
  LeaveClashError,
  createLeaveRequestRecord,
  cancelLeaveRequestRecord,
  syncEmploymentStatuses,
} from "../lib/leaveRequests";
import { workingDaysBetween } from "../lib/workingDays";

const router = Router();

// Self-service leave: any authenticated staff member with a linked employee record can view
// their own balances/requests and submit or withdraw a request for themselves. No role
// restriction beyond that - taking leave isn't tied to any specific role. Contrast with
// leave.ts, which is the HR-only entry/approval side and stays untouched by this router.
router.use(requireAuth);

/** Resolves the caller's own Employee record, or responds 403 if their account isn't linked to one. */
async function requireLinkedEmployee(req: Request, res: Response) {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) {
    res.status(403).json({ error: "No employee record is linked to your account" });
    return null;
  }
  return employee;
}

router.get("/leave-types", async (_req, res) => {
  const leaveTypes = await prisma.leaveType.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  res.json({ leaveTypes });
});

router.get("/balances", async (req, res) => {
  const employee = await requireLinkedEmployee(req, res);
  if (!employee) return;

  const year = Number(req.query.year) || new Date().getUTCFullYear();
  const balances = await prisma.leaveBalance.findMany({
    where: { employeeId: employee.id, year },
    include: { leaveType: { select: { id: true, name: true, code: true, paid: true } } },
    orderBy: { leaveType: { name: "asc" } },
  });
  res.json({ balances });
});

router.get("/requests", async (req, res) => {
  const employee = await requireLinkedEmployee(req, res);
  if (!employee) return;

  const requests = await prisma.leaveRequest.findMany({
    where: { employeeId: employee.id },
    include: leaveRequestInclude,
    orderBy: { startDate: "desc" },
  });
  res.json({ requests });
});

router.get("/requests/working-days", async (req, res) => {
  const start = parseDateOnly(req.query.startDate);
  const end = parseDateOnly(req.query.endDate);
  if (!start || !end || end < start) {
    return res.status(400).json({ error: "Provide a valid start and end date" });
  }
  const holidays = await holidaysBetween(start, end);
  res.json({ days: workingDaysBetween(start, end, holidays) });
});

router.post("/requests", async (req, res) => {
  const employee = await requireLinkedEmployee(req, res);
  if (!employee) return;

  const { leaveTypeId, reason, halfDay, startDate, endDate, days } = req.body ?? {};

  try {
    const request = await createLeaveRequestRecord({
      employeeId: employee.id,
      leaveTypeId,
      startDateRaw: startDate,
      endDateRaw: endDate,
      halfDayRaw: halfDay,
      reasonRaw: reason,
      daysRaw: days,
      createdById: req.user!.sub,
    });
    await notifyRoles(
      HR_ROLES,
      "LEAVE_REQUEST_SUBMITTED",
      `${employee.firstName} ${employee.lastName} requested ${request.leaveType.name}`,
      { link: "/dashboard/erp/hr/leave" },
    );
    res.status(201).json({ request });
  } catch (err) {
    if (err instanceof LeaveValidationError) return res.status(err.status).json({ error: err.message });
    if (err instanceof LeaveClashError) return res.status(409).json({ error: err.message });
    throw err;
  }
});

router.post("/requests/:id/cancel", async (req, res) => {
  const employee = await requireLinkedEmployee(req, res);
  if (!employee) return;

  const id = req.params.id as string;
  const result = await cancelLeaveRequestRecord(id, {
    reviewerId: req.user!.sub,
    note: null,
    restrictToEmployeeId: employee.id,
  });
  if (result.error === "not_found") return res.status(404).json({ error: "Leave request not found" });
  if (result.error === "already_final") {
    return res.status(409).json({ error: `Request is already ${result.status.toLowerCase()}` });
  }

  await syncEmploymentStatuses();
  res.json({ request: result.request });
});

export default router;
