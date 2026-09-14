/**
 * Technet's standard working hours, as given by management (2026-09-14):
 * Monday–Friday 08:00–17:00, Saturday 08:00–13:00, Sunday not a working day.
 *
 * Used for the Late / Overtime badges on My Attendance. Public holidays aren't treated specially
 * yet. Times are the phone's local wall clock (Mauritius), minutes since midnight.
 */
export const WORK_SCHEDULE: Record<number, { start: number; end: number } | null> = {
  0: null, // Sunday
  1: { start: 8 * 60, end: 17 * 60 },
  2: { start: 8 * 60, end: 17 * 60 },
  3: { start: 8 * 60, end: 17 * 60 },
  4: { start: 8 * 60, end: 17 * 60 },
  5: { start: 8 * 60, end: 17 * 60 },
  6: { start: 8 * 60, end: 13 * 60 }, // Saturday
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
 * time. Overtime is how far the day's last check-out runs past closing time; on a Sunday, every
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
      const lateBy = shownMinutes(first.checkInDeclaredTime, first.checkInAt) - schedule.start
      if (lateBy > 0) late.set(first.id, lateBy)
    }

    if (sorted.some((v) => !v.checkOutAt)) continue

    // A check-out on a later calendar day (worked past midnight) counts the extra days in full.
    const outMinutes = (v: ScheduleVisit) => {
      const dayGap = Math.round(
        (new Date(new Date(v.checkOutAt!).toDateString()).getTime() - new Date(new Date(v.checkInAt).toDateString()).getTime()) /
          86_400_000,
      )
      return shownMinutes(v.checkOutDeclaredTime, v.checkOutAt!) + dayGap * 1440
    }
    const last = sorted.reduce((a, b) => (outMinutes(b) > outMinutes(a) ? b : a))

    if (schedule) {
      const over = outMinutes(last) - schedule.end
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
