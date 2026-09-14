import { describe, expect, it } from "vitest";
import { computeLateByVisit, computeOvertimeDays, mauritiusMonthRange, type OvertimeVisit } from "./overtime";

/** A Mauritius wall-clock time (UTC+4) as a UTC Date. */
const mu = (day: string, time: string) => new Date(`${day}T${time}:00+04:00`);

const visit = (day: string, inT: string, outT: string | null, extra: Partial<OvertimeVisit> = {}): OvertimeVisit => ({
  employeeId: "e1",
  checkInAt: mu(day, inT),
  checkInDeclaredTime: null,
  checkOutAt: outT ? mu(day, outT) : null,
  checkOutDeclaredTime: null,
  ...extra,
});

describe("computeOvertimeDays", () => {
  it("counts a weekday check-out past 17:00, on the day's last visit", () => {
    // 2026-09-14 is a Monday
    const days = computeOvertimeDays([visit("2026-09-14", "08:00", "12:00"), visit("2026-09-14", "13:00", "17:45")]);
    expect(days).toEqual([{ employeeId: "e1", date: "2026-09-14", minutes: 45, firstIn: "08:00", lastOut: "17:45" }]);
  });

  it("uses 13:00 on Saturday", () => {
    const days = computeOvertimeDays([visit("2026-09-19", "08:00", "14:30")]);
    expect(days[0].minutes).toBe(90);
  });

  it("counts every minute on a Sunday", () => {
    const days = computeOvertimeDays([visit("2026-09-20", "09:00", "11:15")]);
    expect(days[0].minutes).toBe(135);
  });

  it("ignores days that finish on time or are still open", () => {
    expect(computeOvertimeDays([visit("2026-09-15", "07:55", "17:00")])).toEqual([]);
    expect(computeOvertimeDays([visit("2026-09-16", "08:00", null)])).toEqual([]);
  });

  it("uses the typed time when there is one", () => {
    const days = computeOvertimeDays([visit("2026-09-17", "08:00", "17:10", { checkOutDeclaredTime: "18:00" })]);
    expect(days[0].minutes).toBe(60);
  });

  it("groups by the Mauritius day, not the UTC day", () => {
    // 01:30 Mauritius on a Sunday is still Saturday 21:30 UTC.
    const days = computeOvertimeDays([visit("2026-09-20", "01:30", "02:00")]);
    expect(days[0].date).toBe("2026-09-20");
    expect(days[0].minutes).toBe(30);
  });
});

describe("mauritiusMonthRange", () => {
  it("starts at local midnight on the 1st", () => {
    const { start, end } = mauritiusMonthRange("2026-09");
    expect(start.toISOString()).toBe("2026-08-31T20:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T20:00:00.000Z");
  });
});

describe("computeLateByVisit", () => {
  it("flags only the day's first check-in, by the shown time, and never on Sunday", () => {
    const late = computeLateByVisit([
      { id: "a", ...visit("2026-09-14", "08:20", "12:00") },
      { id: "b", ...visit("2026-09-14", "13:30", "17:00") },
      { id: "c", ...visit("2026-09-15", "08:40", "17:00", { checkInDeclaredTime: "08:00" }) },
      { id: "d", ...visit("2026-09-20", "10:00", "11:00") },
    ]);
    expect([...late.entries()]).toEqual([["a", 20]]);
  });
});
