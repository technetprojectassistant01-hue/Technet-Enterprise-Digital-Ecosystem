import { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";
import { workingDaysBetween } from "./workingDays";

/** Parses a YYYY-MM-DD string into a UTC midnight Date, so no timezone shifts the day. */
export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function decimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** The set of public holiday dates (as "YYYY-MM-DD") falling within [start, end], for excluding from working-day counts. */
export async function holidaysBetween(start: Date, end: Date): Promise<Set<string>> {
  const holidays = await prisma.publicHoliday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true },
  });
  return new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
}

export const leaveRequestInclude = {
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: true } },
  leaveType: { select: { id: true, name: true, code: true, paid: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.LeaveRequestInclude;

export class LeaveValidationError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
  }
}

export class LeaveClashError extends Error {
  constructor(
    readonly clashStatus: string,
    readonly clashTypeName: string,
  ) {
    super(`This overlaps an existing ${clashStatus.toLowerCase()} ${clashTypeName} request`);
  }
}

export interface CreateLeaveRequestParams {
  employeeId: string;
  leaveTypeId: unknown;
  startDateRaw: unknown;
  endDateRaw: unknown;
  halfDayRaw: unknown;
  reasonRaw: unknown;
  daysRaw: unknown;
  createdById: string | null;
}

/**
 * Validates + creates a LeaveRequest, shared between the HR-entry route (leave.ts) and the
 * self-service route (myLeave.ts). Throws LeaveValidationError for bad input and LeaveClashError
 * when the range overlaps an existing PENDING/APPROVED request for the same employee - callers
 * map these to their own response shape.
 */
export async function createLeaveRequestRecord(params: CreateLeaveRequestParams) {
  const { employeeId, leaveTypeId, startDateRaw, endDateRaw, halfDayRaw, reasonRaw, daysRaw, createdById } = params;

  if (typeof leaveTypeId !== "string" || !leaveTypeId) {
    throw new LeaveValidationError("Leave type is required");
  }

  const startDate = parseDateOnly(startDateRaw);
  const endDate = parseDateOnly(endDateRaw);
  if (!startDate || !endDate) {
    throw new LeaveValidationError("Start and end dates are required");
  }
  if (endDate < startDate) {
    throw new LeaveValidationError("End date cannot be before the start date");
  }

  const isHalfDay = halfDayRaw === true;
  if (isHalfDay && startDate.getTime() !== endDate.getTime()) {
    throw new LeaveValidationError("A half day must start and end on the same date");
  }

  // The caller may override the computed figure (e.g. to exclude a public holiday).
  let days: number;
  if (daysRaw !== undefined && daysRaw !== "") {
    days = Number(daysRaw);
    if (!Number.isFinite(days) || days <= 0) {
      throw new LeaveValidationError("Days must be greater than zero");
    }
  } else {
    days = isHalfDay ? 0.5 : workingDaysBetween(startDate, endDate, await holidaysBetween(startDate, endDate));
  }

  if (days <= 0) {
    throw new LeaveValidationError("That range contains no working days");
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
    throw new LeaveClashError(clash.status, clash.leaveType.name);
  }

  const reason = typeof reasonRaw === "string" && reasonRaw.trim() ? reasonRaw.trim() : null;

  return prisma.leaveRequest.create({
    data: {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      days: decimal(days),
      halfDay: isHalfDay,
      reason,
      createdById,
    },
    include: leaveRequestInclude,
  });
}

export interface CancelLeaveRequestOptions {
  reviewerId: string | null;
  note: string | null;
  /** If set, the request must belong to this employee or the cancel is refused as not-found. */
  restrictToEmployeeId?: string;
}

/** Cancelling an approved request hands the days back to the balance. */
export async function cancelLeaveRequestRecord(id: string, opts: CancelLeaveRequestOptions) {
  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request || (opts.restrictToEmployeeId && request.employeeId !== opts.restrictToEmployeeId)) {
    return { error: "not_found" as const };
  }
  if (request.status === "CANCELLED" || request.status === "REJECTED") {
    return { error: "already_final" as const, status: request.status };
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
        reviewedById: opts.reviewerId,
        reviewedAt: new Date(),
        reviewNote: opts.note,
      },
      include: leaveRequestInclude,
    });
  });

  return { request: updated };
}

export function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Flips employees between ACTIVE and ON_LEAVE based on approved leave covering today.
 * Terminated employees are never touched. Called after approvals and cancellations (both the
 * HR-entry and self-service paths), and on demand from the HR overview.
 */
export async function syncEmploymentStatuses(): Promise<{ onLeave: number; returned: number }> {
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
