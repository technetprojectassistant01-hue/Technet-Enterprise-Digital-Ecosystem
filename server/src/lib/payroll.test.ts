import { describe, expect, it } from "vitest";
import { computeNetPay, sumApprovedOvertimeHours, sumWorkedHours } from "./payroll";

const at = (iso: string) => new Date(iso);

describe("sumWorkedHours", () => {
  it("adds up finished visits", () => {
    expect(
      sumWorkedHours([
        { checkInAt: at("2026-09-01T04:00:00Z"), checkOutAt: at("2026-09-01T12:00:00Z") },
        { checkInAt: at("2026-09-02T04:00:00Z"), checkOutAt: at("2026-09-02T08:30:00Z") },
      ]),
    ).toBe(12.5);
  });

  it("ignores a visit that has not been checked out of", () => {
    expect(
      sumWorkedHours([
        { checkInAt: at("2026-09-01T04:00:00Z"), checkOutAt: at("2026-09-01T12:00:00Z") },
        { checkInAt: at("2026-09-02T04:00:00Z"), checkOutAt: null },
      ]),
    ).toBe(8);
  });

  it("never subtracts time when a check-out precedes its check-in", () => {
    expect(
      sumWorkedHours([{ checkInAt: at("2026-09-01T12:00:00Z"), checkOutAt: at("2026-09-01T04:00:00Z") }]),
    ).toBe(0);
  });

  it("is zero for a month with no visits", () => {
    expect(sumWorkedHours([])).toBe(0);
  });
});

describe("sumApprovedOvertimeHours", () => {
  it("converts approved minutes to hours", () => {
    expect(sumApprovedOvertimeHours([{ minutes: 90 }, { minutes: 30 }])).toBe(2);
  });

  it("is zero when nothing has been approved", () => {
    expect(sumApprovedOvertimeHours([])).toBe(0);
  });
});

describe("computeNetPay", () => {
  it("returns the full salary with no deduction when no unpaid leave was taken", () => {
    expect(computeNetPay(30000, 0, 30)).toEqual({ deduction: 0, netPay: 30000 });
  });

  it("pro-rates a deduction for unpaid leave days across the month", () => {
    expect(computeNetPay(30000, 3, 30)).toEqual({ deduction: 3000, netPay: 27000 });
  });

  it("never deducts more than the full basic salary", () => {
    expect(computeNetPay(30000, 60, 30)).toEqual({ deduction: 30000, netPay: 0 });
  });

  it("treats a zero-day month as zero deduction rather than dividing by zero", () => {
    expect(computeNetPay(30000, 3, 0)).toEqual({ deduction: 0, netPay: 30000 });
  });
});
