import type { OvertimeDay } from "./overtime";

/**
 * Historical data-integrity checks for HR to review, per the 2026-09-26 spec: find, never fix.
 * These never change an existing `SiteAttendance` row or `OvertimeDecision` - an approved
 * overtime day stays approved even if it also shows up here as excessive. The point is a report a
 * human reads, not an automatic correction of records someone already relied on.
 */

export interface AttendanceSession {
  id: string;
  employeeId: string;
  checkInAt: Date;
  checkOutAt: Date | null;
}

export interface OverlappingSessionPair<T extends AttendanceSession> {
  first: T;
  second: T;
}

/** A day's overtime minutes above which it's worth a human looking, not a system flagging a violation. */
export const EXCESSIVE_OVERTIME_MINUTES = 12 * 60;

/** Sessions where the recorded check-out is before the recorded check-in - impossible, so a data bug. */
export function findInvertedSessions<T extends AttendanceSession>(sessions: T[]): T[] {
  return sessions.filter((s) => s.checkOutAt !== null && s.checkOutAt.getTime() < s.checkInAt.getTime());
}

/**
 * Pairs of closed sessions for the same employee whose time ranges overlap - e.g. two check-ins
 * never closed properly, or a correction that left both the old and new session standing. Only
 * compares closed sessions against each other; an inverted session (caught above) would otherwise
 * also spuriously overlap everything after it.
 */
export function findOverlappingSessions<T extends AttendanceSession>(sessions: T[]): OverlappingSessionPair<T>[] {
  const byEmployee = new Map<string, T[]>();
  for (const s of sessions) {
    if (!s.checkOutAt || s.checkOutAt.getTime() < s.checkInAt.getTime()) continue;
    byEmployee.set(s.employeeId, [...(byEmployee.get(s.employeeId) ?? []), s]);
  }

  const pairs: OverlappingSessionPair<T>[] = [];
  for (const list of byEmployee.values()) {
    const sorted = [...list].sort((a, b) => a.checkInAt.getTime() - b.checkInAt.getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (next.checkInAt.getTime() < current.checkOutAt!.getTime()) pairs.push({ first: current, second: next });
    }
  }
  return pairs;
}

/** Overtime days whose minutes exceed the threshold - almost certainly a missed check-out or a data error, not real overtime. */
export function findExcessiveOvertimeDays(days: OvertimeDay[], thresholdMinutes = EXCESSIVE_OVERTIME_MINUTES): OvertimeDay[] {
  return days.filter((d) => d.minutes > thresholdMinutes);
}
