import { describe, expect, it } from "vitest";
import { parseClockTime } from "./clockTime";

describe("parseClockTime", () => {
  it("accepts a zero-padded time", () => {
    expect(parseClockTime("08:30")).toBe("08:30");
  });

  it("zero-pads a single-digit hour", () => {
    expect(parseClockTime("8:30")).toBe("08:30");
  });

  it("trims surrounding whitespace", () => {
    expect(parseClockTime("  09:05  ")).toBe("09:05");
  });

  it("accepts the edges of the day", () => {
    expect(parseClockTime("00:00")).toBe("00:00");
    expect(parseClockTime("23:59")).toBe("23:59");
  });

  it("rejects an out-of-range hour or minute", () => {
    expect(parseClockTime("24:00")).toBeNull();
    expect(parseClockTime("12:60")).toBeNull();
  });

  it("rejects anything that isn't HH:MM", () => {
    expect(parseClockTime("0830")).toBeNull();
    expect(parseClockTime("8.30")).toBeNull();
    expect(parseClockTime("08:30:00")).toBeNull();
    expect(parseClockTime("half eight")).toBeNull();
    expect(parseClockTime("")).toBeNull();
  });

  it("rejects non-strings rather than coercing them", () => {
    expect(parseClockTime(830)).toBeNull();
    expect(parseClockTime(null)).toBeNull();
    expect(parseClockTime(undefined)).toBeNull();
    expect(parseClockTime({ hours: 8 })).toBeNull();
  });
});
