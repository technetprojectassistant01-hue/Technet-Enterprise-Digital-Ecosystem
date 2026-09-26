import { describe, expect, it } from "vitest";
import { findExcessiveOvertimeDays, findInvertedSessions, findOverlappingSessions } from "./attendanceDataIssues";
import type { OvertimeDay } from "./overtime";

const mu = (day: string, time: string) => new Date(`${day}T${time}:00+04:00`);
const session = (id: string, employeeId: string, inT: string, outT: string | null, day = "2026-09-14") => ({
  id,
  employeeId,
  checkInAt: mu(day, inT),
  checkOutAt: outT ? mu(day, outT) : null,
});

describe("findInvertedSessions", () => {
  it("flags a check-out recorded before the check-in", () => {
    const sessions = [session("a", "e1", "08:00", "17:00"), session("b", "e1", "17:00", "09:00")];
    expect(findInvertedSessions(sessions).map((s) => s.id)).toEqual(["b"]);
  });

  it("ignores open sessions", () => {
    expect(findInvertedSessions([session("a", "e1", "08:00", null)])).toEqual([]);
  });
});

describe("findOverlappingSessions", () => {
  it("flags two closed sessions for the same employee whose ranges overlap", () => {
    const sessions = [session("a", "e1", "08:00", "13:00"), session("b", "e1", "12:00", "17:00")];
    const pairs = findOverlappingSessions(sessions);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].first.id).toBe("a");
    expect(pairs[0].second.id).toBe("b");
  });

  it("does not flag back-to-back sessions that only touch", () => {
    const sessions = [session("a", "e1", "08:00", "12:00"), session("b", "e1", "12:00", "17:00")];
    expect(findOverlappingSessions(sessions)).toEqual([]);
  });

  it("never compares sessions across different employees", () => {
    const sessions = [session("a", "e1", "08:00", "17:00"), session("b", "e2", "09:00", "18:00")];
    expect(findOverlappingSessions(sessions)).toEqual([]);
  });

  it("ignores open sessions and inverted sessions", () => {
    const sessions = [session("a", "e1", "08:00", null), session("b", "e1", "09:00", "08:30")];
    expect(findOverlappingSessions(sessions)).toEqual([]);
  });
});

describe("findExcessiveOvertimeDays", () => {
  const day = (minutes: number): OvertimeDay => ({ employeeId: "e1", date: "2026-09-14", minutes, firstIn: "08:00", lastOut: "17:00" });

  it("flags a day whose overtime minutes exceed 12 hours", () => {
    expect(findExcessiveOvertimeDays([day(721), day(720), day(60)])).toEqual([day(721)]);
  });

  it("respects a custom threshold", () => {
    expect(findExcessiveOvertimeDays([day(90)], 60)).toEqual([day(90)]);
  });
});
