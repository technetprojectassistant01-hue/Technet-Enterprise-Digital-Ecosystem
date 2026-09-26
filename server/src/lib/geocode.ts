export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * Free, best-effort address lookup via OpenStreetMap Nominatim — no API key/billing needed.
 * Usage policy caps free use at ~1 req/s, fine for occasional work-order creation/edits.
 * Resolves to a general area, not a pinpoint building, so callers should treat the result
 * as advisory rather than exact.
 */
export interface GeocodeOptions {
  /**
   * ISO country code to confine results to. Without it, free text lands anywhere on earth -
   * measured against the real API, "Office" resolves to Harbin, China and "Closed early" to
   * Anaheim, California. Anything comparing a typed place against a GPS fix must set this, or
   * ordinary words become ten-thousand-kilometre "mismatches".
   */
  countryCode?: string;
  /** Give up rather than hold up a caller that must not block on a third-party lookup. */
  timeoutMs?: number;
  /**
   * Hard-restrict results to [west, south, east, north] - countryCode alone is not enough to keep
   * a search on the main island. Measured against the real API: "Paille" (a technician's typo for
   * "Pailles") resolves under countrycodes=mu to "Île Paille en Queue", an islet in Rodrigues -
   * technically part of the Republic of Mauritius, but ~620km from where the check-in actually
   * happened. Rodrigues, Agalega and the other outer islands are real places within "mu"; a
   * viewbox is the only way to exclude them when the caller specifically means the main island.
   */
  viewbox?: [west: number, south: number, east: number, north: number];
}

/** Mainland Mauritius only - deliberately excludes Rodrigues (~600km away) and the other outer
 * islands, which share the "mu" country code but are never where a check-in actually happens for
 * this company. Generous margin past the coastline on every side. */
export const MAIN_ISLAND_VIEWBOX: [number, number, number, number] = [57.25, -20.6, 57.85, -19.95];

export async function geocodeAddress(query: string, options: GeocodeOptions = {}): Promise<GeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  if (options.countryCode) url.searchParams.set("countrycodes", options.countryCode);
  if (options.viewbox) {
    url.searchParams.set("viewbox", options.viewbox.join(","));
    url.searchParams.set("bounded", "1");
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "Technet-TEDE-WorkOrders/1.0" },
    signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
  });
  if (!res.ok) return null;

  const results = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!results.length) return null;

  const [result] = results;
  return { lat: Number(result.lat), lng: Number(result.lon), displayName: result.display_name };
}
