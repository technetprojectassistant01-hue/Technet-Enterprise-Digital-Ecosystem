import { describe, expect, it } from "vitest";
import { payWarnings, summarizeTechnicians, type SummaryInput } from "./attendanceSummary";

/** A Mauritius wall-clock time (UTC+4) as a UTC Date. */
const mu = (day: string, time: string) => new Date(`${day}T${time}:00+04:00`);

const base = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  people: [{ id: "t1", name: "Tech One", expectedFrom: null, expectedDaily: true }],
  from: "2026-09-28", // Monday
  to: "2026-10-03", // Saturday
  today: "2026-10-03",
  visits: [],
  leave: [],
  holidays: new Set(),
  excused: new Set(),
  late: new Map(),
  overtimeDays: [],
  approved: [],
  ...over,
});

describe("summarizeTechnicians", () => {
  it("lists every working day with no check-in for someone who never checked in", () => {
    const [s] = summarizeTechnicians(base());
    expect(s.daysCheckedIn).toBe(0);
    expect(s.noCheckInDays).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(s.firstCheckIn).toBeNull();
  });

  it("skips checked-in days, holidays, leave, excused days, days before they could check in and days after today", () => {
    const [s] = summarizeTechnicians(
      base({
        people: [{ id: "t1", name: "Tech One", expectedFrom: "2026-09-29", expectedDaily: true }],
        today: "2026-10-02",
        visits: [{ id: "v1", employeeId: "t1", checkInAt: mu("2026-09-30", "08:00"), checkOutAt: mu("2026-09-30", "17:00") }],
        holidays: new Set(["2026-10-01"]),
        excused: new Set(["t1|2026-09-29"]),
        leave: [{ employeeId: "t1", from: "2026-10-02", to: "2026-10-02" }],
      }),
    );
    expect(s.noCheckInDays).toEqual([]);
    expect(s.daysCheckedIn).toBe(1);
    expect(s.minutesRecorded).toBe(9 * 60);
  });

  it("gives no no-check-in list to someone not expected to check in daily", () => {
    const [s] = summarizeTechnicians(base({ people: [{ id: "a1", name: "Office", expectedFrom: null, expectedDaily: false }] }));
    expect(s.noCheckInDays).toBeNull();
  });

  it("totals late, calculated and approved overtime, and open visits", () => {
    const [s] = summarizeTechnicians(
      base({
        visits: [
          { id: "v1", employeeId: "t1", checkInAt: mu("2026-09-28", "09:00"), checkOutAt: mu("2026-09-28", "18:00") },
          { id: "v2", employeeId: "t1", checkInAt: mu("2026-10-03", "08:10"), checkOutAt: null },
        ],
        late: new Map([["v1", 30]]),
        overtimeDays: [{ employeeId: "t1", date: "2026-09-28", minutes: 30, firstIn: "09:00", lastOut: "18:00" }],
        approved: [{ employeeId: "t1", date: "2026-09-28", minutes: 25 }],
      }),
    );
    expect(s).toMatchObject({ lateDays: 1, lateMinutes: 30, overtimeMinutes: 30, approvedOvertimeMinutes: 25, openVisits: 1, lastCheckIn: "2026-10-03" });
  });
});

describe("payWarnings", () => {
  const overnight = { id: "v1", employeeId: "t1", checkInAt: mu("2026-09-21", "08:54"), checkOutAt: mu("2026-09-22", "07:54") };
  const normal = { id: "v2", employeeId: "t1", checkInAt: mu("2026-09-23", "08:00"), checkOutAt: mu("2026-09-23", "17:00") };

  it("flags only visits open more than 12 hours", () => {
    const w = payWarnings([normal, overnight], [], []);
    expect(w).toEqual([{ visitId: "v1", employeeId: "t1", day: "2026-09-21", openMinutes: 23 * 60, overtime: null }]);
  });

  it("carries the day's approved overtime, else the pending calculation", () => {
    expect(payWarnings([overnight], [{ employeeId: "t1", date: "2026-09-21", minutes: 1480 }], [])[0].overtime).toEqual({
      minutes: 1480,
      status: "APPROVED",
    });
    const pending = [{ employeeId: "t1", date: "2026-09-21", minutes: 10, firstIn: "08:54", lastOut: "17:40" }];
    expect(payWarnings([overnight], [], pending)[0].overtime).toEqual({ minutes: 10, status: "PENDING" });
  });

  it("ignores visits still open", () => {
    expect(payWarnings([{ ...overnight, checkOutAt: null }], [], [])).toEqual([]);
  });
});
