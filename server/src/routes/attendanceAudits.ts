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
import type { AnomalyStatus } from "../generated/prisma/client";

const router = Router();
router.use(requireAuth);

function parseCoords(body: unknown): { lat: number; lng: number } | null {
  const { lat, lng } = (body as { lat?: unknown; lng?: unknown }) ?? {};
  if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
  if (typeof lng !== "number" || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

const ANOMALY_DECISIONS = ["CONFIRMED_VIOLATION", "FALSE_POSITIVE", "DISMISSED"] as const;
type AnomalyDecision = (typeof ANOMALY_DECISIONS)[number];

// ---- Manager review queue (registered before the "/:id" routes below to avoid "/anomalies"
// being swallowed as an audit id) ---------------------------------------------------------------

router.get("/anomalies", requireRole(...ATTENDANCE_VIEW_ROLES), async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const anomalies = await prisma.attendanceAnomaly.findMany({
    where: status ? { status: status as AnomalyStatus } : undefined,
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      firstAudit: true,
      secondAudit: true,
      resolvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
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
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      firstAudit: true,
      secondAudit: true,
      resolvedBy: { select: { id: true, name: true } },
    },
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

  await prisma.attendanceAudit.update({
    where: { id: audit.id },
    data: {
      status: "CONFIRMED",
      respondedAt: new Date(),
      lat: coords.lat,
      lng: coords.lng,
      distanceMeters: distance,
      match,
    },
  });

  if (match === "MISMATCH") await evaluateStrike(audit.id);

  // Deliberately no match/mismatch verdict in the response - the technician's own attendance
  // widget never surfaces on-site/outside-site results back at them either (CLAUDE.md §7a); this
  // is about not confronting people with monitoring in their own screen, not concealment.
  res.json({ ok: true });
});

export default router;
