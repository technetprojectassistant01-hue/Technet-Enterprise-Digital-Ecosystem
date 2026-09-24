import { prisma } from "./prisma";
import { distanceMeters } from "./geo";
import { notifyRoles } from "./notifications";
import { OPS_MANAGE_ROLES } from "./roles";
import type { AttendanceAudit, AuditStatus, LocationMatch } from "../generated/prisma/client";

/**
 * A random "are you still there" GPS audit ping during an open shift - the free alternative to
 * continuous tracking. See CLAUDE.md for the full design; the key choices worth remembering here:
 *
 * - Compared against the technician's own check-in GPS fix, never a work order's site coordinates
 *   (those are optional and rarely set now, so anchoring there would silently do nothing for most
 *   sessions).
 * - No dependency on a "typical shift end" wall-clock time: any audit still PENDING when the
 *   technician checks out is simply cancelled (see cancelPendingAudits below), so scheduling only
 *   needs an offset from check-in, not a shift-length model.
 * - A missing push subscription is SKIPPED, not MISSED - opting out of the "Reminders" toggle must
 *   never read as a compliance failure.
 */

const MIN_AUDITS = 2;
const MAX_AUDITS = 4;
const MIN_OFFSET_MS = 30 * 60 * 1000; // 30 minutes after check-in
const MAX_OFFSET_MS = 8 * 60 * 60 * 1000; // up to 8 hours after check-in
const MIN_GAP_MS = 45 * 60 * 1000; // audits never land closer together than this

/** How far an audit's GPS fix may sit from the check-in fix before it counts as a mismatch. */
export const AUDIT_MATCH_RADIUS_METERS = 300;

/** The technician has this long after a push goes out to tap through. */
export const AUDIT_RESPONSE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Picks 2-4 random future times for audit pings, at least MIN_GAP_MS apart, all within
 * [MIN_OFFSET_MS, MAX_OFFSET_MS] of check-in. Pure and deterministic given a seeded `random`, so
 * it's unit-testable without touching the clock or the DB.
 */
export function scheduleAuditTimes(checkInAt: Date, random: () => number = Math.random): Date[] {
  const count = MIN_AUDITS + Math.floor(random() * (MAX_AUDITS - MIN_AUDITS + 1));
  const offsets: number[] = [];

  // Rejection-sample offsets until we have `count` that all respect the minimum gap. The window
  // (30min-8h with a 45min gap) comfortably fits 4 picks, so this converges in a handful of tries.
  let guard = 0;
  while (offsets.length < count && guard < 200) {
    guard += 1;
    const candidate = MIN_OFFSET_MS + random() * (MAX_OFFSET_MS - MIN_OFFSET_MS);
    if (offsets.every((o) => Math.abs(o - candidate) >= MIN_GAP_MS)) {
      offsets.push(candidate);
    }
  }

  offsets.sort((a, b) => a - b);
  return offsets.map((offset) => new Date(checkInAt.getTime() + offset));
}

/** A resolved audit counts as a strike if it timed out, or if it was answered from too far away. */
export function isStrike(audit: Pick<AttendanceAudit, "status" | "match">): boolean {
  if (audit.status === "MISSED") return true;
  return audit.status === "CONFIRMED" && audit.match === "MISMATCH";
}

export function classifyAuditDistance(distance: number): LocationMatch {
  return distance <= AUDIT_MATCH_RADIUS_METERS ? "MATCHED" : "MISMATCH";
}

/**
 * Distance from an audit's reported fix to the parent session's check-in fix, in meters.
 */
export function distanceFromCheckIn(
  audit: { lat: number; lng: number },
  session: { checkInLat: number; checkInLng: number },
): number {
  return Math.round(
    distanceMeters(audit.lat, audit.lng, session.checkInLat, session.checkInLng),
  );
}

/**
 * After an audit resolves (MISSED, or CONFIRMED with a distance), checks whether it and the
 * employee's immediately preceding resolved audit are both strikes - if so, opens exactly one
 * AttendanceAnomaly for the pair (never re-pairs an audit already used in one) and notifies
 * Operations. "Consecutive" means back-to-back in this employee's own audit history, not scoped to
 * a single shift or a time window - a SKIPPED or CANCELLED audit in between is ignored entirely
 * (neither breaks nor extends a streak), while a clean CONFIRMED/MATCHED resets it.
 */
export async function evaluateStrike(auditId: string): Promise<void> {
  const audit = await prisma.attendanceAudit.findUnique({ where: { id: auditId } });
  if (!audit || !isStrike(audit)) return;

  const previous = await prisma.attendanceAudit.findFirst({
    where: {
      employeeId: audit.employeeId,
      id: { not: audit.id },
      status: { in: ["CONFIRMED", "MISSED"] as AuditStatus[] },
      scheduledAt: { lt: audit.scheduledAt },
      anomalyAsFirst: null,
      anomalyAsSecond: null,
    },
    orderBy: { scheduledAt: "desc" },
  });
  if (!previous || !isStrike(previous)) return;

  const severity = audit.status === "MISSED" && previous.status === "MISSED" ? "HIGH" : "STANDARD";

  const anomaly = await prisma.attendanceAnomaly.create({
    data: {
      employeeId: audit.employeeId,
      firstAuditId: previous.id,
      secondAuditId: audit.id,
      severity,
    },
    include: { employee: { select: { firstName: true, lastName: true } } },
  });

  await notifyRoles(
    OPS_MANAGE_ROLES,
    "ATTENDANCE_ANOMALY_DETECTED",
    `${anomaly.employee.firstName} ${anomaly.employee.lastName} has two consecutive attendance audit strikes`,
    { link: "/dashboard/operations/anomalies" },
  );
}

/** Cancels every still-PENDING audit for a session - called the moment a technician checks out. */
export async function cancelPendingAudits(siteAttendanceId: string): Promise<void> {
  await prisma.attendanceAudit.updateMany({
    where: { siteAttendanceId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}
