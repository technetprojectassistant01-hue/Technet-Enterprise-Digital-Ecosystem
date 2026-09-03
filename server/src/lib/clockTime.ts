/**
 * Wall-clock times ("HH:MM") as used by AttendanceRecord.clockIn/clockOut and by the declared
 * arrival/departure times on SiteAttendance. The business runs in a single timezone, so these are
 * stored as plain local strings rather than DateTimes - that avoids UTC conversion errors
 * entirely, at the cost of not being comparable across zones, which nothing here needs.
 */

/** Normalises an "HH:MM" (or "H:MM") string to zero-padded "HH:MM", or null if it isn't a time. */
export function parseClockTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
