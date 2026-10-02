import { describe, expect, it } from "vitest";
import { autoCheckoutTime, mauritiusClock } from "./autoCheckout";
import { computeOvertimeDays } from "./overtime";

/** A Mauritius wall-clock time (UTC+4) as a UTC Date. */
const mu = (day: string, time: string) => new Date(`${day}T${time}:00+04:00`);

describe("autoCheckoutTime", () => {
  it("closes a weekday shift at 17:00 the same day", () => {
    // 2026-09-30 is a Wednesday
    expect(autoCheckoutTime(mu("2026-09-30", "08:05")).toISOString()).toBe(mu("2026-09-30", "17:00").toISOString());
  });

  it("closes a Saturday shift at 13:00", () => {
    expect(autoCheckoutTime(mu("2026-10-03", "08:00")).toISOString()).toBe(mu("2026-10-03", "13:00").toISOString());
  });

  it("uses the Mauritius day, not the UTC day", () => {
    // 02:30 Mauritius on the 1st is still the 30th in UTC.
    expect(autoCheckoutTime(mu("2026-10-01", "02:30")).toISOString()).toBe(mu("2026-10-01", "17:00").toISOString());
  });

  it("never closes before the check-in - an evening call-out closes at its check-in time", () => {
    const checkIn = mu("2026-09-30", "19:15");
    expect(autoCheckoutTime(checkIn).toISOString()).toBe(checkIn.toISOString());
  });
});

describe("mauritiusClock", () => {
  it("formats the Mauritius wall-clock time", () => {
    expect(mauritiusClock(mu("2026-09-30", "17:00"))).toBe("17:00");
  });
});

describe("an automatic check-out never creates overtime", () => {
  it("weekday and Saturday", () => {
    for (const [day, inT] of [["2026-09-30", "08:00"], ["2026-10-03", "08:00"]] as const) {
      const out = autoCheckoutTime(mu(day, inT));
      const days = computeOvertimeDays([
        { employeeId: "e1", checkInAt: mu(day, inT), checkInDeclaredTime: null, checkOutAt: out, checkOutDeclaredTime: mauritiusClock(out) },
      ]);
      expect(days).toEqual([]);
    }
  });
});
