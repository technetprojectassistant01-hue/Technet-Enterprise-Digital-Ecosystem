import { describe, expect, it } from "vitest";
import { nextQuotationSuffix, quotationNumberPrefix } from "./quotationNumber";

const PREFIX = "Q20260903-";

describe("quotationNumberPrefix", () => {
  it("formats the day as Q<YYYYMMDD>-", () => {
    expect(quotationNumberPrefix(new Date(2026, 8, 3))).toBe("Q20260903-");
  });

  it("zero-pads single-digit months and days", () => {
    expect(quotationNumberPrefix(new Date(2026, 0, 7))).toBe("Q20260107-");
  });
});

describe("nextQuotationSuffix", () => {
  it("starts at 1 when nothing has been issued today", () => {
    expect(nextQuotationSuffix([], PREFIX)).toBe(1);
  });

  it("continues from the highest number issued", () => {
    expect(nextQuotationSuffix([`${PREFIX}01`, `${PREFIX}02`], PREFIX)).toBe(3);
  });

  /** The regression this function exists for - see the doc comment in quotationNumber.ts. */
  it("does not reuse a deleted number in the middle of the day", () => {
    // Q-02 was deleted. Counting rows would give 2 + 1 = 3, colliding with the live Q-03.
    expect(nextQuotationSuffix([`${PREFIX}01`, `${PREFIX}03`], PREFIX)).toBe(4);
  });

  it("keeps climbing after the most recent number is deleted", () => {
    // Q-03 was the highest and is now gone; 3 must not be handed out again.
    expect(nextQuotationSuffix([`${PREFIX}01`, `${PREFIX}02`], PREFIX)).toBe(3);
  });

  it("compares numerically, not as strings, past the two-digit boundary", () => {
    expect(nextQuotationSuffix([`${PREFIX}09`, `${PREFIX}10`], PREFIX)).toBe(11);
    expect(nextQuotationSuffix([`${PREFIX}99`, `${PREFIX}100`], PREFIX)).toBe(101);
  });

  it("ignores numbers belonging to another day", () => {
    expect(nextQuotationSuffix(["Q20260902-07", `${PREFIX}01`], PREFIX)).toBe(2);
  });

  it("ignores a malformed suffix rather than throwing", () => {
    expect(nextQuotationSuffix([`${PREFIX}draft`, `${PREFIX}02`], PREFIX)).toBe(3);
  });
});
