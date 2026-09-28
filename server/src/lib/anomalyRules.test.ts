import { describe, expect, it } from "vitest";
import { distanceMeters } from "./geo";
import {
  checkInNearHome,
  clockSkew,
  farFromJob,
  impossibleTravel,
  leftWorkArea,
  lowAccuracy,
  missedPings,
  mockLocation,
  statedLocationMismatch,
  timeMismatch,
  type Fix,
} from "./anomalyRules";

// Pailles, near Technet's office, and points offset from it. 0.001 deg latitude ~ 111 m.
const BASE = { lat: -20.1920, lng: 57.5140 };
const at = (iso: string) => new Date(iso);
const fix = (key: string, kind: Fix["kind"], iso: string, dLat = 0, accuracy: number | null = 10, dLng = 0): Fix => ({
  key,
  kind,
  at: at(iso),
  lat: BASE.lat + dLat,
  lng: BASE.lng + dLng,
  accuracyMeters: accuracy,
});

describe("distanceMeters (haversine)", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(BASE.lat, BASE.lng, BASE.lat, BASE.lng)).toBe(0);
  });

  it("gives ~111 m for 0.001 degrees of latitude", () => {
    const d = distanceMeters(BASE.lat, BASE.lng, BASE.lat + 0.001, BASE.lng);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it("measures Port Louis to Mahebourg at roughly 40 km", () => {
    const d = distanceMeters(-20.1609, 57.5012, -20.4081, 57.7);
    expect(d).toBeGreaterThan(33_000);
    expect(d).toBeLessThan(36_000);
  });
});

describe("farFromJob", () => {
  const checkIn = fix("checkin", "CHECK_IN", "2026-09-28T04:00:00Z");

  it("does nothing without a linked job", () => {
    expect(farFromJob(checkIn, null)).toEqual([]);
  });

  it("is quiet within 500 m", () => {
    expect(farFromJob(checkIn, { id: "wo", lat: BASE.lat + 0.004, lng: BASE.lng })).toEqual([]);
  });

  it("flags high beyond 500 m", () => {
    const [f] = farFromJob(checkIn, { id: "wo", lat: BASE.lat + 0.006, lng: BASE.lng });
    expect(f.type).toBe("FAR_FROM_JOB");
    expect(f.severity).toBe("HIGH");
    expect(f.details.distanceMeters).toBeGreaterThan(500);
  });
});

describe("checkInNearHome", () => {
  const checkIn = fix("checkin", "CHECK_IN", "2026-09-28T04:00:00Z");
  const home = { lat: BASE.lat + 0.001, lng: BASE.lng };

  it("never fires without a home location", () => {
    expect(checkInNearHome(checkIn, null, [])).toEqual([]);
  });

  it("flags a check-in within 300 m of home", () => {
    expect(checkInNearHome(checkIn, home, [])[0]?.type).toBe("CHECKIN_NEAR_HOME");
  });

  it("stays quiet when that day's job is at the home address", () => {
    expect(checkInNearHome(checkIn, home, [home])).toEqual([]);
  });

  it("stays quiet far from home", () => {
    expect(checkInNearHome(checkIn, { lat: BASE.lat + 0.01, lng: BASE.lng }, [])).toEqual([]);
  });
});

describe("leftWorkArea", () => {
  const anchor = fix("checkin", "CHECK_IN", "2026-09-28T04:00:00Z");

  it("flags an audit fix more than 500 m from the check-in", () => {
    const out = leftWorkArea(anchor, [fix("audit:1", "AUDIT", "2026-09-28T06:00:00Z", 0.006)]);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("MEDIUM");
    expect(out[0].key).toBe("audit:1");
  });

  it("counts shift pings as well as audit pings", () => {
    expect(leftWorkArea(anchor, [fix("ping:1", "PING", "2026-09-28T05:00:00Z", 0.006)])[0]?.key).toBe("ping:1");
  });

  it("ignores fixes within 500 m, and non-audit fixes", () => {
    expect(leftWorkArea(anchor, [fix("audit:1", "AUDIT", "2026-09-28T06:00:00Z", 0.003)])).toEqual([]);
    expect(leftWorkArea(anchor, [fix("checkout", "CHECK_OUT", "2026-09-28T09:00:00Z", 0.05)])).toEqual([]);
  });
});

describe("impossibleTravel", () => {
  it("flags 10 km in 2 minutes", () => {
    const out = impossibleTravel([
      fix("a", "CHECK_IN", "2026-09-28T04:00:00Z"),
      fix("b", "AUDIT", "2026-09-28T04:02:00Z", 0.09),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("IMPOSSIBLE_TRAVEL");
    expect(out[0].key).toBe("a>b");
  });

  it("allows 10 km in 30 minutes (20 km/h)", () => {
    expect(impossibleTravel([fix("a", "CHECK_IN", "2026-09-28T04:00:00Z"), fix("b", "AUDIT", "2026-09-28T04:30:00Z", 0.09)])).toEqual([]);
  });

  it("does not mistake GPS drift between fixes seconds apart for travel", () => {
    expect(impossibleTravel([fix("a", "CHECK_IN", "2026-09-28T04:00:00Z"), fix("b", "AUDIT", "2026-09-28T04:00:05Z", 0.003)])).toEqual([]);
  });

  it("does not flag a jump smaller than the two fixes' own accuracy", () => {
    expect(
      impossibleTravel([fix("a", "CHECK_IN", "2026-09-28T04:00:00Z", 0, 1500), fix("b", "AUDIT", "2026-09-28T04:01:00Z", 0.02, 1500)]),
    ).toEqual([]);
  });

  it("checks across visits in time order, whatever order they arrive in", () => {
    const out = impossibleTravel([
      fix("v2-in", "CHECK_IN", "2026-09-28T09:05:00Z", 0.2),
      fix("v1-out", "CHECK_OUT", "2026-09-28T09:00:00Z"),
    ]);
    expect(out[0]?.key).toBe("v1-out>v2-in");
  });
});

describe("mockLocation", () => {
  it("flags an accuracy of exactly 0", () => {
    const out = mockLocation([fix("a", "CHECK_IN", "2026-09-28T04:00:00Z", 0, 0)]);
    expect(out[0]?.details.reason).toBe("ZERO_ACCURACY");
  });

  it("does not treat an unknown accuracy as 0", () => {
    expect(mockLocation([fix("a", "AUDIT", "2026-09-28T04:00:00Z", 0, null)])).toEqual([]);
  });

  it("flags five identical fixes in a row, but not four", () => {
    const five = [0, 1, 2, 3, 4].map((i) => fix(`f${i}`, "AUDIT", `2026-09-28T0${4 + i}:00:00Z`));
    expect(mockLocation(five).map((f) => f.details.reason)).toEqual(["IDENTICAL_FIXES"]);
    expect(mockLocation(five.slice(0, 4))).toEqual([]);
  });

  it("does not count coarse Wi-Fi readings that honestly repeat the same point", () => {
    const five = [0, 1, 2, 3, 4].map((i) => fix(`p${i}`, "PING", `2026-09-28T0${4 + i}:00:00Z`, 0, 120));
    expect(mockLocation(five)).toEqual([]);
  });

  it("flags a jump away and back within minutes", () => {
    const out = mockLocation([
      fix("a", "CHECK_IN", "2026-09-28T04:00:00Z"),
      fix("b", "AUDIT", "2026-09-28T04:03:00Z", 0.02),
      fix("c", "AUDIT", "2026-09-28T04:06:00Z", 0.0005),
    ]);
    expect(out.map((f) => f.details.reason)).toEqual(["JUMP_AND_BACK"]);
  });

  it("does not flag an away-and-back over hours", () => {
    expect(
      mockLocation([
        fix("a", "CHECK_IN", "2026-09-28T04:00:00Z"),
        fix("b", "AUDIT", "2026-09-28T06:00:00Z", 0.02),
        fix("c", "CHECK_OUT", "2026-09-28T09:00:00Z"),
      ]),
    ).toEqual([]);
  });
});

describe("lowAccuracy", () => {
  it("flags worse than 200 m as low severity", () => {
    expect(lowAccuracy(fix("a", "CHECK_IN", "2026-09-28T04:00:00Z", 0, 350))[0]?.severity).toBe("LOW");
  });

  it("is quiet at 200 m or better, and when unknown", () => {
    expect(lowAccuracy(fix("a", "CHECK_IN", "2026-09-28T04:00:00Z", 0, 200))).toEqual([]);
    expect(lowAccuracy(fix("a", "CHECK_IN", "2026-09-28T04:00:00Z", 0, null))).toEqual([]);
  });
});

describe("clockSkew", () => {
  const server = at("2026-09-28T04:00:00Z");

  it("flags a phone clock more than 5 minutes off", () => {
    expect(clockSkew("checkin", at("2026-09-28T04:07:00Z"), server)[0]?.details.skewMinutes).toBe(7);
    expect(clockSkew("checkin", at("2026-09-28T03:50:00Z"), server)[0]?.details.skewMinutes).toBe(-10);
  });

  it("is quiet within 5 minutes, and when the phone didn't say", () => {
    expect(clockSkew("checkin", at("2026-09-28T04:04:00Z"), server)).toEqual([]);
    expect(clockSkew("checkin", null, server)).toEqual([]);
  });
});

describe("timeMismatch", () => {
  // 04:00Z is 08:00 in Mauritius.
  const recorded = at("2026-09-28T04:00:00Z");

  it("flags a typed time more than 15 minutes from the recorded one", () => {
    expect(timeMismatch("checkin", "07:30", recorded, null)[0]?.details.gapMinutes).toBe(30);
  });

  it("is quiet within 15 minutes, and with no typed time", () => {
    expect(timeMismatch("checkin", "08:10", recorded, null)).toEqual([]);
    expect(timeMismatch("checkin", null, recorded, null)).toEqual([]);
  });

  it("goes the short way round midnight", () => {
    expect(timeMismatch("checkout", "23:55", at("2026-09-28T20:05:00Z"), null)).toEqual([]);
  });

  it("does not flag an offline check-in whose typed time matches when the phone took the fix", () => {
    const syncedLater = at("2026-09-28T05:30:00Z");
    expect(timeMismatch("checkin", "08:00", syncedLater, at("2026-09-28T04:00:00Z"))).toEqual([]);
  });

  it("still flags when the typed time matches neither", () => {
    const syncedLater = at("2026-09-28T05:30:00Z");
    expect(timeMismatch("checkin", "07:00", syncedLater, at("2026-09-28T04:00:00Z"))).toHaveLength(1);
  });
});

describe("statedLocationMismatch", () => {
  it("flags a typed place more than 2 km from the GPS", () => {
    expect(statedLocationMismatch("checkin", "Ebene", 5600)[0]?.type).toBe("STATED_LOCATION_MISMATCH");
  });

  it("is quiet within 2 km, with nothing typed, or when it couldn't be looked up", () => {
    expect(statedLocationMismatch("checkin", "Pailles", 1100)).toEqual([]);
    expect(statedLocationMismatch("checkin", null, 9000)).toEqual([]);
    expect(statedLocationMismatch("checkin", "Office", null)).toEqual([]);
  });
});

describe("missedPings", () => {
  const checkIn = at("2026-09-28T04:00:00Z");

  it("is quiet when readings are never more than 45 minutes apart", () => {
    const pings = ["04:15", "04:30", "05:10", "05:50"].map((t) => at(`2026-09-28T${t}:00Z`));
    expect(missedPings(checkIn, pings, at("2026-09-28T06:30:00Z"))).toEqual([]);
  });

  it("flags each gap over 45 minutes, keyed by when it started", () => {
    const out = missedPings(checkIn, [at("2026-09-28T04:15:00Z"), at("2026-09-28T06:00:00Z")], at("2026-09-28T06:10:00Z"));
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("LOW");
    expect(out[0].key).toBe("gap:2026-09-28T04:15:00.000Z");
    expect(out[0].details.minutes).toBe(105);
  });

  it("counts a still-open shift up to now, with a key that stays the same as the gap grows", () => {
    const early = missedPings(checkIn, [at("2026-09-28T04:10:00Z")], at("2026-09-28T05:00:00Z"));
    const later = missedPings(checkIn, [at("2026-09-28T04:10:00Z")], at("2026-09-28T07:00:00Z"));
    expect(early[0].key).toBe(later[0].key);
  });

  it("ignores readings outside the shift", () => {
    expect(missedPings(checkIn, [at("2026-09-28T02:00:00Z")], at("2026-09-28T04:30:00Z"))).toEqual([]);
  });
});
