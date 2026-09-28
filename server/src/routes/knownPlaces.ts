import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ATTENDANCE_VIEW_ROLES, OPS_MANAGE_ROLES } from "../lib/roles";
import { clampRadius, DEFAULT_PLACE_RADIUS_METERS, knownPlacesNear, relinkVisitsToPlace } from "../lib/knownPlaces";

/**
 * Known places (spec 2026-09-26, section 2). Readable by everyone who can read the attendance
 * register (ATTENDANCE_VIEW_ROLES); changed only by Operations (OPS_MANAGE_ROLES) - the same split
 * as anomaly review, since saving a place is part of reviewing one.
 */
const router = Router();
router.use(requireAuth);

const PLACE_INCLUDE = {
  customer: { select: { id: true, name: true, company: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { visits: true } },
} as const;

function parseName(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
}

async function parseCustomerId(value: unknown): Promise<{ value: string | null } | { error: string }> {
  if (value === undefined || value === null || value === "") return { value: null };
  if (typeof value !== "string") return { error: "Invalid client" };
  const customer = await prisma.customer.findUnique({ where: { id: value }, select: { id: true } });
  return customer ? { value: customer.id } : { error: "Client not found" };
}

router.get("/", requireRole(...ATTENDANCE_VIEW_ROLES), async (_req, res) => {
  const places = await prisma.knownPlace.findMany({ include: PLACE_INCLUDE, orderBy: { name: "asc" } });
  res.json({ places });
});

/** Places within 250 m of a point - the "match it to an existing place" choices on the review card. */
router.get("/near", requireRole(...ATTENDANCE_VIEW_ROLES), async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: "lat and lng are required" });
  const near = await knownPlacesNear(lat, lng);
  res.json({ places: near.map((p) => ({ id: p.id, name: p.name, distanceMeters: p.distanceMeters })) });
});

/**
 * A reviewer confirms a visit's location is genuine and either matches it to an existing place
 * (`knownPlaceId`) or saves it as a new one (`name`, optional `customerId` and `radiusMeters`)
 * at the visit's check-in fix. Either way the visit is linked, the place's times_confirmed goes
 * up, and other recent unlinked visits inside it are linked too (lib/knownPlaces.ts).
 */
router.post("/confirm-visit", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const { siteAttendanceId, knownPlaceId, name, customerId, radiusMeters } = req.body ?? {};
  if (typeof siteAttendanceId !== "string") return res.status(400).json({ error: "siteAttendanceId is required" });
  const visit = await prisma.siteAttendance.findUnique({
    where: { id: siteAttendanceId },
    select: { id: true, checkInLat: true, checkInLng: true, checkInPlace: true },
  });
  if (!visit) return res.status(404).json({ error: "Visit not found" });

  let placeId: string;
  if (typeof knownPlaceId === "string" && knownPlaceId) {
    const place = await prisma.knownPlace.findUnique({ where: { id: knownPlaceId }, select: { id: true } });
    if (!place) return res.status(404).json({ error: "Known place not found" });
    await prisma.knownPlace.update({ where: { id: place.id }, data: { timesConfirmed: { increment: 1 } } });
    placeId = place.id;
  } else {
    const placeName = parseName(name);
    if (!placeName) return res.status(400).json({ error: "A name for the place is required" });
    const customer = await parseCustomerId(customerId);
    if ("error" in customer) return res.status(400).json({ error: customer.error });
    const created = await prisma.knownPlace.create({
      data: {
        name: placeName,
        customerId: customer.value,
        address: visit.checkInPlace,
        lat: visit.checkInLat,
        lng: visit.checkInLng,
        radiusMeters: clampRadius(radiusMeters) ?? DEFAULT_PLACE_RADIUS_METERS,
        timesConfirmed: 1,
        createdById: req.user!.sub,
      },
    });
    placeId = created.id;
  }

  await prisma.siteAttendance.update({ where: { id: visit.id }, data: { knownPlaceId: placeId } });
  const linked = await relinkVisitsToPlace(placeId, req.user!.sub);
  const place = await prisma.knownPlace.findUnique({ where: { id: placeId }, include: PLACE_INCLUDE });
  res.json({ place, linked });
});

/** Rename, set the client, or adjust the radius. A bigger radius may pull more recent visits in. */
router.patch("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const existing = await prisma.knownPlace.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "Known place not found" });

  const { name, customerId, radiusMeters } = req.body ?? {};
  const data: { name?: string; customerId?: string | null; radiusMeters?: number } = {};
  if (name !== undefined) {
    const parsed = parseName(name);
    if (!parsed) return res.status(400).json({ error: "The name cannot be empty" });
    data.name = parsed;
  }
  if (customerId !== undefined) {
    const customer = await parseCustomerId(customerId);
    if ("error" in customer) return res.status(400).json({ error: customer.error });
    data.customerId = customer.value;
  }
  if (radiusMeters !== undefined) {
    const radius = clampRadius(radiusMeters);
    if (radius === null) return res.status(400).json({ error: "Radius must be a number of metres" });
    data.radiusMeters = radius;
  }

  await prisma.knownPlace.update({ where: { id }, data });
  if (data.radiusMeters !== undefined) await relinkVisitsToPlace(id, req.user!.sub);
  const place = await prisma.knownPlace.findUnique({ where: { id }, include: PLACE_INCLUDE });
  res.json({ place });
});

/**
 * Merges a duplicate into another place: its visits move over, confirmations add up, and the
 * duplicate is deleted. The kept place keeps its own name, position and radius.
 */
router.post("/:id/merge", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const fromId = req.params.id as string;
  const intoId = (req.body ?? {}).intoId;
  if (typeof intoId !== "string" || intoId === fromId) return res.status(400).json({ error: "Choose a different place to merge into" });
  const [from, into] = await Promise.all([
    prisma.knownPlace.findUnique({ where: { id: fromId } }),
    prisma.knownPlace.findUnique({ where: { id: intoId } }),
  ]);
  if (!from || !into) return res.status(404).json({ error: "Known place not found" });

  await prisma.$transaction([
    prisma.siteAttendance.updateMany({ where: { knownPlaceId: from.id }, data: { knownPlaceId: into.id } }),
    prisma.knownPlace.update({ where: { id: into.id }, data: { timesConfirmed: { increment: from.timesConfirmed } } }),
    prisma.knownPlace.delete({ where: { id: from.id } }),
  ]);
  const place = await prisma.knownPlace.findUnique({ where: { id: into.id }, include: PLACE_INCLUDE });
  res.json({ place });
});

/** Deletes a place. Its visits keep their times and GPS; they just stop showing as matched. */
router.delete("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const existing = await prisma.knownPlace.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "Known place not found" });
  await prisma.knownPlace.delete({ where: { id } });
  res.status(204).end();
});

export default router;
