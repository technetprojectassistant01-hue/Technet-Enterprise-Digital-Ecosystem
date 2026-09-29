/**
 * Technet's standard working hours, as given by management (2026-09-14):
 * Monday–Friday 08:00–17:00, Saturday 08:00–13:00, Sunday not a working day.
 * Overtime starts half an hour after closing (2026-09-29): 17:30 weekdays, 13:30 Saturday.
 * Lateness counts from 08:30, from the app's recorded check-in time, never the typed one.
 * Mirrors server/src/lib/overtime.ts - keep the two in step.
 *
 * Used for the Late / Overtime badges on My Attendance. Public holidays aren't treated specially
 * yet. Times are the phone's local wall clock (Mauritius), minutes since midnight.
 */
export const WORK_SCHEDULE: Record<number, { start: number; end: number; lateFrom: number; overtimeFrom: number } | null> = {
  0: null, // Sunday
  1: { start: 8 * 60, end: 17 * 60, lateFrom: 8 * 60 + 30, overtimeFrom: 17 * 60 + 30 },
  2: { start: 8 * 60, end: 17 * 60, lateFrom: 8 * 60 + 30, overtimeFrom: 17 * 60 + 30 },
  3: { start: 8 * 60, end: 17 * 60, lateFrom: 8 * 60 + 30, overtimeFrom: 17 * 60 + 30 },
  4: { start: 8 * 60, end: 17 * 60, lateFrom: 8 * 60 + 30, overtimeFrom: 17 * 60 + 30 },
  5: { start: 8 * 60, end: 17 * 60, lateFrom: 8 * 60 + 30, overtimeFrom: 17 * 60 + 30 },
  6: { start: 8 * 60, end: 13 * 60, lateFrom: 8 * 60 + 30, overtimeFrom: 13 * 60 + 30 }, // Saturday
}

/** A check-in/out as far as the schedule cares: when it started and ended, on the clock shown. */
export interface ScheduleVisit {
  id: string
  checkInAt: string
  checkInDeclaredTime: string | null
  checkOutAt: string | null
  checkOutDeclaredTime: string | null
}

export interface DayFlags {
  /** Minutes after the start of the day's first check-in, keyed onto that visit. */
  late: Map<string, number>
  /** Minutes worked past closing (or all of a Sunday), keyed onto the day's last visit. */
  overtime: Map<string, number>
}

function minutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** The clock time the person entered ("HH:MM"), falling back to the recorded time. */
function shownMinutes(declared: string | null, recordedIso: string): number {
  const m = declared ? /^(\d{1,2}):(\d{2})$/.exec(declared) : null
  return m ? Number(m[1]) * 60 + Number(m[2]) : minutesOf(new Date(recordedIso))
}

/**
 * Works out Late and Overtime per day. A day is late when its first check-in is after the start
 * time. Overtime is how far the day's last check-out runs past overtimeFrom; on a Sunday, every
 * minute worked counts. A day with a session still open gets no overtime yet. Uses the times as
 * shown in the table (what was entered, else what was recorded) so a badge always matches the row.
 */
export function computeDayFlags(visits: ScheduleVisit[]): DayFlags {
  const late = new Map<string, number>()
  const overtime = new Map<string, number>()

  const byDay = new Map<string, ScheduleVisit[]>()
  for (const v of visits) {
    const key = new Date(v.checkInAt).toDateString()
    byDay.set(key, [...(byDay.get(key) ?? []), v])
  }

  for (const dayVisits of byDay.values()) {
    const sorted = [...dayVisits].sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime())
    const first = sorted[0]
    const schedule = WORK_SCHEDULE[new Date(first.checkInAt).getDay()]

    if (schedule) {
      // The app's recorded check-in time, never the typed one (management, 2026-09-29).
      const lateBy = minutesOf(new Date(first.checkInAt)) - schedule.lateFrom
      if (lateBy > 0) late.set(first.id, lateBy)
    }

    if (sorted.some((v) => !v.checkOutAt)) continue

    // The typed check-out is read as that day's evening (a check-out recorded the next morning with
    // "17:40" typed counts as 17:40), past midnight only if earlier than the check-in - the same
    // rule as the server. With nothing typed, the recorded time; a check-out on a later calendar
    // day then counts the extra days in full.
    const outMinutes = (v: ScheduleVisit) => {
      const typed = v.checkOutDeclaredTime ? /^(\d{1,2}):(\d{2})$/.exec(v.checkOutDeclaredTime) : null
      if (typed) {
        const m = Number(typed[1]) * 60 + Number(typed[2])
        return m < shownMinutes(v.checkInDeclaredTime, v.checkInAt) ? m + 1440 : m
      }
      const dayGap = Math.round(
        (new Date(new Date(v.checkOutAt!).toDateString()).getTime() - new Date(new Date(v.checkInAt).toDateString()).getTime()) /
          86_400_000,
      )
      return minutesOf(new Date(v.checkOutAt!)) + dayGap * 1440
    }
    const last = sorted.reduce((a, b) => (outMinutes(b) > outMinutes(a) ? b : a))

    if (schedule) {
      const over = outMinutes(last) - schedule.overtimeFrom
      if (over > 0) overtime.set(last.id, over)
    } else {
      const worked = sorted.reduce(
        (sum, v) => sum + Math.max(0, outMinutes(v) - shownMinutes(v.checkInDeclaredTime, v.checkInAt)),
        0,
      )
      if (worked > 0) overtime.set(last.id, worked)
    }
  }

  return { late, overtime }
}
