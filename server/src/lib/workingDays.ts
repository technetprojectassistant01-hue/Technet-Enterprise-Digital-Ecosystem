/**
 * Working days between two UTC-midnight dates inclusive, counting Monday to Friday only and
 * excluding any date present in `holidays` (as "YYYY-MM-DD" strings, matching a PublicHoliday's
 * date rendered via `.toISOString().slice(0, 10)`).
 */
export function workingDaysBetween(start: Date, end: Date, holidays: ReadonlySet<string> = new Set()): number {
  let count = 0;
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    const iso = cursor.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidays.has(iso)) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
