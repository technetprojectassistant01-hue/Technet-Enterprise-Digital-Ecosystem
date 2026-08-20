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
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url, { headers: { "User-Agent": "Technet-TEDE-WorkOrders/1.0" } });
  if (!res.ok) return null;

  const results = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!results.length) return null;

  const [result] = results;
  return { lat: Number(result.lat), lng: Number(result.lon), displayName: result.display_name };
}
