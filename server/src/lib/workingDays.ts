/** Working days between two UTC-midnight dates inclusive, counting Monday to Friday only. */
export function workingDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
