import { dayToDate, mauritiusDay, mauritiusMinutes, shiftFor, type OvertimeDay } from "./overtime";

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
  /** Employee code ("Staff Code" in the AiFace report). */
  code: string | null;
  department: string | null;
  /** "YYYY-MM-DD" or null: the first day they could check in (the later of hire date and login
   * creation). Days before it are never "no check-in". */
  expectedFrom: string | null;
  /** Only technicians are expected to check in every working day; others get no no-check-in list. */
  expectedDaily: boolean;
}

/** What a day was, for one person - the AiFace daily report's view of it. */
export type DayStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HOLIDAY" | "EXCUSED" | "REST";

export interface DailyRow {
  /** Mauritius day, "YYYY-MM-DD". */
  day: string;
  /** Working hours that day ("08:00-17:00"), null on Sunday. */
  shift: string | null;
  /** Each check-in/check-out pair that day (In1/Out1, In2/Out2, ...), app-recorded times. */
  punches: { in: string; out: string | null; outNextDay: boolean }[];
  /** Minutes between recorded check-in and check-out, summed over the day's closed visits. */
  minutes: number;
  lateMinutes: number;
  /** Minutes the day's last recorded check-out came before the end of the shift. */
  earlyMinutes: number;
  status: DayStatus;
}

export interface TechnicianSummary {
  employeeId: string;
  name: string;
  code: string | null;
  department: string | null;
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
  // ---- The AiFace monthly report's columns (2026-10-08). null = not expected to check in daily.
  /** Working days in the period, excluding public holidays ("Should"). */
  shouldDays: number | null;
  shouldMinutes: number | null;
  absenceMinutes: number;
  earlyTimes: number;
  earlyMinutes: number;
  holidayDays: number;
  holidayMinutes: number;
  leaveDays: number;
  leaveMinutes: number;
  /** One row per day of the period (every day for technicians, check-in days for others). */
  daily: DailyRow[];
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

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function calendarDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let t = dayToDate(from).getTime(); t <= dayToDate(to).getTime(); t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
  return days;
}

/**
 * One row per person over the period, in the shape of the office's AiFace attendance machine report
 * (Should / Actual / Absence / Late / Leave Early / Holiday / Leave, plus a daily breakdown with
 * In1/Out1..), alongside the figures the app already had. Lateness and early leave use the times the
 * app recorded, never the typed ones; overtime keeps its own rule (lib/overtime.ts).
 */
export function summarizeTechnicians(input: SummaryInput): TechnicianSummary[] {
  const end = [input.to, input.today].sort()[0];

  return input.people.map((p) => {
    const visits = input.visits.filter((v) => v.employeeId === p.id).sort((a, b) => a.checkInAt.getTime() - b.checkInAt.getTime());
    const byDay = new Map<string, SummaryVisit[]>();
    for (const v of visits) {
      const d = mauritiusDay(v.checkInAt);
      byDay.set(d, [...(byDay.get(d) ?? []), v]);
    }
    const start = p.expectedDaily && p.expectedFrom && p.expectedFrom > input.from ? p.expectedFrom : input.from;
    const days = p.expectedDaily ? (end < start ? [] : calendarDays(start, end)) : [...byDay.keys()].sort();
    const onLeave = (d: string) => input.leave.some((l) => l.employeeId === p.id && l.from <= d && d <= l.to);

    const daily: DailyRow[] = days.map((day) => {
      const shift = shiftFor(day);
      const dayVisits = byDay.get(day) ?? [];
      const closed = dayVisits.filter((v) => v.checkOutAt);
      let earlyMinutes = 0;
      // No early leave on a public holiday: there was no shift to leave early from.
      if (shift && !input.holidays.has(day) && dayVisits.length && closed.length === dayVisits.length) {
        const lastOut = closed.reduce((a, b) => (b.checkOutAt! > a.checkOutAt! ? b : a)).checkOutAt!;
        if (mauritiusDay(lastOut) === day) earlyMinutes = Math.max(0, shift.end - mauritiusMinutes(lastOut));
      }
      const status: DayStatus = dayVisits.length
        ? "PRESENT"
        : !shift
          ? "REST"
          : input.holidays.has(day)
            ? "HOLIDAY"
            : onLeave(day)
              ? "LEAVE"
              : input.excused.has(`${p.id}|${day}`)
                ? "EXCUSED"
                : "ABSENT";
      return {
        day,
        shift: shift ? `${hhmm(shift.start)}-${hhmm(shift.end)}` : null,
        punches: dayVisits.map((v) => ({
          in: hhmm(mauritiusMinutes(v.checkInAt)),
          out: v.checkOutAt ? hhmm(mauritiusMinutes(v.checkOutAt)) : null,
          outNextDay: !!v.checkOutAt && mauritiusDay(v.checkOutAt) !== day,
        })),
        minutes: Math.round(closed.reduce((s, v) => s + Math.max(0, v.checkOutAt!.getTime() - v.checkInAt.getTime()) / 60000, 0)),
        lateMinutes: dayVisits.reduce((s, v) => s + (input.late.get(v.id) ?? 0), 0),
        earlyMinutes,
        status,
      };
    });

    const shiftLength = (d: string) => {
      const sh = shiftFor(d);
      return sh ? sh.end - sh.start : 0;
    };
    const ofStatus = (st: DayStatus) => daily.filter((r) => r.status === st);
    const working = p.expectedDaily ? days.filter((d) => shiftFor(d) && !input.holidays.has(d)) : null;
    const lates = visits.map((v) => input.late.get(v.id) ?? 0).filter((m) => m > 0);
    const early = daily.filter((r) => r.earlyMinutes > 0);

    return {
      employeeId: p.id,
      name: p.name,
      code: p.code,
      department: p.department,
      daysCheckedIn: byDay.size,
      noCheckInDays: p.expectedDaily ? ofStatus("ABSENT").map((r) => r.day) : null,
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
      shouldDays: working ? working.length : null,
      shouldMinutes: working ? working.reduce((s, d) => s + shiftLength(d), 0) : null,
      absenceMinutes: ofStatus("ABSENT").reduce((s, r) => s + shiftLength(r.day), 0),
      earlyTimes: early.length,
      earlyMinutes: early.reduce((s, r) => s + r.earlyMinutes, 0),
      holidayDays: ofStatus("HOLIDAY").length,
      holidayMinutes: ofStatus("HOLIDAY").reduce((s, r) => s + shiftLength(r.day), 0),
      leaveDays: ofStatus("LEAVE").length,
      leaveMinutes: ofStatus("LEAVE").reduce((s, r) => s + shiftLength(r.day), 0),
      daily,
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
