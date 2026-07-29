import { describe, expect, it } from "vitest";
import { formatInterventionNumber } from "./interventionNumber";

describe("formatInterventionNumber", () => {
  it("zero-pads small sequence numbers to 6 digits", () => {
    expect(formatInterventionNumber(1)).toBe("INT-000001");
  });

  it("pads right up to the 6-digit boundary", () => {
    expect(formatInterventionNumber(999999)).toBe("INT-999999");
  });

  it("does not truncate sequence numbers beyond 6 digits", () => {
    expect(formatInterventionNumber(1000000)).toBe("INT-1000000");
  });
});
