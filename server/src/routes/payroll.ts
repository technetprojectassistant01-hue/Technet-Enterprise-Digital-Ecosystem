import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { computeNetPay } from "../lib/payroll";
import { HR_ROLES } from "../lib/roles";

const router = Router();

const EMPLOYEE_SELECT = { id: true, employeeCode: true, firstName: true, lastName: true, position: true };
const CREATED_BY_SELECT = { id: true, name: true, email: true };

router.use(requireAuth);
router.use(requireRole(...HR_ROLES));

router.get("/", async (_req, res) => {
  const runs = await prisma.payrollRun.findMany({
    include: { createdBy: { select: CREATED_BY_SELECT }, lines: { select: { netPay: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  res.json({
    runs: runs.map((r) => ({
      id: r.id,
      year: r.year,
      month: r.month,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      employeeCount: r.lines.length,
      totalNetPay: r.lines.reduce((sum, l) => sum + l.netPay.toNumber(), 0),
    })),
  });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      createdBy: { select: CREATED_BY_SELECT },
      lines: { include: { employee: { select: EMPLOYEE_SELECT } }, orderBy: { netPay: "desc" } },
    },
  });
  if (!run) return res.status(404).json({ error: "Payroll run not found" });
  res.json({ run });
});

router.post("/process", async (req, res) => {
  const { year, month } = req.body ?? {};

  if (!Number.isInteger(year) || year < 2000) {
    return res.status(400).json({ error: "A valid year is required" });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "A valid month (1-12) is required" });
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const daysInMonth = end.getUTCDate();

  const employees = await prisma.employee.findMany({
    where: { employmentStatus: { not: "TERMINATED" }, basicSalary: { not: null } },
    select: { id: true, basicSalary: true },
  });

  if (employees.length === 0) {
    return res.status(400).json({ error: "No employees have a basic salary set yet" });
  }

  const lines = await Promise.all(
    employees.map(async (employee) => {
      const [records, leaveRequests] = await Promise.all([
        prisma.attendanceRecord.findMany({
          where: { employeeId: employee.id, date: { gte: start, lte: end } },
          select: { hoursWorked: true, overtimeHours: true },
        }),
        prisma.leaveRequest.findMany({
          where: {
            employeeId: employee.id,
            status: "APPROVED",
            startDate: { lte: end },
            endDate: { gte: start },
            leaveType: { paid: false },
          },
          select: { days: true },
        }),
      ]);

      const hoursWorked = records.reduce((sum, r) => sum + (r.hoursWorked ? r.hoursWorked.toNumber() : 0), 0);
      const overtimeHours = records.reduce((sum, r) => sum + r.overtimeHours.toNumber(), 0);
      const unpaidLeaveDays = leaveRequests.reduce((sum, r) => sum + r.days.toNumber(), 0);
      const basicSalary = employee.basicSalary!.toNumber();
      const { deduction, netPay } = computeNetPay(basicSalary, unpaidLeaveDays, daysInMonth);

      return {
        employeeId: employee.id,
        basicSalary,
        hoursWorked: Number(hoursWorked.toFixed(2)),
        overtimeHours: Number(overtimeHours.toFixed(2)),
        unpaidLeaveDays: Number(unpaidLeaveDays.toFixed(2)),
        deduction,
        netPay,
      };
    }),
  );

  try {
    const run = await prisma.payrollRun.create({
      data: {
        year,
        month,
        createdById: req.user!.sub,
        lines: { create: lines },
      },
      include: {
        createdBy: { select: CREATED_BY_SELECT },
        lines: { include: { employee: { select: EMPLOYEE_SELECT } }, orderBy: { netPay: "desc" } },
      },
    });
    res.status(201).json({ run });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "A payroll run for that period already exists. Delete it first to reprocess." });
    }
    throw err;
  }
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.payrollRun.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Payroll run not found" });
    throw err;
  }
});

export default router;
