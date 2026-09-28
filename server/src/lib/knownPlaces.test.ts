import { describe, expect, it } from "vitest";
import { clampRadius, matchKnownPlace, placesNear } from "./knownPlaces";

// 0.001 deg latitude ~ 111 m.
const BASE = { lat: -20.192, lng: 57.514 };
const place = (id: string, dLat: number, radiusMeters = 250) => ({ id, lat: BASE.lat + dLat, lng: BASE.lng, radiusMeters });

describe("matchKnownPlace", () => {
  it("matches a place whose radius contains the point", () => {
    expect(matchKnownPlace(BASE, [place("a", 0.001)])?.id).toBe("a");
  });

  it("does not match outside the place's own radius", () => {
    expect(matchKnownPlace(BASE, [place("a", 0.003)])).toBeNull(); // ~333 m > 250 m
    expect(matchKnownPlace(BASE, [place("a", 0.003, 400)])?.id).toBe("a");
  });

  it("picks the nearest when several contain the point", () => {
    const match = matchKnownPlace(BASE, [place("far", 0.002), place("near", 0.0005)]);
    expect(match?.id).toBe("near");
    expect(match?.distanceMeters).toBeLessThan(60);
  });

  it("returns null with no places", () => {
    expect(matchKnownPlace(BASE, [])).toBeNull();
  });
});

describe("placesNear", () => {
  it("lists places within 250 m, nearest first, regardless of their own radius", () => {
    const near = placesNear(BASE, [place("b", 0.002, 50), place("a", 0.001, 50), place("out", 0.01)]);
    expect(near.map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("clampRadius", () => {
  it("keeps a sensible radius and clamps extremes", () => {
    expect(clampRadius(300)).toBe(300);
    expect(clampRadius("120")).toBe(120);
    expect(clampRadius(5)).toBe(50);
    expect(clampRadius(99_999)).toBe(2000);
  });

  it("rejects junk", () => {
    expect(clampRadius("wide")).toBeNull();
    expect(clampRadius(undefined)).toBeNull();
  });
});
