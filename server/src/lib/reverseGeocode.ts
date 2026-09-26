import { prisma } from "./prisma";

const USER_AGENT = "Technet-TEDE-Attendance/1.0";
/** Nominatim's usage policy caps free use at roughly 1 request/second. */
const MIN_INTERVAL_MS = 1100;
let lastCallAt = 0;

/** ~1.1m precision - fine enough to treat "the same site" as the same cache entry. */
function roundCoord(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

async function throttle(): Promise<void> {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCallAt = Date.now();
}

/**
 * Resolves a GPS fix to a human-readable place name via OpenStreetMap Nominatim, cached by
 * coordinates rounded to 5 decimal places so the same site is never re-geocoded (see
 * GeocodeCache in schema.prisma).
 *
 * Meant to be called once, at the moment a fix is recorded (check-in, check-out, an audit-ping
 * confirm) - never live while an admin is viewing a page. Geocoding dozens of historical rows on
 * a single page load would either blow well past Nominatim's ~1 req/s policy or make the page
 * serialize through several seconds of network calls; doing it once at write time means an admin
 * view only ever reads already-resolved data.
 *
 * Best-effort: returns null on any failure (timeout, no result, rate limit) rather than blocking
 * or throwing - the caller's own write must never fail because a third-party lookup did. A null
 * here just means that row falls back to showing its raw coordinates, not an error.
 */
export async function reverseGeocodeCached(lat: number, lng: number): Promise<string | null> {
  const latKey = roundCoord(lat);
  const lngKey = roundCoord(lng);

  const cached = await prisma.geocodeCache.findUnique({ where: { latKey_lngKey: { latKey, lngKey } } });
  if (cached) return cached.placeName;

  try {
    await throttle();
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "18");

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const result = (await res.json()) as { display_name?: string };
    if (!result.display_name) return null;

    // A race between two near-simultaneous first-time lookups of the same rounded coordinate is
    // possible but harmless - upsert just overwrites with the same (or equally valid) name rather
    // than erroring on the unique constraint a plain create would hit.
    await prisma.geocodeCache.upsert({
      where: { latKey_lngKey: { latKey, lngKey } },
      create: { latKey, lngKey, placeName: result.display_name },
      update: { placeName: result.display_name },
    });
    return result.display_name;
  } catch {
    return null;
  }
}
