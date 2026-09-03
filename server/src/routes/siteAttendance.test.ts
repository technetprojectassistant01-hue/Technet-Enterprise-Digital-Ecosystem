import { describe, expect, it } from "vitest";
import { parseDeclaredTime, parseTransportCost } from "./siteAttendance";

describe("parseTransportCost", () => {
  it("treats absent, null and blank as no cost - the field is optional", () => {
    expect(parseTransportCost(undefined)).toEqual({ value: null });
    expect(parseTransportCost(null)).toEqual({ value: null });
    expect(parseTransportCost("")).toEqual({ value: null });
  });

  it("accepts a real number", () => {
    expect(parseTransportCost(250)).toEqual({ value: 250 });
    expect(parseTransportCost(0)).toEqual({ value: 0 });
  });

  /**
   * The regression guard. A form sends e.target.value, so this arrives as a string, and
   * Number.isFinite("250") is false - the exact shape that silently rejected every real
   * quotation payment-terms submission (CLAUDE.md §9).
   */
  it("accepts a numeric string, because that is what a form actually sends", () => {
    expect(parseTransportCost("250")).toEqual({ value: 250 });
    expect(parseTransportCost(" 250.50 ")).toEqual({ value: 250.5 });
  });

  it("rounds to two decimal places", () => {
    expect(parseTransportCost(250.567)).toEqual({ value: 250.57 });
  });

  it("rejects a negative amount", () => {
    expect(parseTransportCost(-1)).toEqual({ error: "Transport cost cannot be negative" });
  });

  it("rejects junk rather than storing NaN", () => {
    expect(parseTransportCost("abc")).toEqual({ error: "Transport cost must be a number" });
    expect(parseTransportCost({})).toEqual({ error: "Transport cost must be a number" });
    expect(parseTransportCost(Number.NaN)).toEqual({ error: "Transport cost must be a number" });
  });

  it("rejects an implausibly large amount as a likely typo", () => {
    const result = parseTransportCost(1_000_000);
    expect("error" in result).toBe(true);
  });
});

describe("parseDeclaredTime", () => {
  it("treats absent, null and blank as no time given", () => {
    expect(parseDeclaredTime(undefined)).toEqual({ value: null });
    expect(parseDeclaredTime(null)).toEqual({ value: null });
    expect(parseDeclaredTime("")).toEqual({ value: null });
  });

  it("normalises a valid time", () => {
    expect(parseDeclaredTime("8:05")).toEqual({ value: "08:05" });
    expect(parseDeclaredTime("17:30")).toEqual({ value: "17:30" });
  });

  it("rejects a malformed time instead of dropping it silently", () => {
    expect(parseDeclaredTime("25:00")).toEqual({ error: "Time must be in HH:MM format" });
    expect(parseDeclaredTime("0830")).toEqual({ error: "Time must be in HH:MM format" });
  });
});
