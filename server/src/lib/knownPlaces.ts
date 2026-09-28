import { prisma } from "./prisma";
import { distanceMeters } from "./geo";

/**
 * Known places (spec 2026-09-26, section 2): places learned from confirmed check-ins, not a list
 * set up in advance. The pure matching lives here (tested in knownPlaces.test.ts); the routes are
 * in routes/knownPlaces.ts.
 */

/** "Match it to an existing place within 250 m" - also the default radius of a new place. */
export const DEFAULT_PLACE_RADIUS_METERS = 250;
export const MIN_PLACE_RADIUS_METERS = 50;
export const MAX_PLACE_RADIUS_METERS = 2000;
/** When a place is saved, earlier visits inside it from this far back are linked to it too. */
const RELINK_DAYS = 30;

export interface PlacePoint {
  id: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

/** The nearest place whose own radius contains the point, or null. */
export function matchKnownPlace<T extends PlacePoint>(point: { lat: number; lng: number }, places: T[]): (T & { distanceMeters: number }) | null {
  let best: (T & { distanceMeters: number }) | null = null;
  for (const place of places) {
    const d = Math.round(distanceMeters(point.lat, point.lng, place.lat, place.lng));
    if (d > place.radiusMeters) continue;
    if (!best || d < best.distanceMeters) best = { ...place, distanceMeters: d };
  }
  return best;
}

/** Places within `withinMeters` of a point, nearest first - the "match to an existing place" suggestions. */
export function placesNear<T extends PlacePoint>(point: { lat: number; lng: number }, places: T[], withinMeters = DEFAULT_PLACE_RADIUS_METERS) {
  return places
    .map((p) => ({ ...p, distanceMeters: Math.round(distanceMeters(point.lat, point.lng, p.lat, p.lng)) }))
    .filter((p) => p.distanceMeters <= withinMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function clampRadius(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.min(MAX_PLACE_RADIUS_METERS, Math.max(MIN_PLACE_RADIUS_METERS, Math.round(n)));
}

async function allPlaces() {
  const rows = await prisma.knownPlace.findMany({ select: { id: true, name: true, lat: true, lng: true, radiusMeters: true } });
  return rows.map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }));
}

/** The known place a check-in fix falls inside, for SiteAttendance.knownPlaceId. Never throws. */
export async function findKnownPlaceFor(lat: number, lng: number): Promise<string | null> {
  try {
    return matchKnownPlace({ lat, lng }, await allPlaces())?.id ?? null;
  } catch {
    return null;
  }
}

export async function knownPlacesNear(lat: number, lng: number, withinMeters = DEFAULT_PLACE_RADIUS_METERS) {
  return placesNear({ lat, lng }, await allPlaces(), withinMeters);
}

/**
 * After a place is created, moved or resized: link recent visits that checked in inside it and
 * weren't linked to any place yet, and close their still-open UNVERIFIED_LOCATION anomalies as
 * GENUINE - the reviewer has just confirmed this spot. Returns how many visits were linked.
 */
export async function relinkVisitsToPlace(placeId: string, userId: string): Promise<number> {
  const place = await prisma.knownPlace.findUnique({ where: { id: placeId } });
  if (!place) return 0;
  const since = new Date(Date.now() - RELINK_DAYS * 86_400_000);
  const candidates = await prisma.siteAttendance.findMany({
    where: { knownPlaceId: null, checkInAt: { gte: since } },
    select: { id: true, checkInLat: true, checkInLng: true },
  });
  const inside = candidates.filter(
    (v) => distanceMeters(Number(v.checkInLat), Number(v.checkInLng), Number(place.lat), Number(place.lng)) <= place.radiusMeters,
  );
  if (!inside.length) return 0;
  const ids = inside.map((v) => v.id);
  await prisma.siteAttendance.updateMany({ where: { id: { in: ids } }, data: { knownPlaceId: place.id } });
  await prisma.attendanceAnomaly.updateMany({
    where: { siteAttendanceId: { in: ids }, type: "UNVERIFIED_LOCATION", status: "OPEN" },
    data: { status: "GENUINE", resolvedById: userId, resolvedAt: new Date(), resolutionNote: `Matched to known place "${place.name}"` },
  });
  return ids.length;
}
