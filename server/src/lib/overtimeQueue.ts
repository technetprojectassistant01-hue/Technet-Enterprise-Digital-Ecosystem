import { prisma } from "./prisma";
import { HR_ROLES } from "./roles";
import { notifyRoles } from "./notifications";
import { MAURITIUS_OFFSET_MINUTES, computeOvertimeDays, dayToDate, mauritiusDay } from "./overtime";

const VISIT_SELECT = {
  employeeId: true,
  checkInAt: true,
  checkInDeclaredTime: true,
  checkOutAt: true,
  checkOutDeclaredTime: true,
} as const;

/** One employee's overtime for one Mauritius day, recalculated from their attendance. */
export async function overtimeForDay(employeeId: string, day: string) {
  const start = new Date(dayToDate(day).getTime() - MAURITIUS_OFFSET_MINUTES * 60_000);
  const end = new Date(start.getTime() + 86_400_000);
  const visits = await prisma.siteAttendance.findMany({
    where: { employeeId, checkInAt: { gte: start, lt: end } },
    select: VISIT_SELECT,
  });
  return computeOvertimeDays(visits).find((d) => d.date === day) ?? null;
}

/**
 * After a check-out closes a visit, tells HR if that day now has overtime to approve. Once per
 * employee per day (a later check-out the same day doesn't notify again) and never for a day HR
 * has already decided. Best-effort: a failure here must never fail the check-out itself.
 */
export async function notifyHrOfOvertime(employeeId: string, checkInAt: Date): Promise<void> {
  try {
    const day = mauritiusDay(checkInAt);
    const overtime = await overtimeForDay(employeeId, day);
    if (!overtime) return;

    const decided = await prisma.overtimeDecision.findUnique({
      where: { employeeId_date: { employeeId, date: dayToDate(day) } },
      select: { id: true },
    });
    if (decided) return;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { firstName: true, lastName: true },
    });
    if (!employee) return;

    // The title identifies the employee and day, so it doubles as the "already told HR" check.
    const title = `Overtime to approve: ${employee.firstName} ${employee.lastName} on ${day}`;
    const already = await prisma.notification.findFirst({ where: { type: "OVERTIME_PENDING", title }, select: { id: true } });
    if (already) return;

    const hours = Math.floor(overtime.minutes / 60);
    const minutes = overtime.minutes % 60;
    await notifyRoles(HR_ROLES, "OVERTIME_PENDING", title, {
      message: `${hours}h ${minutes}m of overtime (${overtime.firstIn} → ${overtime.lastOut})`,
      link: "/dashboard/hr/overtime",
    });
  } catch (err) {
    console.error("Failed to notify HR of overtime", err);
  }
}
