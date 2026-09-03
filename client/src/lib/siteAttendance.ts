import type { LocationMatch, SiteAttendance } from './api'

/**
 * Helpers shared by the technician's own AttendanceWidget and the manager-facing Team Attendance
 * and Field Operations views, so the way a stated time and a transport cost are presented can't
 * drift between them.
 */

/** Local wall-clock "HH:MM". Built from date parts, not toLocaleTimeString, so it can be compared
 * against a stored declared time without locale formatting getting in the way. */
export function clockOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** The format both <input type="time"> and the server expect. */
export function currentClockTime(): string {
  return clockOf(new Date())
}

/**
 * The technician's stated time, shown only when it differs from what the server recorded.
 * When somebody taps straight through the two match, and repeating the value is noise - a
 * mismatch is the part worth seeing, and showing it keeps "what was said" and "what was
 * observed" visibly separate rather than blurring them into one number.
 */
export function statedTimeSuffix(declared: string | null, actualIso: string | null): string {
  if (!declared || !actualIso) return ''
  return declared === clockOf(new Date(actualIso)) ? '' : ` (stated ${declared})`
}

/** Both legs of the trip added together. Decimal columns arrive as strings, hence the Number(). */
export function totalTransportCost(visit: Pick<SiteAttendance, 'checkInTransportCost' | 'checkOutTransportCost'>): number {
  return Number(visit.checkInTransportCost ?? 0) + Number(visit.checkOutTransportCost ?? 0)
}

/**
 * How far off a typed location was, in words. Only ever rendered for a real MISMATCH.
 *
 * MATCHED and UNCHECKABLE both render as nothing on purpose. UNCHECKABLE is the ordinary result
 * for text like "Office" - there was simply nothing to compare against - and showing a marker
 * for it would read as doubt about somebody who did nothing wrong.
 */
export function locationMismatchLabel(
  match: LocationMatch | null,
  distanceMeters: number | null,
): string | null {
  if (match !== 'MISMATCH' || distanceMeters === null) return null
  const km = distanceMeters / 1000
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km from stated`
}

/** True when either leg of a visit was flagged. Used to tint a row for a manager scanning a list. */
export function hasLocationMismatch(
  visit: Pick<SiteAttendance, 'checkInLocationMatch' | 'checkOutLocationMatch'>,
): boolean {
  return visit.checkInLocationMatch === 'MISMATCH' || visit.checkOutLocationMatch === 'MISMATCH'
}
