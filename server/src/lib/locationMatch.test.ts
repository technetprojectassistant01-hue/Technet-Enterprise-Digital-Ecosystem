import { describe, expect, it } from "vitest";
import { classifyDistance, LOCATION_MATCH_RADIUS_METERS } from "./locationMatch";

describe("classifyDistance", () => {
  it("treats an unresolvable place as unchecked, not as a mismatch", () => {
    // The common case: "Office", "Closed early", a company name. Nothing to compare against,
    // and calling that a mismatch would accuse people for typing an ordinary word.
    expect(classifyDistance(null)).toBe("UNCHECKABLE");
  });

  it("matches when the typed place is near the GPS fix", () => {
    expect(classifyDistance(0)).toBe("MATCHED");
    expect(classifyDistance(1200)).toBe("MATCHED");
  });

  /**
   * Measured against the real API from a genuine check-in: "Réduit" resolved 5.6km away and
   * "Ébène" 6.4km, because a place name geocodes to an area centroid rather than a building.
   * Those must not flag, or honest check-ins get accused routinely.
   */
  it("does not flag the centroid drift of a real place name", () => {
    expect(classifyDistance(5_600)).toBe("MATCHED");
    expect(classifyDistance(6_400)).toBe("MATCHED");
  });

  it("flags only a different part of the island", () => {
    expect(classifyDistance(LOCATION_MATCH_RADIUS_METERS + 1)).toBe("MISMATCH");
    expect(classifyDistance(40_000)).toBe("MISMATCH");
  });

  it("treats the boundary itself as a match", () => {
    expect(classifyDistance(LOCATION_MATCH_RADIUS_METERS)).toBe("MATCHED");
  });

  it("keeps the radius wide enough to survive centroid drift", () => {
    // A guard on the constant itself: tightening this below ~7km would start flagging the real
    // distances measured above.
    expect(LOCATION_MATCH_RADIUS_METERS).toBeGreaterThanOrEqual(7_000);
  });
});
