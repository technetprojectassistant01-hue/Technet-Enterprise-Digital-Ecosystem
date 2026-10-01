import { prisma } from "./prisma";
import { dayToDate, MAURITIUS_OFFSET_MINUTES, mauritiusDay } from "./overtime";

/**
 * Absence from check-ins (management, 2026-10-01): a technician who hasn't checked in on a working
 * day is **Absent until they check in** - including today, from the start of the day. Checking in
 * (at any time) clears it; checking in after 08:30 is "late" instead (lib/overtime.ts).
 *
 * Never stored - worked out from the data each time, so it can't drift from the check-ins. The
 * only stored part is HR's excuse (AbsenceExcuse), which turns a day into "Excused" with a note.
 *
 * Not absent: Sundays (not a working day), public holidays (HR's PublicHoliday calendar), days on
 * approved leave, days before the employee's hire date, and anything before ABSENCE_RULE_SINCE -
 * nobody was told the rule applied before it was introduced. Technicians only (FIELD_TECHNICIAN),
 * not terminated. No pay effect: payroll does not read this.
 */

export const ABSENCE_RULE_SINCE = "2026-10-01";

export type AbsenceStatus = "ABSENT" | "EXCUSED";

export interface Absence {
  employeeId: string;
  /** Mauritius day, "YYYY-MM-DD". */
  date: string;
  status: AbsenceStatus;
  /** HR's note when excused. */
  note: string | null;
}

/** Mauritius working days (Monday-Saturday) from `from` to `to` inclusive, as "YYYY-MM-DD". */
export function workingDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let t = dayToDate(from).getTime(); t <= dayToDate(to).getTime(); t += 86_400_000) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0) days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export interface AbsenceInput {
  employees: { id: string; hireDate: string | null }[];
  from: string;
  to: string;
  /** Today in Mauritius - later days are never absent (they haven't happened). */
  today: string;
  /** `${employeeId}|${day}` for every day with at least one check-in. */
  checkedIn: Set<string>;
  /** Approved leave, inclusive days. */
  leave: { employeeId: string; from: string; to: string }[];
  holidays: Set<string>;
  /** `${employeeId}|${day}` -> HR's note. */
  excuses: Map<string, string>;
}

/** Pure: every absent (or excused) technician-day in the range. Tested in absences.test.ts. */
export function computeAbsences(input: AbsenceInput): Absence[] {
  const start = [input.from, ABSENCE_RULE_SINCE].sort()[1];
  const end = [input.to, input.today].sort()[0];
  if (end < start) return [];
  const days = workingDays(start, end).filter((d) => !input.holidays.has(d));

  const result: Absence[] = [];
  for (const employee of input.employees) {
    for (const day of days) {
      if (employee.hireDate && day < employee.hireDate) continue;
      const key = `${employee.id}|${day}`;
      if (input.checkedIn.has(key)) continue;
      if (input.leave.some((l) => l.employeeId === employee.id && l.from <= day && day <= l.to)) continue;
      const note = input.excuses.get(key);
      result.push({ employeeId: employee.id, date: day, status: note !== undefined ? "EXCUSED" : "ABSENT", note: note ?? null });
    }
  }
  return result.sort((a, b) => (a.date === b.date ? a.employeeId.localeCompare(b.employeeId) : a.date.localeCompare(b.date)));
}

const dayString = (d: Date) => d.toISOString().slice(0, 10);

/** Loads everything computeAbsences needs from the database. `employeeId` narrows it to one person. */
export async function loadAbsences(from: string, to: string, employeeId?: string): Promise<Absence[]> {
  const employees = await prisma.employee.findMany({
    where: {
      ...(employeeId ? { id: employeeId } : {}),
      employmentStatus: { not: "TERMINATED" },
      user: { role: "FIELD_TECHNICIAN" },
    },
    select: { id: true, hireDate: true },
  });
  if (!employees.length) return [];
  const ids = employees.map((e) => e.id);

  const offset = MAURITIUS_OFFSET_MINUTES * 60_000;
  const [visits, leave, holidays, excuses] = await Promise.all([
    prisma.siteAttendance.findMany({
      where: {
        employeeId: { in: ids },
        checkInAt: { gte: new Date(dayToDate(from).getTime() - offset), lt: new Date(dayToDate(to).getTime() + 86_400_000 - offset) },
      },
      select: { employeeId: true, checkInAt: true },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId: { in: ids }, status: "APPROVED", startDate: { lte: dayToDate(to) }, endDate: { gte: dayToDate(from) } },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
    prisma.publicHoliday.findMany({ where: { date: { gte: dayToDate(from), lte: dayToDate(to) } }, select: { date: true } }),
    prisma.absenceExcuse.findMany({
      where: { employeeId: { in: ids }, date: { gte: dayToDate(from), lte: dayToDate(to) } },
      select: { employeeId: true, date: true, note: true },
    }),
  ]);

  return computeAbsences({
    employees: employees.map((e) => ({ id: e.id, hireDate: e.hireDate ? dayString(e.hireDate) : null })),
    from,
    to,
    today: mauritiusDay(new Date()),
    checkedIn: new Set(visits.map((v) => `${v.employeeId}|${mauritiusDay(v.checkInAt)}`)),
    leave: leave.map((l) => ({ employeeId: l.employeeId, from: dayString(l.startDate), to: dayString(l.endDate) })),
    holidays: new Set(holidays.map((h) => dayString(h.date))),
    excuses: new Map(excuses.map((x) => [`${x.employeeId}|${dayString(x.date)}`, x.note])),
  });
}
