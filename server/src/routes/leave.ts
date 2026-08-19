import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isUniqueConstraintError, isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { HR_ROLES } from "../lib/roles";
import { notifyEmployee } from "../lib/notifications";

const router = Router();

// Leave data is HR-only: every route requires an admin or HR officer.
router.use(requireAuth, requireRole(...HR_ROLES));

const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Parses a YYYY-MM-DD string into a UTC midnight Date, so no timezone shifts the day. */
function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Working days between two dates inclusive, counting Monday to Friday only. */
function workingDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function decimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

class BalanceExceededError extends Error {
  constructor(
    readonly available: string,
    readonly requested: string,
  ) {
    super("Leave balance exceeded");
  }
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const requestInclude = {
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: true } },
  leaveType: { select: { id: true, name: true, code: true, paid: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.LeaveRequestInclude;

/* ------------------------------------------------------------------ *
 * Leave types
 * ------------------------------------------------------------------ */

router.get("/types", async (req, res) => {
  const includeInactive = req.query.includeInactive === "true";
  const leaveTypes = await prisma.leaveType.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
  res.json({ leaveTypes });
});

/** Statutory-ish starting set for Mauritius; entitlements stay editable afterwards. */
const DEFAULT_LEAVE_TYPES = [
  { code: "ANNUAL", name: "Annual Leave", daysPerYear: 22, paid: true, requiresDocs: false },
  { code: "SICK", name: "Sick Leave", daysPerYear: 15, paid: true, requiresDocs: true },
  { code: "MATERNITY", name: "Maternity Leave", daysPerYear: 98, paid: true, requiresDocs: true },
  { code: "PATERNITY", name: "Paternity Leave", daysPerYear: 5, paid: true, requiresDocs: true },
  { code: "UNPAID", name: "Unpaid Leave", daysPerYear: 0, paid: false, requiresDocs: false },
];

router.post("/types/seed-defaults", async (_req, res) => {
  const existing = await prisma.leaveType.count();
  if (existing > 0) {
    return res.status(409).json({ error: "Leave types already exist" });
  }
  await prisma.leaveType.createMany({ data: DEFAULT_LEAVE_TYPES });
  const leaveTypes = await prisma.leaveType.findMany({ orderBy: { name: "asc" } });
  res.status(201).json({ leaveTypes });
});

router.post("/types", async (req, res) => {
  const { code, name, daysPerYear, paid, requiresDocs } = req.body ?? {};

  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "Code is required" });
  }
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  const days = Number(daysPerYear);
  if (!Number.isFinite(days) || days < 0) {
    return res.status(400).json({ error: "Days per year must be zero or more" });
  }

  try {
    const leaveType = await prisma.leaveType.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        daysPerYear: decimal(days),
        paid: paid !== false,
        requiresDocs: requiresDocs === true,
      },
    });
    res.status(201).json({ leaveType });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "A leave type with that code or name already exists" });
    }
    throw err;
  }
});

router.patch("/types/:id", async (req, res) => {
  const id = req.params.id as string;
  const { code, name, daysPerYear, paid, requiresDocs, active } = req.body ?? {};

  const data: Prisma.LeaveTypeUpdateInput = {};
  if (typeof code === "string" && code.trim()) data.code = code.trim().toUpperCase();
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (daysPerYear !== undefined) {
    const days = Number(daysPerYear);
    if (!Number.isFinite(days) || days < 0) {
      return res.status(400).json({ error: "Days per year must be zero or more" });
    }
    data.daysPerYear = decimal(days);
  }
  if (paid !== undefined) data.paid = paid === true;
  if (requiresDocs !== undefined) data.requiresDocs = requiresDocs === true;
  if (active !== undefined) data.active = active === true;

  try {
    const leaveType = await prisma.leaveType.update({ where: { id }, data });
    res.json({ leaveType });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Leave type not found" });
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "A leave type with that code or name already exists" });
    }
    throw err;
  }
});

router.delete("/types/:id", async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.leaveType.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Leave type not found" });
    if (isForeignKeyConstraintError(err)) {
      return res
        .status(409)
        .json({ error: "This leave type is used by existing requests. Deactivate it instead." });
    }
    throw err;
  }
});

/* ------------------------------------------------------------------ *
 * Leave balances
 * ------------------------------------------------------------------ */

router.get("/balances", async (req, res) => {
  const year = Number(req.query.year) || new Date().getUTCFullYear();
  const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;

  const balances = await prisma.leaveBalance.findMany({
    where: { year, ...(employeeId ? { employeeId } : {}) },
    include: {
      leaveType: { select: { id: true, name: true, code: true, paid: true } },
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
    orderBy: [{ employee: { firstName: "asc" } }, { leaveType: { name: "asc" } }],
  });

  res.json({ balances });
});

/** Creates missing balance rows for every active employee and active leave type. */
router.post("/balances/initialize", async (req, res) => {
  const year = Number(req.body?.year) || new Date().getUTCFullYear();

  const [employees, leaveTypes] = await Promise.all([
    prisma.employee.findMany({ where: { employmentStatus: { not: "TERMINATED" } }, select: { id: true } }),
    prisma.leaveType.findMany({ where: { active: true } }),
  ]);

  if (leaveTypes.length === 0) {
    return res.status(400).json({ error: "Create at least one leave type first" });
  }

  const rows = employees.flatMap((employee) =>
    leaveTypes.map((type) => ({
      employeeId: employee.id,
      leaveTypeId: type.id,
      year,
      entitledDays: type.daysPerYear,
    })),
  );

  // skipDuplicates leaves already-adjusted balances untouched.
  const result = await prisma.leaveBalance.createMany({ data: rows, skipDuplicates: true });
  res.json({ created: result.count, year });
});

/** Sets entitlement/carry-over for one employee and leave type. */
router.post("/balances", async (req, res) => {
  const { employeeId, leaveTypeId, entitledDays, carriedOverDays } = req.body ?? {};
  const year = Number(req.body?.year) || new Date().getUTCFullYear();

  if (typeof employeeId !== "string" || typeof leaveTypeId !== "string") {
    return res.status(400).json({ error: "Employee and leave type are required" });
  }

  const entitled = Number(entitledDays);
  if (!Number.isFinite(entitled) || entitled < 0) {
    return res.status(400).json({ error: "Entitled days must be zero or more" });
  }

  const carried = carriedOverDays === undefined ? 0 : Number(carriedOverDays);
  if (!Number.isFinite(carried) || carried < 0) {
    return res.status(400).json({ error: "Carried-over days must be zero or more" });
  }

  try {
    const balance = await prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      create: {
        employeeId,
        leaveTypeId,
        year,
        entitledDays: decimal(entitled),
        carriedOverDays: decimal(carried),
      },
      update: { entitledDays: decimal(entitled), carriedOverDays: decimal(carried) },
      include: { leaveType: { select: { id: true, name: true, code: true, paid: true } } },
    });
    res.json({ balance });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) {
      return res.status(400).json({ error: "Unknown employee or leave type" });
    }
    throw err;
  }
});

/* ------------------------------------------------------------------ *
 * Leave requests
 * ------------------------------------------------------------------ */

router.get("/requests", async (req, res) => {
  const { status, employeeId, from, to } = req.query;

  const where: Prisma.LeaveRequestWhereInput = {};

  if (typeof status === "string" && (REQUEST_STATUSES as readonly string[]).includes(status)) {
    where.status = status as RequestStatus;
  }
  if (typeof employeeId === "string" && employeeId) {
    where.employeeId = employeeId;
  }

  // Any request overlapping the window, not just those fully inside it.
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (fromDate) where.endDate = { gte: fromDate };
  if (toDate) where.startDate = { lte: toDate };

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: requestInclude,
    orderBy: { startDate: "desc" },
  });

  res.json({ requests });
});

/** Suggests the working-day count for a range, so the UI can prefill it. */
router.get("/requests/working-days", (req, res) => {
  const start = parseDateOnly(req.query.startDate);
  const end = parseDateOnly(req.query.endDate);
  if (!start || !end || end < start) {
    return res.status(400).json({ error: "Provide a valid start and end date" });
  }
  res.json({ days: workingDaysBetween(start, end) });
});

router.get("/requests/:id", async (req, res) => {
  const request = await prisma.leaveRequest.findUnique({
    where: { id: req.params.id as string },
    include: requestInclude,
  });
  if (!request) return res.status(404).json({ error: "Leave request not found" });
  res.json({ request });
});

router.post("/requests", async (req, res) => {
  const { employeeId, leaveTypeId, reason, halfDay } = req.body ?? {};

  if (typeof employeeId !== "string" || !employeeId) {
    return res.status(400).json({ error: "Employee is required" });
  }
  if (typeof leaveTypeId !== "string" || !leaveTypeId) {
    return res.status(400).json({ error: "Leave type is required" });
  }

  const startDate = parseDateOnly(req.body?.startDate);
  const endDate = parseDateOnly(req.body?.endDate);
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Start and end dates are required" });
  }
  if (endDate < startDate) {
    return res.status(400).json({ error: "End date cannot be before the start date" });
  }

  const isHalfDay = halfDay === true;
  if (isHalfDay && startDate.getTime() !== endDate.getTime()) {
    return res.status(400).json({ error: "A half day must start and end on the same date" });
  }

  // The caller may override the computed figure (e.g. to exclude a public holiday).
  let days: number;
  if (req.body?.days !== undefined && req.body.days !== "") {
    days = Number(req.body.days);
    if (!Number.isFinite(days) || days <= 0) {
      return res.status(400).json({ error: "Days must be greater than zero" });
    }
  } else {
    days = isHalfDay ? 0.5 : workingDaysBetween(startDate, endDate);
  }

  if (days <= 0) {
    return res.status(400).json({ error: "That range contains no working days" });
  }

  const clash = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: { leaveType: { select: { name: true } } },
  });

  if (clash) {
    return res.status(409).json({
      error: `This overlaps an existing ${clash.status.toLowerCase()} ${clash.leaveType.name} request`,
    });
  }

  try {
    const request = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        days: decimal(days),
        halfDay: isHalfDay,
        reason: optionalString(reason),
        createdById: req.user?.sub ?? null,
      },
      include: requestInclude,
    });
    res.status(201).json({ request });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) {
      return res.status(400).json({ error: "Unknown employee or leave type" });
    }
    throw err;
  }
});

router.patch("/requests/:id", async (req, res) => {
  const id = req.params.id as string;
  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Leave request not found" });
  if (existing.status !== "PENDING") {
    return res.status(409).json({ error: "Only pending requests can be edited" });
  }

  const data: Prisma.LeaveRequestUpdateInput = {};

  const startDate = parseDateOnly(req.body?.startDate);
  const endDate = parseDateOnly(req.body?.endDate);
  const nextStart = startDate ?? existing.startDate;
  const nextEnd = endDate ?? existing.endDate;
  if (nextEnd < nextStart) {
    return res.status(400).json({ error: "End date cannot be before the start date" });
  }
  if (startDate) data.startDate = startDate;
  if (endDate) data.endDate = endDate;

  if (req.body?.halfDay !== undefined) data.halfDay = req.body.halfDay === true;
  if (req.body?.reason !== undefined) data.reason = optionalString(req.body.reason);
  if (typeof req.body?.leaveTypeId === "string" && req.body.leaveTypeId) {
    data.leaveType = { connect: { id: req.body.leaveTypeId } };
  }

  if (req.body?.days !== undefined && req.body.days !== "") {
    const days = Number(req.body.days);
    if (!Number.isFinite(days) || days <= 0) {
      return res.status(400).json({ error: "Days must be greater than zero" });
    }
    data.days = decimal(days);
  } else if (startDate || endDate) {
    data.days = decimal(workingDaysBetween(nextStart, nextEnd));
  }

  const clash = await prisma.leaveRequest.findFirst({
    where: {
      id: { not: id },
      employeeId: existing.employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: nextEnd },
      endDate: { gte: nextStart },
    },
  });
  if (clash) {
    return res.status(409).json({ error: "This overlaps another leave request for the same employee" });
  }

  const request = await prisma.leaveRequest.update({ where: { id }, data, include: requestInclude });
  res.json({ request });
});

/**
 * Approving consumes balance. Leave that straddles a year boundary is charged to
 * the year it starts in, which keeps one request tied to a single balance row.
 */
router.post("/requests/:id/approve", async (req, res) => {
  const id = req.params.id as string;
  const override = req.body?.override === true;
  const note = optionalString(req.body?.note);
  const reviewerId = req.user?.sub ?? null;

  const request = await prisma.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } });
  if (!request) return res.status(404).json({ error: "Leave request not found" });
  if (request.status !== "PENDING") {
    return res.status(409).json({ error: `Request is already ${request.status.toLowerCase()}` });
  }

  const year = request.startDate.getUTCFullYear();

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const balance = await tx.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
          },
        },
        create: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
          entitledDays: request.leaveType.daysPerYear,
        },
        update: {},
      });

      const available = balance.entitledDays.plus(balance.carriedOverDays).minus(balance.usedDays);

      if (request.days.greaterThan(available) && !override) {
        throw new BalanceExceededError(available.toFixed(2), request.days.toFixed(2));
      }

      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { usedDays: { increment: request.days } },
      });

      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewNote: note,
        },
        include: requestInclude,
      });
    });

    await syncEmploymentStatuses();
    await notifyEmployee(updated.employeeId, "LEAVE_REQUEST_APPROVED", `Your ${updated.leaveType.name} request was approved`, {
      link: "/dashboard/erp/hr/leave",
    });
    res.json({ request: updated });
  } catch (err) {
    if (err instanceof BalanceExceededError) {
      return res.status(409).json({
        error: `Only ${err.available} day(s) remaining but ${err.requested} requested. Approve anyway to allow a negative balance.`,
        code: "BALANCE_EXCEEDED",
        available: err.available,
        requested: err.requested,
      });
    }
    throw err;
  }
});

router.post("/requests/:id/reject", async (req, res) => {
  const id = req.params.id as string;
  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request) return res.status(404).json({ error: "Leave request not found" });
  if (request.status !== "PENDING") {
    return res.status(409).json({ error: `Request is already ${request.status.toLowerCase()}` });
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedById: req.user?.sub ?? null,
      reviewedAt: new Date(),
      reviewNote: optionalString(req.body?.note),
    },
    include: requestInclude,
  });

  await notifyEmployee(updated.employeeId, "LEAVE_REQUEST_REJECTED", `Your ${updated.leaveType.name} request was rejected`, {
    link: "/dashboard/erp/hr/leave",
  });
  res.json({ request: updated });
});

/** Cancelling an approved request hands the days back to the balance. */
router.post("/requests/:id/cancel", async (req, res) => {
  const id = req.params.id as string;
  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request) return res.status(404).json({ error: "Leave request not found" });
  if (request.status === "CANCELLED" || request.status === "REJECTED") {
    return res.status(409).json({ error: `Request is already ${request.status.toLowerCase()}` });
  }

  const wasApproved = request.status === "APPROVED";
  const year = request.startDate.getUTCFullYear();

  const updated = await prisma.$transaction(async (tx) => {
    if (wasApproved) {
      const balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
          },
        },
      });

      if (balance) {
        // Never let a refund push used days below zero.
        const refunded = balance.usedDays.minus(request.days);
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { usedDays: refunded.lessThan(0) ? decimal(0) : refunded },
        });
      }
    }

    return tx.leaveRequest.update({
      where: { id },
      data: {
        status: "CANCELLED",
        reviewedById: req.user?.sub ?? null,
        reviewedAt: new Date(),
        reviewNote: optionalString(req.body?.note),
      },
      include: requestInclude,
    });
  });

  await syncEmploymentStatuses();
  res.json({ request: updated });
});

router.delete("/requests/:id", async (req, res) => {
  const id = req.params.id as string;
  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request) return res.status(404).json({ error: "Leave request not found" });
  if (request.status === "APPROVED") {
    return res.status(409).json({ error: "Cancel the request first so the balance is returned" });
  }
  await prisma.leaveRequest.delete({ where: { id } });
  res.status(204).end();
});

/* ------------------------------------------------------------------ *
 * Status sync + summary
 * ------------------------------------------------------------------ */

/**
 * Flips employees between ACTIVE and ON_LEAVE based on approved leave covering
 * today. Terminated employees are never touched. Called after approvals and
 * cancellations, and on demand from the HR overview.
 */
async function syncEmploymentStatuses(): Promise<{ onLeave: number; returned: number }> {
  const today = todayUtc();

  const onLeaveToday = await prisma.leaveRequest.findMany({
    where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
    select: { employeeId: true },
  });

  const onLeaveIds = [...new Set(onLeaveToday.map((r) => r.employeeId))];

  const onLeave =
    onLeaveIds.length === 0
      ? { count: 0 }
      : await prisma.employee.updateMany({
          where: { id: { in: onLeaveIds }, employmentStatus: "ACTIVE" },
          data: { employmentStatus: "ON_LEAVE" },
        });

  const returned = await prisma.employee.updateMany({
    where: {
      employmentStatus: "ON_LEAVE",
      ...(onLeaveIds.length > 0 ? { id: { notIn: onLeaveIds } } : {}),
    },
    data: { employmentStatus: "ACTIVE" },
  });

  return { onLeave: onLeave.count, returned: returned.count };
}

router.post("/sync-statuses", async (_req, res) => {
  const result = await syncEmploymentStatuses();
  res.json(result);
});

router.get("/summary", async (_req, res) => {
  const today = todayUtc();
  const in30Days = new Date(today.getTime() + 30 * 86_400_000);

  const [pendingCount, onLeaveToday, upcoming] = await Promise.all([
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
      include: requestInclude,
      orderBy: { endDate: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { gt: today, lte: in30Days } },
      include: requestInclude,
      orderBy: { startDate: "asc" },
      take: 10,
    }),
  ]);

  res.json({ pendingCount, onLeaveToday, upcoming });
});

export default router;
