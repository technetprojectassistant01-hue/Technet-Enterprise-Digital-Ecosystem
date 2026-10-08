/**
 * Overtime from site attendance, against Technet's standard hours (given by management,
 * 2026-09-14): Monday–Friday 08:00–17:00, Saturday 08:00–13:00, Sunday not a working day.
 * Overtime starts half an hour after closing (management, 2026-09-29): 17:30 on weekdays, 13:30 on
 * Saturday - that half hour is not counted. Likewise lateness counts from 08:30, not 08:00, and from
 * the recorded (app) check-in time.
 * Mirrors client/src/lib/workSchedule.ts — keep the two in step.
 *
 * Mauritius is UTC+4 all year (no daylight saving), so local wall-clock time is a fixed offset
 * from the stored UTC timestamps.
 */

export const MAURITIUS_OFFSET_MINUTES = 4 * 60;

/**
 * start/end = working hours; lateFrom = when lateness starts counting; overtimeFrom = when overtime
 * starts counting (all minutes of the day).
 */
const SCHEDULE: Record<number, { start: number; end: number; lateFrom: number; overtimeFrom: number } | null> = {
  0: null,
  1: { start: 480, end: 1020, lateFrom: 510, overtimeFrom: 1050 },
  2: { start: 480, end: 1020, lateFrom: 510, overtimeFrom: 1050 },
  3: { start: 480, end: 1020, lateFrom: 510, overtimeFrom: 1050 },
  4: { start: 480, end: 1020, lateFrom: 510, overtimeFrom: 1050 },
  5: { start: 480, end: 1020, lateFrom: 510, overtimeFrom: 1050 },
  6: { start: 480, end: 780, lateFrom: 510, overtimeFrom: 810 },
};

export interface OvertimeVisit {
  employeeId: string;
  checkInAt: Date;
  checkInDeclaredTime: string | null;
  checkOutAt: Date | null;
  checkOutDeclaredTime: string | null;
}

export interface OvertimeDay {
  employeeId: string;
  /** Mauritius calendar day, "YYYY-MM-DD". */
  date: string;
  minutes: number;
  /** First time in (recorded) and last time out (as typed, else recorded) that day, "HH:MM". */
  firstIn: string;
  lastOut: string;
}

function local(date: Date) {
  const shifted = new Date(date.getTime() + MAURITIUS_OFFSET_MINUTES * 60_000);
  return {
    day: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Minutes-of-day from the server-recorded GPS timestamp - used for lateness and Sunday hours.
 *
 * Overtime is the one exception, by management's decision (2026-09-29): it runs from the
 * technician's *typed* check-out time (see typedOutMinutes), reversing the spec's 2026-09-26 rule
 * that it use the recorded time. The safeguard is the TIME_MISMATCH anomaly: a typed time more than
 * 15 minutes from the recorded one is flagged, and the overtime approval shows a warning for that
 * day before HR approves it.
 */
function recordedMinutes(recorded: Date): number {
  return local(recorded).minutes;
}

/**
 * The working hours ("shift", in the AiFace attendance report's terms) of a Mauritius day
 * "YYYY-MM-DD", as minutes from midnight - null on Sunday, which is not a working day.
 */
export function shiftFor(day: string): { start: number; end: number } | null {
  const s = SCHEDULE[new Date(`${day}T00:00:00Z`).getUTCDay()];
  return s ? { start: s.start, end: s.end } : null;
}

/** Minutes from Mauritius midnight of a timestamp (the recorded clock time). */
export function mauritiusMinutes(date: Date): number {
  return local(date).minutes;
}

/** The Mauritius calendar day ("YYYY-MM-DD") a timestamp falls on. */
export function mauritiusDay(date: Date): string {
  return local(date).day;
}

/** "YYYY-MM-DD" of a Mauritius day → UTC midnight of that date, the form OvertimeDecision.date uses. */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** UTC instants covering a Mauritius month ("YYYY-MM"), for querying check-ins. */
export function mauritiusMonthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const offset = MAURITIUS_OFFSET_MINUTES * 60_000;
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - offset),
    end: new Date(Date.UTC(y, m, 1) - offset),
  };
}

/**
 * Minutes late per day, keyed by the id of that day's first check-in: how far the server-recorded
 * time-in runs past the start of the working day. Never the technician's typed time-in — that
 * field is self-reported and must not be able to erase lateness. Sundays are never late. Mirrors
 * computeDayFlags' `late` in client/src/lib/workSchedule.ts, for the printable attendance report.
 */
export function computeLateByVisit(visits: (OvertimeVisit & { id: string })[]): Map<string, number> {
  const firstByDay = new Map<string, OvertimeVisit & { id: string }>();
  for (const v of visits) {
    const key = `${v.employeeId}|${local(v.checkInAt).day}`;
    const current = firstByDay.get(key);
    if (!current || v.checkInAt < current.checkInAt) firstByDay.set(key, v);
  }
  const late = new Map<string, number>();
  for (const v of firstByDay.values()) {
    const schedule = SCHEDULE[local(v.checkInAt).weekday];
    if (!schedule) continue;
    // From 08:30, by the recorded check-in time - the typed arrival never decides lateness.
    const by = recordedMinutes(v.checkInAt) - schedule.lateFrom;
    if (by > 0) late.set(v.id, by);
  }
  return late;
}

/**
 * Overtime per employee per day. The day's last check-out past closing time counts; on a Sunday
 * every minute worked counts. Days with a session still open are skipped (not finished yet).
 * Days are grouped by the Mauritius date of the check-in.
 */
/**
 * The typed check-out as minutes from the start of the check-in's day, or null when nothing (or
 * nothing valid) was typed. A typed "HH:MM" is taken as that day's evening: a check-out recorded
 * the next morning with "17:40" typed (a forgotten check-out) counts as 17:40, not a day-long
 * shift. Only a typed time earlier than the check-in itself is read as past midnight - compared
 * with the *typed* check-in when there is one, as the screens do (client workSchedule.ts). Comparing
 * with the recorded check-in turned a same-day "07:50 -> 13:15" visit opened in the app at 13:52
 * into 23h 45m of overtime (2026-09-26, found 2026-10-03).
 */
function typedOutMinutes(v: OvertimeVisit): number | null {
  const m = v.checkOutDeclaredTime ? /^(\d{1,2}):(\d{2})$/.exec(v.checkOutDeclaredTime) : null;
  if (!m) return null;
  const typed = Number(m[1]) * 60 + Number(m[2]);
  const typedIn = v.checkInDeclaredTime ? /^(\d{1,2}):(\d{2})$/.exec(v.checkInDeclaredTime) : null;
  const inMinutes = typedIn ? Number(typedIn[1]) * 60 + Number(typedIn[2]) : recordedMinutes(v.checkInAt);
  return typed < inMinutes ? typed + 1440 : typed;
}

export function computeOvertimeDays(visits: OvertimeVisit[]): OvertimeDay[] {
  const groups = new Map<string, OvertimeVisit[]>();
  for (const v of visits) {
    const key = `${v.employeeId}|${local(v.checkInAt).day}`;
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }

  const result: OvertimeDay[] = [];
  for (const [key, dayVisits] of groups) {
    if (dayVisits.some((v) => !v.checkOutAt)) continue;
    const [employeeId, day] = key.split("|");
    const sorted = [...dayVisits].sort((a, b) => a.checkInAt.getTime() - b.checkInAt.getTime());
    const first = sorted[0];
    const schedule = SCHEDULE[local(first.checkInAt).weekday];

    // Recorded check-out; one on a later calendar day counts the extra days in full.
    const recordedOut = (v: OvertimeVisit) => {
      const dayGap = Math.round((dayToDate(local(v.checkOutAt!).day).getTime() - dayToDate(local(v.checkInAt).day).getTime()) / 86_400_000);
      return recordedMinutes(v.checkOutAt!) + dayGap * 1440;
    };
    // Overtime uses the typed check-out when there is one (management, 2026-09-29).
    const outMinutes = (v: OvertimeVisit) => typedOutMinutes(v) ?? recordedOut(v);
    const lastOut = Math.max(...sorted.map(outMinutes));

    // Sunday isn't a working day; every minute counts, from the recorded times as before.
    const minutes = schedule
      ? lastOut - schedule.overtimeFrom
      : sorted.reduce((sum, v) => sum + Math.max(0, recordedOut(v) - recordedMinutes(v.checkInAt)), 0);

    if (minutes > 0) {
      result.push({
        employeeId,
        date: day,
        minutes,
        firstIn: hhmm(recordedMinutes(first.checkInAt)),
        lastOut: hhmm(lastOut),
      });
    }
  }

  return result.sort((a, b) => (a.date === b.date ? a.employeeId.localeCompare(b.employeeId) : b.date.localeCompare(a.date)));
}
