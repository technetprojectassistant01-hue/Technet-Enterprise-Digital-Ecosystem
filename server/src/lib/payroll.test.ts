import { describe, expect, it } from "vitest";
import { computeNetPay } from "./payroll";

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
