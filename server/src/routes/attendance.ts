import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { HR_ROLES, WORKFORCE_VIEW_ROLES } from "../lib/roles";

const router = Router();

// Editing attendance and the payroll-facing timesheet stay HR-only; the read-only day/summary
// views are also open to Operations Managers (Technet Workforce's "who's available today" view).
router.use(requireAuth);

const ATTENDANCE_STATUSES = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "ON_LEAVE",
  "PUBLIC_HOLIDAY",
  "REST_DAY",
] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** A full working day before overtime starts accruing. */
const STANDARD_DAY_HOURS = 8;

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Validates an "HH:MM" clock string and returns it, or null when absent. */
function parseClock(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function clockToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours as number) * 60 + (minutes as number);
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalEnum(value: unknown): AttendanceStatus | null {
  return typeof value === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(value)
    ? (value as AttendanceStatus)
    : null;
}

interface HoursResult {
  hoursWorked: Prisma.Decimal | null;
  overtimeHours: Prisma.Decimal;
  error?: string;
}

/**
 * Derives worked and overtime hours from the clock pair. An explicit
 * overtime value from the caller always wins, so HR can record agreed
 * overtime that does not match the raw clock times.
 */
function deriveHours(
  clockIn: string | null,
  clockOut: string | null,
  breakMinutes: number,
  explicitOvertime: unknown,
): HoursResult {
  const overtimeProvided =
    explicitOvertime !== undefined && explicitOvertime !== null && explicitOvertime !== "";
  const overtimeValue = overtimeProvided ? Number(explicitOvertime) : 0;

  if (overtimeProvided && (!Number.isFinite(overtimeValue) || overtimeValue < 0)) {
    return { hoursWorked: null, overtimeHours: new Prisma.Decimal(0), error: "Overtime must be zero or more" };
  }

  if (!clockIn || !clockOut) {
    return {
      hoursWorked: null,
      overtimeHours: new Prisma.Decimal(overtimeProvided ? overtimeValue : 0),
    };
  }

  const minutes = clockToMinutes(clockOut) - clockToMinutes(clockIn) - breakMinutes;
  if (clockToMinutes(clockOut) <= clockToMinutes(clockIn)) {
    return {
      hoursWorked: null,
      overtimeHours: new Prisma.Decimal(0),
      error: "Clock out must be later than clock in",
    };
  }
  if (minutes < 0) {
    return {
      hoursWorked: null,
      overtimeHours: new Prisma.Decimal(0),
      error: "Break is longer than the time between clock in and clock out",
    };
  }

  const hours = minutes / 60;
  const overtime = overtimeProvided ? overtimeValue : Math.max(0, hours - STANDARD_DAY_HOURS);

  return {
    hoursWorked: new Prisma.Decimal(hours.toFixed(2)),
    overtimeHours: new Prisma.Decimal(overtime.toFixed(2)),
  };
}

const recordInclude = {
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: true } },
} satisfies Prisma.AttendanceRecordInclude;

/* ------------------------------------------------------------------ *
 * Listing
 * ------------------------------------------------------------------ */

router.get("/", requireRole(...WORKFORCE_VIEW_ROLES), async (req, res) => {
  const { employeeId, status } = req.query;
  const from = parseDateOnly(req.query.from);
  const to = parseDateOnly(req.query.to);

  const where: Prisma.AttendanceRecordWhereInput = {};
  if (typeof employeeId === "string" && employeeId) where.employeeId = employeeId;

  const statusFilter = optionalEnum(status);
  if (statusFilter) where.status = statusFilter;

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: recordInclude,
    orderBy: [{ date: "desc" }, { employee: { firstName: "asc" } }],
  });

  res.json({ records });
});

/**
 * The roster for one day: every current employee, with the record already
 * saved for them or a sensible default. Weekends default to a rest day and
 * anyone on approved leave is pre-marked, so HR only edits the exceptions.
 */
router.get("/day", requireRole(...WORKFORCE_VIEW_ROLES), async (req, res) => {
  const date = parseDateOnly(req.query.date);
  if (!date) return res.status(400).json({ error: "A valid date is required" });

  const [employees, records, leave] = await Promise.all([
    prisma.employee.findMany({
      where: { employmentStatus: { not: "TERMINATED" } },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, department: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.attendanceRecord.findMany({ where: { date } }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: date }, endDate: { gte: date } },
      select: { employeeId: true, leaveType: { select: { name: true } } },
    }),
  ]);

  const recordByEmployee = new Map(records.map((r) => [r.employeeId, r]));
  const leaveByEmployee = new Map(leave.map((l) => [l.employeeId, l.leaveType.name]));
  const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;

  const roster = employees.map((employee) => {
    const record = recordByEmployee.get(employee.id) ?? null;
    const onLeave = leaveByEmployee.get(employee.id) ?? null;

    return {
      employee,
      record,
      onLeaveType: onLeave,
      suggestedStatus: record
        ? record.status
        : onLeave
          ? "ON_LEAVE"
          : isWeekend
            ? "REST_DAY"
            : "PRESENT",
    };
  });

  res.json({ date: req.query.date, isWeekend, roster });
});

router.get("/summary", requireRole(...WORKFORCE_VIEW_ROLES), async (req, res) => {
  const date = parseDateOnly(req.query.date) ?? parseDateOnly(new Date().toISOString().slice(0, 10))!;

  const [counts, headcount] = await Promise.all([
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { date }, _count: { _all: true } }),
    prisma.employee.count({ where: { employmentStatus: { not: "TERMINATED" } } }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of counts) byStatus[row.status] = row._count._all;

  const recorded = counts.reduce((sum, row) => sum + row._count._all, 0);

  res.json({ date: date.toISOString().slice(0, 10), headcount, recorded, byStatus });
});

/**
 * A month of attendance for one employee, with the totals a payroll run needs.
 */
router.get("/timesheet", requireRole(...HR_ROLES), async (req, res) => {
  const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : "";
  if (!employeeId) return res.status(400).json({ error: "An employee is required" });

  const year = Number(req.query.year);
  const month = Number(req.query.month); // 1-12
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "A valid year and month are required" });
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this one

  const [employee, records] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, position: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { employeeId, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
  ]);

  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const totals = records.reduce(
    (acc, record) => {
      acc.hours += record.hoursWorked ? record.hoursWorked.toNumber() : 0;
      acc.overtime += record.overtimeHours.toNumber();
      acc.byStatus[record.status] = (acc.byStatus[record.status] ?? 0) + 1;
      return acc;
    },
    { hours: 0, overtime: 0, byStatus: {} as Record<string, number> },
  );

  res.json({
    employee,
    year,
    month,
    daysInMonth: end.getUTCDate(),
    records,
    totals: {
      hours: Number(totals.hours.toFixed(2)),
      overtime: Number(totals.overtime.toFixed(2)),
      byStatus: totals.byStatus,
    },
  });
});

/* ------------------------------------------------------------------ *
 * Recording
 * ------------------------------------------------------------------ */

interface RecordPayload {
  employeeId: string;
  status: AttendanceStatus;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  hoursWorked: Prisma.Decimal | null;
  overtimeHours: Prisma.Decimal;
  note: string | null;
}

/** Shared validation for both the single and bulk write paths. */
function buildRecordPayload(input: Record<string, unknown>): RecordPayload | { error: string } {
  const employeeId = typeof input.employeeId === "string" ? input.employeeId : "";
  if (!employeeId) return { error: "An employee is required" };

  const status = optionalEnum(input.status) ?? "PRESENT";

  const clockIn = parseClock(input.clockIn);
  const clockOut = parseClock(input.clockOut);
  if (clockIn === undefined && input.clockIn !== undefined) {
    return { error: "Clock in must be in HH:MM format" };
  }
  if (clockOut === undefined && input.clockOut !== undefined) {
    return { error: "Clock out must be in HH:MM format" };
  }

  const breakMinutes =
    input.breakMinutes === undefined || input.breakMinutes === "" ? 0 : Number(input.breakMinutes);
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return { error: "Break minutes must be zero or more" };
  }

  const resolvedIn = clockIn ?? null;
  const resolvedOut = clockOut ?? null;

  // Non-working statuses never carry hours, whatever was typed in.
  if (status === "ABSENT" || status === "ON_LEAVE" || status === "REST_DAY" || status === "PUBLIC_HOLIDAY") {
    return {
      employeeId,
      status,
      clockIn: null,
      clockOut: null,
      breakMinutes: 0,
      hoursWorked: null,
      overtimeHours: new Prisma.Decimal(0),
      note: optionalString(input.note),
    };
  }

  const hours = deriveHours(resolvedIn, resolvedOut, breakMinutes, input.overtimeHours);
  if (hours.error) return { error: hours.error };

  return {
    employeeId,
    status,
    clockIn: resolvedIn,
    clockOut: resolvedOut,
    breakMinutes,
    hoursWorked: hours.hoursWorked,
    overtimeHours: hours.overtimeHours,
    note: optionalString(input.note),
  };
}

router.post("/", requireRole(...HR_ROLES), async (req, res) => {
  const date = parseDateOnly(req.body?.date);
  if (!date) return res.status(400).json({ error: "A valid date is required" });

  const payload = buildRecordPayload(req.body ?? {});
  if ("error" in payload) return res.status(400).json({ error: payload.error });

  const { employeeId, ...data } = payload;

  try {
    const record = await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: { employeeId, date, ...data, recordedById: req.user?.sub ?? null },
      update: { ...data, recordedById: req.user?.sub ?? null },
      include: recordInclude,
    });
    res.json({ record });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) {
      return res.status(400).json({ error: "Unknown employee" });
    }
    throw err;
  }
});

/** Saves a whole day's roster in one transaction. */
router.post("/bulk", requireRole(...HR_ROLES), async (req, res) => {
  const date = parseDateOnly(req.body?.date);
  if (!date) return res.status(400).json({ error: "A valid date is required" });

  const rows = Array.isArray(req.body?.records) ? req.body.records : null;
  if (!rows || rows.length === 0) {
    return res.status(400).json({ error: "No attendance records supplied" });
  }

  const payloads: RecordPayload[] = [];
  for (const row of rows) {
    const payload = buildRecordPayload(row ?? {});
    if ("error" in payload) {
      return res.status(400).json({ error: payload.error });
    }
    payloads.push(payload);
  }

  const recordedById = req.user?.sub ?? null;

  try {
    await prisma.$transaction(
      payloads.map(({ employeeId, ...data }) =>
        prisma.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId, date } },
          create: { employeeId, date, ...data, recordedById },
          update: { ...data, recordedById },
        }),
      ),
    );
  } catch (err) {
    if (isForeignKeyConstraintError(err)) {
      return res.status(400).json({ error: "One of the employees no longer exists" });
    }
    throw err;
  }

  const records = await prisma.attendanceRecord.findMany({
    where: { date },
    include: recordInclude,
    orderBy: { employee: { firstName: "asc" } },
  });

  res.json({ saved: payloads.length, records });
});

router.patch("/:id", requireRole(...HR_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const existing = await prisma.attendanceRecord.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Attendance record not found" });

  const payload = buildRecordPayload({
    employeeId: existing.employeeId,
    status: req.body?.status ?? existing.status,
    clockIn: req.body?.clockIn === undefined ? existing.clockIn : req.body.clockIn,
    clockOut: req.body?.clockOut === undefined ? existing.clockOut : req.body.clockOut,
    breakMinutes: req.body?.breakMinutes === undefined ? existing.breakMinutes : req.body.breakMinutes,
    overtimeHours: req.body?.overtimeHours,
    note: req.body?.note === undefined ? existing.note : req.body.note,
  });
  if ("error" in payload) return res.status(400).json({ error: payload.error });

  const { employeeId: _employeeId, ...data } = payload;

  const record = await prisma.attendanceRecord.update({
    where: { id },
    data: { ...data, recordedById: req.user?.sub ?? null },
    include: recordInclude,
  });

  res.json({ record });
});

router.delete("/:id", requireRole(...HR_ROLES), async (req, res) => {
  try {
    await prisma.attendanceRecord.delete({ where: { id: req.params.id as string } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Attendance record not found" });
    throw err;
  }
});

export default router;
