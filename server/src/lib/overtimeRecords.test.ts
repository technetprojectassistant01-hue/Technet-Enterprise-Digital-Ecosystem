import { describe, expect, it } from "vitest";
import { parseOvertimeRecord, recordMinutes, withManualRecords } from "./overtimeRecords";

const TODAY = "2026-10-19";
const valid = { employeeId: "e1", date: "2026-10-17", type: "NORMAL", startTime: "17:30", endTime: "20:00", reason: "Urgent repair at Ebene" };

describe("recordMinutes", () => {
  it("counts start to end", () => {
    expect(recordMinutes("17:30", "20:00")).toBe(150);
  });

  it("runs past midnight when the end is earlier than the start", () => {
    expect(recordMinutes("22:00", "01:30")).toBe(210);
  });
});

describe("parseOvertimeRecord", () => {
  it("accepts a valid record and works out the minutes", () => {
    const result = parseOvertimeRecord(valid, TODAY);
    expect(result).toEqual({ value: { ...valid, minutes: 150 } });
  });

  it("trims the reason and requires one", () => {
    expect(parseOvertimeRecord({ ...valid, reason: "  Call-out  " }, TODAY)).toMatchObject({ value: { reason: "Call-out" } });
    expect(parseOvertimeRecord({ ...valid, reason: "   " }, TODAY)).toEqual({ error: "Give a reason for the overtime" });
  });

  it("refuses a future day but allows today", () => {
    expect(parseOvertimeRecord({ ...valid, date: "2026-10-20" }, TODAY)).toHaveProperty("error");
    expect(parseOvertimeRecord({ ...valid, date: TODAY }, TODAY)).toHaveProperty("value");
  });

  it("refuses an unknown type, bad times and a zero-length record", () => {
    expect(parseOvertimeRecord({ ...valid, type: "WEEKEND" }, TODAY)).toHaveProperty("error");
    expect(parseOvertimeRecord({ ...valid, startTime: "5:30" }, TODAY)).toHaveProperty("error");
    expect(parseOvertimeRecord({ ...valid, endTime: "24:00" }, TODAY)).toHaveProperty("error");
    expect(parseOvertimeRecord({ ...valid, endTime: "17:30" }, TODAY)).toHaveProperty("error");
  });

  it("requires the employee and a real date", () => {
    expect(parseOvertimeRecord({ ...valid, employeeId: "" }, TODAY)).toHaveProperty("error");
    expect(parseOvertimeRecord({ ...valid, date: "17/10/2026" }, TODAY)).toHaveProperty("error");
    expect(parseOvertimeRecord(null, TODAY)).toHaveProperty("error");
  });
});

describe("withManualRecords", () => {
  const calculated = [
    { employeeId: "e1", date: "2026-10-17", minutes: 1400, firstIn: "08:00", lastOut: "07:10" },
    { employeeId: "e2", date: "2026-10-17", minutes: 30, firstIn: "08:00", lastOut: "18:00" },
  ];

  it("replaces the calculated overtime of the same employee-day", () => {
    const days = withManualRecords(calculated, [{ employeeId: "e1", date: "2026-10-17", minutes: 150, startTime: "17:30", endTime: "20:00" }]);
    expect(days).toContainEqual({ employeeId: "e1", date: "2026-10-17", minutes: 150, firstIn: "17:30", lastOut: "20:00" });
    expect(days).toContainEqual(calculated[1]);
    expect(days).toHaveLength(2);
  });

  it("adds a day the app had no overtime for", () => {
    const days = withManualRecords(calculated, [{ employeeId: "e3", date: "2026-10-18", minutes: 240, startTime: "08:00", endTime: "12:00" }]);
    expect(days).toHaveLength(3);
    expect(days[0]).toEqual({ employeeId: "e3", date: "2026-10-18", minutes: 240, firstIn: "08:00", lastOut: "12:00" });
  });
});
