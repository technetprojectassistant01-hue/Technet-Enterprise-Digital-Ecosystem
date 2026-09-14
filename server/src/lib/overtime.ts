/**
 * Overtime from site attendance, against Technet's standard hours (given by management,
 * 2026-09-14): Monday–Friday 08:00–17:00, Saturday 08:00–13:00, Sunday not a working day.
 * Mirrors client/src/lib/workSchedule.ts — keep the two in step.
 *
 * Mauritius is UTC+4 all year (no daylight saving), so local wall-clock time is a fixed offset
 * from the stored UTC timestamps.
 */

export const MAURITIUS_OFFSET_MINUTES = 4 * 60;

const SCHEDULE: Record<number, { start: number; end: number } | null> = {
  0: null,
  1: { start: 480, end: 1020 },
  2: { start: 480, end: 1020 },
  3: { start: 480, end: 1020 },
  4: { start: 480, end: 1020 },
  5: { start: 480, end: 1020 },
  6: { start: 480, end: 780 },
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
  /** First time in and last time out that day, "HH:MM" as shown to the technician. */
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

/** The typed time ("HH:MM") if there is one, else the recorded clock time — as the table shows it. */
function shown(declared: string | null, recorded: Date): number {
  const m = declared ? /^(\d{1,2}):(\d{2})$/.exec(declared) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : local(recorded).minutes;
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
 * Minutes late per day, keyed by the id of that day's first check-in: how far the shown time-in
 * runs past the start of the working day. Sundays are never late. Mirrors computeDayFlags' `late`
 * in client/src/lib/workSchedule.ts, for the printable attendance report.
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
    const by = shown(v.checkInDeclaredTime, v.checkInAt) - schedule.start;
    if (by > 0) late.set(v.id, by);
  }
  return late;
}

/**
 * Overtime per employee per day. The day's last check-out past closing time counts; on a Sunday
 * every minute worked counts. Days with a session still open are skipped (not finished yet).
 * Days are grouped by the Mauritius date of the check-in.
 */
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

    // A check-out on a later calendar day counts the extra days in full.
    const outMinutes = (v: OvertimeVisit) => {
      const dayGap = Math.round((dayToDate(local(v.checkOutAt!).day).getTime() - dayToDate(local(v.checkInAt).day).getTime()) / 86_400_000);
      return shown(v.checkOutDeclaredTime, v.checkOutAt!) + dayGap * 1440;
    };
    const lastOut = Math.max(...sorted.map(outMinutes));

    const minutes = schedule
      ? lastOut - schedule.end
      : sorted.reduce((sum, v) => sum + Math.max(0, outMinutes(v) - shown(v.checkInDeclaredTime, v.checkInAt)), 0);

    if (minutes > 0) {
      result.push({
        employeeId,
        date: day,
        minutes,
        firstIn: hhmm(shown(first.checkInDeclaredTime, first.checkInAt)),
        lastOut: hhmm(lastOut),
      });
    }
  }

  return result.sort((a, b) => (a.date === b.date ? a.employeeId.localeCompare(b.employeeId) : b.date.localeCompare(a.date)));
}
