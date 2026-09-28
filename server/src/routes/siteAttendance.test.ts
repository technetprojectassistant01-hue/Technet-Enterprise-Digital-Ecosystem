import { describe, expect, it } from "vitest";
import { parseDeclaredTime, parseFixMeta, parseTransportCost } from "./siteAttendance";

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

describe("parseFixMeta", () => {
  const now = new Date("2026-09-28T06:00:00Z");

  it("rounds the accuracy and keeps the device time", () => {
    const fix = parseFixMeta({ accuracy: 12.6, deviceTime: now.getTime() - 5_000 }, now);
    expect(fix.accuracyMeters).toBe(13);
    expect(fix.deviceAt?.toISOString()).toBe("2026-09-28T05:59:55.000Z");
  });

  it("accepts an ISO string device time", () => {
    expect(parseFixMeta({ deviceTime: "2026-09-28T05:00:00Z" }, now).deviceAt?.toISOString()).toBe("2026-09-28T05:00:00.000Z");
  });

  it("returns nulls when nothing is sent - an older app version must still check in", () => {
    expect(parseFixMeta({}, now)).toEqual({ accuracyMeters: null, deviceAt: null });
    expect(parseFixMeta(undefined, now)).toEqual({ accuracyMeters: null, deviceAt: null });
  });

  it("drops junk instead of rejecting", () => {
    expect(parseFixMeta({ accuracy: -1, deviceTime: "not a date" }, now)).toEqual({ accuracyMeters: null, deviceAt: null });
    expect(parseFixMeta({ accuracy: "20" }, now).accuracyMeters).toBeNull();
  });

  it("keeps an accuracy of exactly 0 - a mock-location signal the anomaly rules need to see", () => {
    expect(parseFixMeta({ accuracy: 0 }, now).accuracyMeters).toBe(0);
  });

  it("caps an absurd accuracy", () => {
    expect(parseFixMeta({ accuracy: 5_000_000 }, now).accuracyMeters).toBe(100_000);
  });

  it("drops a device time more than 30 days away from the server clock", () => {
    expect(parseFixMeta({ deviceTime: "2020-01-01T00:00:00Z" }, now).deviceAt).toBeNull();
  });
});
