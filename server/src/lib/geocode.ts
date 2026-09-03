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
}

export async function geocodeAddress(query: string, options: GeocodeOptions = {}): Promise<GeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  if (options.countryCode) url.searchParams.set("countrycodes", options.countryCode);

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
