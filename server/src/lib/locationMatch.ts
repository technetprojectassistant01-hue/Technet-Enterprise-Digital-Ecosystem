import { distanceMeters } from "./geo";
import { geocodeAddress } from "./geocode";

export type LocationMatchResult = "MATCHED" | "MISMATCH" | "UNCHECKABLE";

/**
 * How far a typed place may sit from the GPS fix before it counts as a mismatch.
 *
 * Deliberately generous. A place name geocodes to an *area centroid*, not a building: measured
 * against the real API from a genuine check-in, "Réduit" came back 5.6km away and "Ébène" 6.4km.
 * Mauritius is only about 65km end to end, so 10km flags somebody who named one part of the
 * island while standing in another - and stays quiet otherwise.
 *
 * What this cannot do, and must never be described as doing: tell whether somebody is at the
 * right building. "Said Wellkin, actually 800m down the road" is invisible at this resolution.
 */
export const LOCATION_MATCH_RADIUS_METERS = 10_000;

/** Technet operates in Mauritius; confining the lookup is what stops "Office" resolving to China. */
const COUNTRY_CODE = "mu";

/** A check-in must not wait on a third-party lookup - give up quickly and record UNCHECKABLE. */
const GEOCODE_TIMEOUT_MS = 4000;

export function classifyDistance(distance: number | null): LocationMatchResult {
  if (distance === null) return "UNCHECKABLE";
  return distance <= LOCATION_MATCH_RADIUS_METERS ? "MATCHED" : "MISMATCH";
}

export interface LocationCheck {
  match: LocationMatchResult;
  distanceMeters: number | null;
}

const NOT_CHECKED: LocationCheck = { match: "UNCHECKABLE", distanceMeters: null };

/**
 * Compares the place a technician typed against where their GPS put them.
 *
 * Never throws and never blocks the caller's own work: a lookup that fails, times out, or simply
 * finds nothing yields UNCHECKABLE, which is the ordinary outcome for text like "Office" and must
 * not be presented as a red flag. Check-in and check-out always succeed regardless of the result
 * here - this is advisory, exactly like the work-order geofence it replaces (CLAUDE.md §7a).
 */
export async function checkLocationAgainstGps(
  typedLocation: string | null,
  gps: { lat: number; lng: number },
): Promise<LocationCheck> {
  if (!typedLocation || !typedLocation.trim()) return NOT_CHECKED;

  try {
    const resolved = await geocodeAddress(typedLocation.trim(), {
      countryCode: COUNTRY_CODE,
      timeoutMs: GEOCODE_TIMEOUT_MS,
    });
    if (!resolved) return NOT_CHECKED;

    const distance = Math.round(distanceMeters(gps.lat, gps.lng, resolved.lat, resolved.lng));
    return { match: classifyDistance(distance), distanceMeters: distance };
  } catch {
    // Nominatim down, rate-limited, or slow. Not the technician's problem.
    return NOT_CHECKED;
  }
}
