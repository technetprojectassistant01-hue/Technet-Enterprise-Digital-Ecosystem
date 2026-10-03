import { workingDays } from "./absences";
import { mauritiusDay, type OvertimeDay } from "./overtime";

/**
 * The per-technician summary and the pay warnings printed at the front of the team attendance PDF
 * (management, 2026-10-03: the app should produce the reports that were being written by hand).
 * Pure - routes/siteAttendance.ts loads the data. Tested in attendanceSummary.test.ts.
 */

/** A visit open longer than this was almost always checked out late (often the next morning). */
export const LONG_VISIT_MINUTES = 12 * 60;

export interface SummaryVisit {
  id: string;
  employeeId: string;
  checkInAt: Date;
  checkOutAt: Date | null;
}

export interface SummaryPerson {
  id: string;
  name: string;
  /** "YYYY-MM-DD" or null: the first day they could check in (the later of hire date and login
   * creation). Days before it are never "no check-in". */
  expectedFrom: string | null;
  /** Only technicians are expected to check in every working day; others get no no-check-in list. */
  expectedDaily: boolean;
}

export interface TechnicianSummary {
  employeeId: string;
  name: string;
  daysCheckedIn: number;
  /** Working days with no check-in, oldest first; null for someone not expected to check in daily. */
  noCheckInDays: string[] | null;
  firstCheckIn: string | null;
  lastCheckIn: string | null;
  minutesRecorded: number;
  lateDays: number;
  lateMinutes: number;
  /** Overtime the rules calculate, approved or not. */
  overtimeMinutes: number;
  approvedOvertimeMinutes: number;
  openVisits: number;
}

export interface SummaryInput {
  people: SummaryPerson[];
  from: string;
  to: string;
  /** Today in Mauritius - later days haven't happened, so they are never "no check-in". */
  today: string;
  visits: SummaryVisit[];
  /** Approved leave, inclusive days. */
  leave: { employeeId: string; from: string; to: string }[];
  holidays: Set<string>;
  /** `${employeeId}|${day}` HR has excused. */
  excused: Set<string>;
  /** Minutes late by visit id (computeLateByVisit). */
  late: Map<string, number>;
  overtimeDays: OvertimeDay[];
  /** HR-approved overtime decisions. */
  approved: { employeeId: string; date: string; minutes: number }[];
}

export function summarizeTechnicians(input: SummaryInput): TechnicianSummary[] {
  const end = [input.to, input.today].sort()[0];
  const days = end < input.from ? [] : workingDays(input.from, end).filter((d) => !input.holidays.has(d));

  return input.people.map((p) => {
    const visits = input.visits.filter((v) => v.employeeId === p.id).sort((a, b) => a.checkInAt.getTime() - b.checkInAt.getTime());
    const present = new Set(visits.map((v) => mauritiusDay(v.checkInAt)));
    const noCheckInDays = p.expectedDaily
      ? days.filter(
          (d) =>
            !present.has(d) &&
            !(p.expectedFrom && d < p.expectedFrom) &&
            !input.excused.has(`${p.id}|${d}`) &&
            !input.leave.some((l) => l.employeeId === p.id && l.from <= d && d <= l.to),
        )
      : null;
    const lates = visits.map((v) => input.late.get(v.id) ?? 0).filter((m) => m > 0);
    return {
      employeeId: p.id,
      name: p.name,
      daysCheckedIn: present.size,
      noCheckInDays,
      firstCheckIn: visits[0] ? mauritiusDay(visits[0].checkInAt) : null,
      lastCheckIn: visits.length ? mauritiusDay(visits[visits.length - 1].checkInAt) : null,
      minutesRecorded: Math.round(
        visits.reduce((s, v) => (v.checkOutAt ? s + Math.max(0, v.checkOutAt.getTime() - v.checkInAt.getTime()) / 60000 : s), 0),
      ),
      lateDays: lates.length,
      lateMinutes: lates.reduce((s, m) => s + m, 0),
      overtimeMinutes: input.overtimeDays.filter((o) => o.employeeId === p.id).reduce((s, o) => s + o.minutes, 0),
      approvedOvertimeMinutes: input.approved.filter((a) => a.employeeId === p.id).reduce((s, a) => s + a.minutes, 0),
      openVisits: visits.filter((v) => !v.checkOutAt).length,
    };
  });
}

export interface PayWarning {
  visitId: string;
  employeeId: string;
  /** Mauritius day of the check-in. */
  day: string;
  openMinutes: number;
  /** Overtime on that employee-day, if any: what HR approved, else what is calculated and waiting. */
  overtime: { minutes: number; status: "APPROVED" | "PENDING" } | null;
}

/**
 * Closed visits open longer than LONG_VISIT_MINUTES, with the overtime that day carries. Their hours
 * are overstated, and so is overtime calculated from a late check-out - HR should check before
 * paying. (Automatic check-out from 2026-10-02 stops new ones running past midnight.)
 */
export function payWarnings(
  visits: SummaryVisit[],
  approved: { employeeId: string; date: string; minutes: number }[],
  overtimeDays: OvertimeDay[],
): PayWarning[] {
  return visits
    .filter((v) => v.checkOutAt && v.checkOutAt.getTime() - v.checkInAt.getTime() > LONG_VISIT_MINUTES * 60_000)
    .sort((a, b) => a.checkInAt.getTime() - b.checkInAt.getTime())
    .map((v) => {
      const day = mauritiusDay(v.checkInAt);
      const a = approved.find((x) => x.employeeId === v.employeeId && x.date === day && x.minutes > 0);
      const p = overtimeDays.find((x) => x.employeeId === v.employeeId && x.date === day);
      return {
        visitId: v.id,
        employeeId: v.employeeId,
        day,
        openMinutes: Math.round((v.checkOutAt!.getTime() - v.checkInAt.getTime()) / 60000),
        overtime: a ? { minutes: a.minutes, status: "APPROVED" as const } : p ? { minutes: p.minutes, status: "PENDING" as const } : null,
      };
    });
}
