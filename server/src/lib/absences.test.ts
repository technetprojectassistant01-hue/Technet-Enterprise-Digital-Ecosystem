import { describe, expect, it } from "vitest";
import { computeAbsences, workingDays, type AbsenceInput } from "./absences";

// 2026-10-01 is a Thursday; 10-04 is a Sunday.
const base = (over: Partial<AbsenceInput> = {}): AbsenceInput => ({
  employees: [{ id: "e1", hireDate: null }],
  from: "2026-10-01",
  to: "2026-10-06",
  today: "2026-10-06",
  checkedIn: new Set(),
  leave: [],
  holidays: new Set(),
  excuses: new Map(),
  ...over,
});
const days = (input: AbsenceInput) => computeAbsences(input).map((a) => a.date);

describe("workingDays", () => {
  it("skips Sundays and includes Saturdays", () => {
    expect(workingDays("2026-10-01", "2026-10-06")).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"]);
  });
});

describe("computeAbsences", () => {
  it("marks every working day with no check-in absent, including today", () => {
    expect(days(base())).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"]);
  });

  it("clears a day as soon as there is a check-in, at any time", () => {
    expect(days(base({ checkedIn: new Set(["e1|2026-10-02", "e1|2026-10-06"]) }))).toEqual(["2026-10-01", "2026-10-03", "2026-10-05"]);
  });

  it("never marks days after today", () => {
    expect(days(base({ today: "2026-10-02" }))).toEqual(["2026-10-01", "2026-10-02"]);
  });

  it("starts on 2026-10-01, when the rule was introduced", () => {
    expect(days(base({ from: "2026-09-28", to: "2026-10-01", today: "2026-10-01" }))).toEqual(["2026-10-01"]);
  });

  it("skips public holidays and approved leave", () => {
    const out = days(
      base({
        holidays: new Set(["2026-10-02"]),
        leave: [{ employeeId: "e1", from: "2026-10-05", to: "2026-10-06" }],
      }),
    );
    expect(out).toEqual(["2026-10-01", "2026-10-03"]);
  });

  it("skips days before the hire date", () => {
    expect(days(base({ employees: [{ id: "e1", hireDate: "2026-10-05" }] }))).toEqual(["2026-10-05", "2026-10-06"]);
  });

  it("shows an excused day as EXCUSED with HR's note", () => {
    const out = computeAbsences(base({ excuses: new Map([["e1|2026-10-01", "Sick - certificate received"]]) }));
    expect(out[0]).toEqual({ employeeId: "e1", date: "2026-10-01", status: "EXCUSED", note: "Sick - certificate received" });
    expect(out[1].status).toBe("ABSENT");
  });

  it("handles several employees independently", () => {
    const out = computeAbsences(
      base({
        employees: [
          { id: "a", hireDate: null },
          { id: "b", hireDate: null },
        ],
        to: "2026-10-01",
        today: "2026-10-01",
        checkedIn: new Set(["a|2026-10-01"]),
      }),
    );
    expect(out.map((a) => a.employeeId)).toEqual(["b"]);
  });
});
