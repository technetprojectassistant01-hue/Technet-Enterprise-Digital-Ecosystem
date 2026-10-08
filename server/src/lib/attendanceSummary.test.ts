import { describe, expect, it } from "vitest";
import { payWarnings, summarizeTechnicians, type SummaryInput } from "./attendanceSummary";

/** A Mauritius wall-clock time (UTC+4) as a UTC Date. */
const mu = (day: string, time: string) => new Date(`${day}T${time}:00+04:00`);

const base = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  people: [{ id: "t1", name: "Tech One", code: "006", department: null, expectedFrom: null, expectedDaily: true }],
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
        people: [{ id: "t1", name: "Tech One", code: "006", department: null, expectedFrom: "2026-09-29", expectedDaily: true }],
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
    const [s] = summarizeTechnicians(base({ people: [{ id: "a1", name: "Office", code: null, department: null, expectedFrom: null, expectedDaily: false }] }));
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

describe("summarizeTechnicians - the AiFace report columns", () => {
  // Mon 28 Sept - Sat 3 Oct 2026; Thu 1 Oct a public holiday, Fri 2 Oct on leave.
  const week = (over: Partial<SummaryInput> = {}) =>
    summarizeTechnicians(
      base({
        holidays: new Set(["2026-10-01"]),
        leave: [{ employeeId: "t1", from: "2026-10-02", to: "2026-10-02" }],
        visits: [
          // Mon: 08:40-12:00 then 13:00-16:30 - late 10 min, leaves 30 min early.
          { id: "a", employeeId: "t1", checkInAt: mu("2026-09-28", "08:40"), checkOutAt: mu("2026-09-28", "12:00") },
          { id: "b", employeeId: "t1", checkInAt: mu("2026-09-28", "13:00"), checkOutAt: mu("2026-09-28", "16:30") },
          // Tue: checked out the next morning - not early leave.
          { id: "c", employeeId: "t1", checkInAt: mu("2026-09-29", "08:00"), checkOutAt: mu("2026-09-30", "07:00") },
        ],
        late: new Map([["a", 10]]),
        ...over,
      }),
    )[0];

  it("counts should, absence, holiday and leave days with their shift hours", () => {
    const s = week();
    expect(s.shouldDays).toBe(5); // Mon-Sat minus the holiday
    expect(s.shouldMinutes).toBe(4 * 540 + 300);
    expect(s.noCheckInDays).toEqual(["2026-09-30", "2026-10-03"]);
    expect(s.absenceMinutes).toBe(540 + 300);
    expect(s).toMatchObject({ holidayDays: 1, holidayMinutes: 540, leaveDays: 1, leaveMinutes: 540 });
  });

  it("counts early leave from the day's last recorded check-out, never a next-day one", () => {
    const s = week();
    expect(s).toMatchObject({ earlyTimes: 1, earlyMinutes: 30 });
  });

  it("counts no early leave on a public holiday someone worked", () => {
    const s = week({ holidays: new Set(["2026-09-28"]) });
    expect(s).toMatchObject({ earlyTimes: 0, earlyMinutes: 0 });
    expect(s.daily[0].status).toBe("PRESENT");
  });

  it("lists every day with its shift, In/Out pairs and status", () => {
    const d = week().daily;
    expect(d.map((r) => r.status)).toEqual(["PRESENT", "PRESENT", "ABSENT", "HOLIDAY", "LEAVE", "ABSENT"]);
    expect(d[0]).toMatchObject({
      shift: "08:00-17:00",
      punches: [
        { in: "08:40", out: "12:00", outNextDay: false },
        { in: "13:00", out: "16:30", outNextDay: false },
      ],
      minutes: 200 + 210,
      lateMinutes: 10,
      earlyMinutes: 30,
    });
    expect(d[1].punches[0]).toEqual({ in: "08:00", out: "07:00", outNextDay: true });
    expect(d[5].shift).toBe("08:00-13:00");
  });

  it("shows a Sunday as a rest day, and only check-in days for someone not expected daily", () => {
    const sunday = summarizeTechnicians(base({ from: "2026-10-04", to: "2026-10-04", today: "2026-10-04" }))[0];
    expect(sunday.daily).toEqual([expect.objectContaining({ day: "2026-10-04", shift: null, status: "REST" })]);
    expect(sunday.shouldDays).toBe(0);
    const office = summarizeTechnicians(
      base({
        people: [{ id: "a1", name: "Office", code: null, department: null, expectedFrom: null, expectedDaily: false }],
        visits: [{ id: "v", employeeId: "a1", checkInAt: mu("2026-09-29", "09:00"), checkOutAt: mu("2026-09-29", "17:00") }],
      }),
    )[0];
    expect(office.daily.map((r) => r.day)).toEqual(["2026-09-29"]);
    expect(office.shouldDays).toBeNull();
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
