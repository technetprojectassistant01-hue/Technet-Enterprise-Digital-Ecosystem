import { describe, expect, it } from "vitest";
import {
  AUDIT_MATCH_RADIUS_METERS,
  classifyAuditDistance,
  distanceFromCheckIn,
  isStrike,
  scheduleAuditTimes,
} from "./attendanceAudit";

/** A deterministic sequence stand-in for Math.random, so scheduling tests don't flake. */
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("scheduleAuditTimes", () => {
  it("produces between 2 and 4 times", () => {
    const checkInAt = new Date("2026-09-24T04:00:00.000Z");
    for (let i = 0; i < 20; i += 1) {
      const times = scheduleAuditTimes(checkInAt);
      expect(times.length).toBeGreaterThanOrEqual(2);
      expect(times.length).toBeLessThanOrEqual(4);
    }
  });

  it("keeps every time within 30 minutes to 8 hours of check-in", () => {
    const checkInAt = new Date("2026-09-24T04:00:00.000Z");
    for (let i = 0; i < 20; i += 1) {
      const times = scheduleAuditTimes(checkInAt);
      for (const t of times) {
        const offsetMs = t.getTime() - checkInAt.getTime();
        expect(offsetMs).toBeGreaterThanOrEqual(30 * 60 * 1000);
        expect(offsetMs).toBeLessThanOrEqual(8 * 60 * 60 * 1000);
      }
    }
  });

  it("returns times sorted ascending, at least 45 minutes apart", () => {
    const checkInAt = new Date("2026-09-24T04:00:00.000Z");
    for (let i = 0; i < 20; i += 1) {
      const times = scheduleAuditTimes(checkInAt);
      for (let j = 1; j < times.length; j += 1) {
        const gapMs = times[j].getTime() - times[j - 1].getTime();
        expect(gapMs).toBeGreaterThanOrEqual(45 * 60 * 1000);
      }
    }
  });

  it("is deterministic given a fixed random source - never pins a fixed count or fixed offsets by accident", () => {
    const checkInAt = new Date("2026-09-24T04:00:00.000Z");
    // First call picks count (0 -> MIN_AUDITS = 2), then two offsets far enough apart to both land.
    const random = sequence([0, 0.1, 0.9]);
    const times = scheduleAuditTimes(checkInAt, random);
    expect(times).toHaveLength(2);
  });
});

describe("isStrike", () => {
  it("counts a missed audit as a strike", () => {
    expect(isStrike({ status: "MISSED", match: null })).toBe(true);
  });

  it("counts a confirmed-but-mismatched audit as a strike", () => {
    expect(isStrike({ status: "CONFIRMED", match: "MISMATCH" })).toBe(true);
  });

  it("does not count a confirmed-and-matched audit as a strike", () => {
    expect(isStrike({ status: "CONFIRMED", match: "MATCHED" })).toBe(false);
  });

  it("does not count a pending, skipped or cancelled audit as a strike", () => {
    expect(isStrike({ status: "PENDING", match: null })).toBe(false);
    expect(isStrike({ status: "SKIPPED", match: null })).toBe(false);
    expect(isStrike({ status: "CANCELLED", match: null })).toBe(false);
  });
});

describe("classifyAuditDistance", () => {
  it("matches within the audit radius", () => {
    expect(classifyAuditDistance(0)).toBe("MATCHED");
    expect(classifyAuditDistance(AUDIT_MATCH_RADIUS_METERS)).toBe("MATCHED");
  });

  it("flags beyond the audit radius", () => {
    expect(classifyAuditDistance(AUDIT_MATCH_RADIUS_METERS + 1)).toBe("MISMATCH");
  });
});

describe("distanceFromCheckIn", () => {
  it("is zero for an identical fix", () => {
    const point = { lat: -20.1609, lng: 57.5012 };
    expect(distanceFromCheckIn(point, { checkInLat: point.lat, checkInLng: point.lng })).toBe(0);
  });

  it("measures a real separation roughly correctly", () => {
    // Roughly 1km apart along a meridian at this latitude.
    const distance = distanceFromCheckIn(
      { lat: -20.1700, lng: 57.5012 },
      { checkInLat: -20.1609, checkInLng: 57.5012 },
    );
    expect(distance).toBeGreaterThan(900);
    expect(distance).toBeLessThan(1100);
  });
});
