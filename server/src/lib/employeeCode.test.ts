import { describe, expect, it } from "vitest";
import { nextEmployeeCode } from "./employeeCode";

describe("nextEmployeeCode", () => {
  it("starts at 001 when there are no employees yet", () => {
    expect(nextEmployeeCode([])).toBe("001");
  });

  it("continues from the highest code on file", () => {
    expect(nextEmployeeCode(["001", "002", "003"])).toBe("004");
  });

  it("does not reuse a deleted code", () => {
    // 002 was deleted. Counting rows would give 2 + 1 = "003", colliding with the live 003.
    expect(nextEmployeeCode(["001", "003"])).toBe("004");
  });

  it("ignores non-numeric codes (test data, legacy imports) rather than breaking the scan", () => {
    expect(nextEmployeeCode(["001", "SCRATCH2-1787130449441", "004"])).toBe("005");
  });

  it("keeps growing past three digits without truncating", () => {
    expect(nextEmployeeCode(["999"])).toBe("1000");
  });
});
