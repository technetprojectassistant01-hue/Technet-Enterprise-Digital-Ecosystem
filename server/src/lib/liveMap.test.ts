import { describe, expect, it } from "vitest";
import { liveStatus } from "./liveMap";

const base = { openSeverities: [], distanceFromCheckInMeters: 40, minutesSinceLastFix: 10 } as Parameters<typeof liveStatus>[0];

describe("liveStatus", () => {
  it("is green when close to the check-in, recently seen and nothing open", () => {
    expect(liveStatus(base)).toBe("GREEN");
  });

  it("is red with an open high-severity anomaly", () => {
    expect(liveStatus({ ...base, openSeverities: ["HIGH"] })).toBe("RED");
  });

  it("is red when the latest reading is more than 500 m from the check-in", () => {
    expect(liveStatus({ ...base, distanceFromCheckInMeters: 800 })).toBe("RED");
  });

  it("is amber with an open medium anomaly (including the old STANDARD level)", () => {
    expect(liveStatus({ ...base, openSeverities: ["MEDIUM"] })).toBe("AMBER");
    expect(liveStatus({ ...base, openSeverities: ["STANDARD"] })).toBe("AMBER");
  });

  it("is amber when not seen for more than 45 minutes", () => {
    expect(liveStatus({ ...base, minutesSinceLastFix: 60 })).toBe("AMBER");
  });

  it("ignores low-severity anomalies", () => {
    expect(liveStatus({ ...base, openSeverities: ["LOW"] })).toBe("GREEN");
  });

  it("puts red above amber", () => {
    expect(liveStatus({ openSeverities: ["MEDIUM"], distanceFromCheckInMeters: 900, minutesSinceLastFix: 90 })).toBe("RED");
  });
});
