import { createHash } from "crypto";
import { prisma } from "./prisma";
import { MAURITIUS_OFFSET_MINUTES, computeLateByVisit, dayToDate, mauritiusDay } from "./overtime";
import { generateAttendancePdf } from "./pdf/attendancePdf";

/**
 * The printable attendance report for one employee over a range of Mauritius days, and the
 * validation that decides whether it prints as DRAFT. Shared by the employee's own export
 * (routes/siteAttendance.ts) and HR's review (routes/attendanceValidations.ts).
 */

/** Longest range one report or validation request can cover. */
export const MAX_REPORT_DAYS = 366;

export function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dayToDate(value).getTime());
}

export function todayInMauritius(): string {
  return mauritiusDay(new Date());
}

/** A validated from/to pair of "YYYY-MM-DD" Mauritius days, or an error message. */
export function parseRange(from: unknown, to: unknown): { from: string; to: string } | { error: string } {
  if (!isDay(from) || !isDay(to)) return { error: "from and to dates (YYYY-MM-DD) are required" };
  if (to < from) return { error: "The end date must be on or after the start date" };
  const days = (dayToDate(to).getTime() - dayToDate(from).getTime()) / 86_400_000 + 1;
  if (days > MAX_REPORT_DAYS) return { error: `Choose a range of ${MAX_REPORT_DAYS} days or less` };
  return { from, to };
}

const VISIT_SELECT = {
  id: true,
  employeeId: true,
  checkInAt: true,
  checkInDeclaredTime: true,
  checkInNote: true,
  checkInSite: true,
  checkInTransportCost: true,
  checkInTransportNote: true,
  checkOutAt: true,
  checkOutDeclaredTime: true,
  checkOutNote: true,
  checkOutSite: true,
  checkOutTransportCost: true,
  checkOutTransportNote: true,
  checkOutByManager: true,
} as const;

/** Everything that goes into the report for a range: visits (by check-in day) and approved overtime. */
async function loadRange(employeeId: string, from: string, to: string) {
  const offset = MAURITIUS_OFFSET_MINUTES * 60_000;
  const start = new Date(dayToDate(from).getTime() - offset);
  const end = new Date(dayToDate(to).getTime() + 86_400_000 - offset);
  const [visits, approved] = await Promise.all([
    prisma.siteAttendance.findMany({
      where: { employeeId, checkInAt: { gte: start, lt: end } },
      select: VISIT_SELECT,
      orderBy: { checkInAt: "asc" },
    }),
    prisma.overtimeDecision.findMany({
      where: { employeeId, status: "APPROVED", date: { gte: dayToDate(from), lte: dayToDate(to) } },
      select: { date: true, minutes: true },
      orderBy: { date: "asc" },
    }),
  ]);
  return { visits, approved };
}

/**
 * A hash of what the report shows for a range. Stored when HR validates; if a check-in, a manager
 * close or an overtime decision changes afterwards, it stops matching and the PDF is DRAFT again.
 */
function fingerprintOf({ visits, approved }: Awaited<ReturnType<typeof loadRange>>): string {
  const hash = createHash("sha256");
  for (const v of visits) {
    hash.update(
      JSON.stringify([
        v.id,
        v.checkInAt.toISOString(),
        v.checkInDeclaredTime,
        v.checkInNote,
        v.checkInSite,
        v.checkInTransportCost?.toString() ?? null,
        v.checkInTransportNote,
        v.checkOutAt?.toISOString() ?? null,
        v.checkOutDeclaredTime,
        v.checkOutNote,
        v.checkOutSite,
        v.checkOutTransportCost?.toString() ?? null,
        v.checkOutTransportNote,
        v.checkOutByManager,
      ]),
    );
  }
  for (const d of approved) hash.update(JSON.stringify([d.date.toISOString(), d.minutes]));
  return hash.digest("hex");
}

export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function rangeFingerprint(employeeId: string, from: string, to: string): Promise<string> {
  return fingerprintOf(await loadRange(employeeId, from, to));
}

/** True when a validated request's attendance has changed since it was validated. */
export async function isStale(validation: { employeeId: string; fromDate: Date; toDate: Date; fingerprint: string | null }) {
  if (!validation.fingerprint) return true;
  return (await rangeFingerprint(validation.employeeId, dayOf(validation.fromDate), dayOf(validation.toDate))) !== validation.fingerprint;
}

/** The validation that makes this range final: a VALIDATED one covering it whose data is unchanged. */
async function coveringValidation(employeeId: string, from: string, to: string) {
  const candidates = await prisma.attendanceValidation.findMany({
    where: { employeeId, status: "VALIDATED", fromDate: { lte: dayToDate(from) }, toDate: { gte: dayToDate(to) } },
    include: { decidedBy: { select: { name: true, email: true } } },
    orderBy: { decidedAt: "desc" },
  });
  for (const c of candidates) {
    if (!(await isStale(c))) return c;
  }
  return null;
}

/** Builds the PDF for one employee and range, DRAFT unless a current validation covers it. */
export async function buildAttendanceReport(employeeId: string, from: string, to: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true, employeeCode: true, position: true, department: true },
  });
  if (!employee) return null;

  const [{ visits, approved }, validation] = await Promise.all([loadRange(employeeId, from, to), coveringValidation(employeeId, from, to)]);

  // Approved overtime sits on the day's last check-in, as on the screen.
  const lastByDay = new Map<string, (typeof visits)[number]>();
  for (const v of visits) lastByDay.set(mauritiusDay(v.checkInAt), v);
  const overtime = new Map<string, number>();
  for (const d of approved) {
    const v = lastByDay.get(dayOf(d.date));
    if (v && d.minutes > 0) overtime.set(v.id, d.minutes);
  }

  const doc = generateAttendancePdf({
    employee,
    from,
    to,
    visits,
    late: computeLateByVisit(visits),
    overtime,
    validation:
      validation && validation.decidedAt
        ? { by: validation.decidedBy?.name || validation.decidedBy?.email || "HR", at: validation.decidedAt }
        : null,
  });
  const filename = `attendance-${employee.employeeCode}-${from}-to-${to}${validation ? "" : "-DRAFT"}.pdf`;
  return { doc, filename };
}
