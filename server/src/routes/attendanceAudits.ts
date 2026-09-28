import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ATTENDANCE_VIEW_ROLES, OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import {
  AUDIT_RESPONSE_WINDOW_MS,
  classifyAuditDistance,
  distanceFromCheckIn,
  evaluateStrike,
} from "../lib/attendanceAudit";
import { reverseGeocodeCached } from "../lib/reverseGeocode";
import { evaluateVisit } from "../lib/anomalies";
import type { AnomalySeverity, AnomalyStatus, AnomalyType, Prisma } from "../generated/prisma/client";

const router = Router();
router.use(requireAuth);

function parseCoords(body: unknown): { lat: number; lng: number } | null {
  const { lat, lng } = (body as { lat?: unknown; lng?: unknown }) ?? {};
  if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
  if (typeof lng !== "number" || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

const ANOMALY_DECISIONS = ["GENUINE", "CONFIRMED_VIOLATION", "FALSE_POSITIVE", "DISMISSED"] as const;
type AnomalyDecision = (typeof ANOMALY_DECISIONS)[number];
const ANOMALY_STATUSES: AnomalyStatus[] = ["OPEN", ...ANOMALY_DECISIONS];
const ANOMALY_TYPES: AnomalyType[] = [
  "AUDIT_STRIKES",
  "FAR_FROM_JOB",
  "UNVERIFIED_LOCATION",
  "CHECKIN_NEAR_HOME",
  "LEFT_WORK_AREA",
  "MISSED_PING",
  "IMPOSSIBLE_TRAVEL",
  "MOCK_LOCATION_SUSPECTED",
  "NO_GPS",
  "LOW_ACCURACY",
  "CLOCK_SKEW",
  "TIME_MISMATCH",
  "STATED_LOCATION_MISMATCH",
];
/** STANDARD is the old name for MEDIUM (schema.prisma) - a MEDIUM filter matches both. */
const SEVERITY_FILTER: Record<string, AnomalySeverity[]> = { LOW: ["LOW"], MEDIUM: ["MEDIUM", "STANDARD"], HIGH: ["HIGH"] };

/**
 * Everything a review card shows: the visit's stated vs GPS locations, the job, accuracy, whether
 * there is a check-in photo, and every fix (check-in, answered pings, check-out) for the mini map.
 */
const ANOMALY_INCLUDE = {
  employee: { select: { id: true, firstName: true, lastName: true } },
  firstAudit: true,
  secondAudit: true,
  resolvedBy: { select: { id: true, name: true } },
  siteAttendance: {
    select: {
      id: true,
      checkInAt: true,
      checkInLat: true,
      checkInLng: true,
      checkInPlace: true,
      checkInNote: true,
      checkInSite: true,
      checkInAccuracyMeters: true,
      checkInDeclaredTime: true,
      checkOutAt: true,
      checkOutLat: true,
      checkOutLng: true,
      checkOutPlace: true,
      checkOutNote: true,
      checkOutAccuracyMeters: true,
      checkOutDeclaredTime: true,
      workOrder: { select: { id: true, workOrderNumber: true, title: true, siteAddress: true, siteLat: true, siteLng: true } },
      checkInPhoto: { select: { id: true } },
      audits: {
        where: { lat: { not: null } },
        select: { id: true, respondedAt: true, lat: true, lng: true, place: true, distanceMeters: true },
        orderBy: { respondedAt: "asc" as const },
      },
      pings: {
        select: { id: true, createdAt: true, lat: true, lng: true, accuracyMeters: true },
        orderBy: { createdAt: "asc" as const },
      },
    },
  },
} as const;

function dayBound(value: unknown, endOfDay: boolean): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  // Mauritius days (UTC+4): a "from" of the 28th starts at 20:00 UTC on the 27th.
  const start = new Date(`${value}T00:00:00+04:00`);
  return endOfDay ? new Date(start.getTime() + 86_400_000) : start;
}

// ---- Manager review queue (registered before the "/:id" routes below to avoid "/anomalies"
// being swallowed as an audit id) ---------------------------------------------------------------

/**
 * The review queue. Filters: status, type, severity (LOW/MEDIUM/HIGH), employeeId,
 * siteAttendanceId (the register badge links here with it), and from/to Mauritius days on when
 * the anomaly was raised. Newest first, capped at 200 - a queue, not an archive.
 */
router.get("/anomalies", requireRole(...ATTENDANCE_VIEW_ROLES), async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const where: Prisma.AttendanceAnomalyWhereInput = {};
  if (typeof q.status === "string" && ANOMALY_STATUSES.includes(q.status as AnomalyStatus)) where.status = q.status as AnomalyStatus;
  if (typeof q.type === "string" && ANOMALY_TYPES.includes(q.type as AnomalyType)) where.type = q.type as AnomalyType;
  if (typeof q.severity === "string" && SEVERITY_FILTER[q.severity]) where.severity = { in: SEVERITY_FILTER[q.severity] };
  if (typeof q.employeeId === "string" && q.employeeId) where.employeeId = q.employeeId;
  if (typeof q.siteAttendanceId === "string" && q.siteAttendanceId) where.siteAttendanceId = q.siteAttendanceId;
  const from = dayBound(q.from, false);
  const to = dayBound(q.to, true);
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };

  const anomalies = await prisma.attendanceAnomaly.findMany({
    where,
    include: ANOMALY_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ anomalies });
});

router.patch("/anomalies/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const { status, note } = req.body ?? {};
  if (typeof status !== "string" || !ANOMALY_DECISIONS.includes(status as AnomalyDecision)) {
    return res.status(400).json({ error: "A valid decision is required" });
  }

  const anomaly = await prisma.attendanceAnomaly.findUnique({ where: { id: req.params.id as string } });
  if (!anomaly) return res.status(404).json({ error: "Anomaly not found" });
  if (anomaly.status !== "OPEN") {
    return res.status(400).json({ error: "This anomaly has already been decided" });
  }

  const updated = await prisma.attendanceAnomaly.update({
    where: { id: anomaly.id },
    data: {
      status: status as AnomalyDecision,
      resolvedById: req.user!.sub,
      resolvedAt: new Date(),
      resolutionNote: typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null,
    },
    include: ANOMALY_INCLUDE,
  });
  res.json({ anomaly: updated });
});

/** Undo: puts a decided anomaly back in the queue, clearing who decided it and why. */
router.post("/anomalies/:id/reopen", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const anomaly = await prisma.attendanceAnomaly.findUnique({ where: { id: req.params.id as string } });
  if (!anomaly) return res.status(404).json({ error: "Anomaly not found" });
  if (anomaly.status === "OPEN") return res.status(400).json({ error: "This anomaly is already open" });
  // One open anomaly per type per visit: reopening next to a newer open one of the same type
  // would break that, so ask the reviewer to decide the newer one first.
  if (anomaly.siteAttendanceId) {
    const otherOpen = await prisma.attendanceAnomaly.findFirst({
      where: { siteAttendanceId: anomaly.siteAttendanceId, type: anomaly.type, status: "OPEN", id: { not: anomaly.id } },
      select: { id: true },
    });
    if (otherOpen) return res.status(409).json({ error: "A newer anomaly of this type is open for this visit - decide that one first" });
  }
  const updated = await prisma.attendanceAnomaly.update({
    where: { id: anomaly.id },
    data: { status: "OPEN", resolvedById: null, resolvedAt: null, resolutionNote: null },
    include: ANOMALY_INCLUDE,
  });
  res.json({ anomaly: updated });
});

// ---- The technician's own audit-check page --------------------------------------------------

router.get("/:id", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const audit = await prisma.attendanceAudit.findUnique({ where: { id: req.params.id as string } });
  if (!audit || audit.employeeId !== employee.id) {
    return res.status(404).json({ error: "Audit not found" });
  }

  const expired =
    audit.status === "PENDING" &&
    audit.pushSentAt != null &&
    Date.now() - audit.pushSentAt.getTime() > AUDIT_RESPONSE_WINDOW_MS;

  res.json({ audit, expired });
});

router.post("/:id/confirm", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const audit = await prisma.attendanceAudit.findUnique({
    where: { id: req.params.id as string },
    include: { siteAttendance: { select: { checkInLat: true, checkInLng: true } } },
  });
  if (!audit || audit.employeeId !== employee.id) {
    return res.status(404).json({ error: "Audit not found" });
  }
  if (audit.status !== "PENDING") {
    return res.status(400).json({ error: "This check has already been recorded" });
  }
  // The poller marks a stale, unanswered ping MISSED on its own sweep - a late tap must not race
  // it and quietly rewrite a strike into a clean response.
  if (audit.pushSentAt && Date.now() - audit.pushSentAt.getTime() > AUDIT_RESPONSE_WINDOW_MS) {
    return res.status(410).json({ error: "This check has expired" });
  }

  const distance = distanceFromCheckIn(coords, {
    checkInLat: Number(audit.siteAttendance.checkInLat),
    checkInLng: Number(audit.siteAttendance.checkInLng),
  });
  const match = classifyAuditDistance(distance);
  // Usually a cache hit - an audit ping fires from very near wherever the technician checked in,
  // which reverseGeocodeCached already resolved once at check-in time (see siteAttendance.ts).
  const place = await reverseGeocodeCached(coords.lat, coords.lng);

  await prisma.attendanceAudit.update({
    where: { id: audit.id },
    data: {
      status: "CONFIRMED",
      respondedAt: new Date(),
      lat: coords.lat,
      lng: coords.lng,
      place,
      distanceMeters: distance,
      match,
    },
  });

  if (match === "MISMATCH") await evaluateStrike(audit.id);
  // The answered ping is a new fix for the visit: left the work area, impossible travel, fake GPS.
  void evaluateVisit(audit.siteAttendanceId);

  // Deliberately no match/mismatch verdict in the response - the technician's own attendance
  // widget never surfaces on-site/outside-site results back at them either (CLAUDE.md §7a); this
  // is about not confronting people with monitoring in their own screen, not concealment.
  res.json({ ok: true });
});

export default router;
