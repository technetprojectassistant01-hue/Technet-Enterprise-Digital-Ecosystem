import { prisma } from "./prisma";
import { notifyRoles } from "./notifications";
import { OPS_MANAGE_ROLES } from "./roles";
import { mauritiusDay } from "./overtime";
import {
  checkInNearHome,
  clockSkew,
  farFromJob,
  impossibleTravel,
  leftWorkArea,
  lowAccuracy,
  missedPings,
  mockLocation,
  statedLocationMismatch,
  timeMismatch,
  type Finding,
  type Fix,
} from "./anomalyRules";
import type { AnomalySeverity, AnomalyStatus, AnomalyType, JobCategory, Prisma } from "../generated/prisma/client";

/**
 * Evaluates a visit against the anomaly rules (lib/anomalyRules.ts) and records what they find,
 * with the spec's de-duplication: one OPEN anomaly per type per visit, a repeat updating its
 * details and occurrence count instead of adding a row.
 *
 * Idempotent by design. Every finding names its occurrence with a key, and the keys already
 * counted live in the anomaly's `details.keys`, so evaluating the same visit again - which happens
 * on check-in, every answered audit ping, and check-out - never double-counts. A key already
 * counted on an anomaly that has since been reviewed is not raised again either: a reviewer's
 * "false positive" stays decided.
 */

export interface AnomalyDetails {
  /** Every occurrence key already counted on this anomaly. */
  keys: string[];
  /** The newest finding's details - what the review card shows. */
  latest: Record<string, unknown>;
  /** The most recent occurrences, newest last (capped so a noisy visit can't grow a row forever). */
  occurrences: ({ key: string; recordedAt: string } & Record<string, unknown>)[];
}

const MAX_OCCURRENCES_KEPT = 20;

const SEVERITY_RANK: Record<AnomalySeverity, number> = { LOW: 1, STANDARD: 2, MEDIUM: 2, HIGH: 3 };
const higher = (a: AnomalySeverity, b: AnomalySeverity) => (SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a);

export interface ExistingAnomaly {
  id: string;
  status: AnomalyStatus;
  severity: AnomalySeverity;
  occurrenceCount: number;
  details: unknown;
}

export type AnomalyPlan =
  | { action: "skip" }
  | { action: "update"; id: string; severity: AnomalySeverity; occurrenceCount: number; details: AnomalyDetails }
  | { action: "create"; severity: AnomalySeverity; details: AnomalyDetails };

function readDetails(value: unknown): AnomalyDetails {
  const d = (value ?? {}) as Partial<AnomalyDetails>;
  return { keys: Array.isArray(d.keys) ? d.keys : [], latest: d.latest ?? {}, occurrences: Array.isArray(d.occurrences) ? d.occurrences : [] };
}

/**
 * Pure de-duplication decision for one finding against the anomalies of the same type already on
 * the same visit. Tested in anomalies.test.ts.
 */
export function planFinding(existing: ExistingAnomaly[], finding: Finding, now = new Date()): AnomalyPlan {
  if (existing.some((a) => readDetails(a.details).keys.includes(finding.key))) return { action: "skip" };

  const occurrence = { key: finding.key, recordedAt: now.toISOString(), ...finding.details };
  const open = existing.find((a) => a.status === "OPEN");
  if (open) {
    const d = readDetails(open.details);
    return {
      action: "update",
      id: open.id,
      severity: higher(open.severity, finding.severity),
      occurrenceCount: open.occurrenceCount + 1,
      details: {
        keys: [...d.keys, finding.key],
        latest: finding.details,
        occurrences: [...d.occurrences, occurrence].slice(-MAX_OCCURRENCES_KEPT),
      },
    };
  }
  return { action: "create", severity: finding.severity, details: { keys: [finding.key], latest: finding.details, occurrences: [occurrence] } };
}

/** English only, like every other server-generated notification (CLAUDE.md §19). */
const TYPE_LABEL: Record<AnomalyType, string> = {
  AUDIT_STRIKES: "two missed or out-of-area compliance checks",
  FAR_FROM_JOB: "checked in far from the job",
  UNVERIFIED_LOCATION: "unverified location",
  CHECKIN_NEAR_HOME: "checked in near home",
  LEFT_WORK_AREA: "left the work area",
  MISSED_PING: "missed location ping",
  IMPOSSIBLE_TRAVEL: "impossible travel between locations",
  MOCK_LOCATION_SUSPECTED: "possible fake GPS",
  NO_GPS: "no GPS",
  LOW_ACCURACY: "low GPS accuracy",
  CLOCK_SKEW: "phone clock is wrong",
  TIME_MISMATCH: "typed time differs from recorded time",
  STATED_LOCATION_MISMATCH: "typed location differs from GPS",
};

/** Saves findings for one visit. New HIGH anomalies notify Operations; lower ones just queue. */
export async function recordFindings(employeeId: string, siteAttendanceId: string, findings: Finding[]): Promise<void> {
  for (const finding of findings) {
    const existing = await prisma.attendanceAnomaly.findMany({
      where: { siteAttendanceId, type: finding.type },
      select: { id: true, status: true, severity: true, occurrenceCount: true, details: true },
    });
    const plan = planFinding(existing, finding);
    if (plan.action === "skip") continue;

    const details = plan.details as unknown as Prisma.InputJsonValue;
    if (plan.action === "update") {
      await prisma.attendanceAnomaly.update({
        where: { id: plan.id },
        data: { severity: plan.severity, occurrenceCount: plan.occurrenceCount, details },
      });
      continue;
    }

    const created = await prisma.attendanceAnomaly.create({
      data: { employeeId, siteAttendanceId, type: finding.type, severity: plan.severity, details },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });
    if (plan.severity === "HIGH") {
      await notifyRoles(
        OPS_MANAGE_ROLES,
        "ATTENDANCE_ANOMALY_DETECTED",
        `${created.employee.firstName} ${created.employee.lastName}: ${TYPE_LABEL[finding.type]}`,
        { link: `/dashboard/operations/anomalies?siteAttendanceId=${siteAttendanceId}` },
      );
    }
  }
}

const VISIT_SELECT = {
  id: true,
  employeeId: true,
  checkInAt: true,
  checkInLat: true,
  checkInLng: true,
  checkInAccuracyMeters: true,
  checkInDeviceAt: true,
  checkInNote: true,
  checkInDeclaredTime: true,
  checkInLocationDistanceMeters: true,
  checkOutAt: true,
  checkOutLat: true,
  checkOutLng: true,
  checkOutAccuracyMeters: true,
  checkOutDeviceAt: true,
  checkOutNote: true,
  checkOutDeclaredTime: true,
  checkOutLocationDistanceMeters: true,
  workOrder: { select: { id: true, siteLat: true, siteLng: true, jobCategory: true } },
  audits: { where: { lat: { not: null } }, select: { id: true, respondedAt: true, scheduledAt: true, lat: true, lng: true } },
  pings: { select: { id: true, createdAt: true, lat: true, lng: true, accuracyMeters: true } },
} as const;

/**
 * Shift pings went live on 2026-09-28. A shift that began before then had no way to ping, so the
 * missed-ping rule would flag every one of them for nothing - it only applies from this point on.
 */
export const PINGS_LIVE_SINCE = new Date("2026-09-28T12:00:00Z");

/**
 * Job categories whose work moves around (spec section 4: "a setting for roaming jobs"), exempt
 * from LEFT_WORK_AREA. A Render env var, comma-separated JobCategory values - e.g.
 * `ROAMING_JOB_CATEGORIES=SURVEY,OUTDOOR_REPAIR` - empty by default, like the other attendance
 * switches (ATTENDANCE_PHOTO_REQUIRED, ATTENDANCE_AUDIT_ENABLED).
 */
export function roamingJobCategories(env: NodeJS.ProcessEnv = process.env): Set<JobCategory> {
  return new Set(
    (env.ROAMING_JOB_CATEGORIES ?? "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean) as JobCategory[],
  );
}

type Visit = Prisma.SiteAttendanceGetPayload<{ select: typeof VISIT_SELECT }>;

function fixesOf(v: Visit): Fix[] {
  const fixes: Fix[] = [
    {
      key: `checkin:${v.id}`,
      kind: "CHECK_IN",
      at: v.checkInAt,
      lat: Number(v.checkInLat),
      lng: Number(v.checkInLng),
      accuracyMeters: v.checkInAccuracyMeters,
    },
  ];
  for (const a of v.audits) {
    fixes.push({ key: `audit:${a.id}`, kind: "AUDIT", at: a.respondedAt ?? a.scheduledAt, lat: Number(a.lat), lng: Number(a.lng), accuracyMeters: null });
  }
  for (const p of v.pings) {
    // Server receive time, like every other fix here - the phone's own time is kept on the row.
    fixes.push({ key: `ping:${p.id}`, kind: "PING", at: p.createdAt, lat: Number(p.lat), lng: Number(p.lng), accuracyMeters: p.accuracyMeters });
  }
  // A manager's close has no coordinates (CLAUDE.md §7a) - nothing to evaluate for that leg.
  if (v.checkOutAt && v.checkOutLat !== null && v.checkOutLng !== null) {
    fixes.push({
      key: `checkout:${v.id}`,
      kind: "CHECK_OUT",
      at: v.checkOutAt,
      lat: Number(v.checkOutLat),
      lng: Number(v.checkOutLng),
      accuracyMeters: v.checkOutAccuracyMeters,
    });
  }
  return fixes;
}

/** Does this finding's key point at one of the given fixes? For day-wide rules, the finding belongs to the visit of its later fix. */
function belongsTo(finding: Finding, visitKeys: Set<string>): boolean {
  const key = finding.key.includes(">") ? finding.key.split(">")[1] : finding.key.replace(/^(zero-accuracy|identical|jump):/, "");
  return visitKeys.has(key);
}

type VisitEvent = { leg: "CHECK_IN" | "CHECK_OUT"; clientSentAt: Date | null; serverAt: Date };

/**
 * Every rule's findings for one visit, without recording anything - evaluateVisit() records them,
 * and a dry run can inspect them. `event` carries what only exists during the request itself (the
 * phone's clock at send time, for clock skew) for the leg just recorded.
 */
export async function findingsForVisit(siteAttendanceId: string, event?: VisitEvent): Promise<{ employeeId: string; findings: Finding[] } | null> {
  const visit = await prisma.siteAttendance.findUnique({ where: { id: siteAttendanceId }, select: VISIT_SELECT });
  if (!visit) return null;

  // The whole Mauritius day's fixes, for the rules that look across visits (travel, fake GPS).
  const day = mauritiusDay(visit.checkInAt);
  const around = await prisma.siteAttendance.findMany({
    where: {
      employeeId: visit.employeeId,
      checkInAt: { gte: new Date(visit.checkInAt.getTime() - 36 * 3_600_000), lte: new Date(visit.checkInAt.getTime() + 36 * 3_600_000) },
    },
    select: VISIT_SELECT,
  });
  const dayFixes = around.filter((v) => mauritiusDay(v.checkInAt) === day).flatMap(fixesOf);

  const fixes = fixesOf(visit);
  const visitKeys = new Set(fixes.map((f) => f.key));
  const checkIn = fixes[0];
  const checkOut = fixes.find((f) => f.kind === "CHECK_OUT") ?? null;
  const job =
    visit.workOrder && visit.workOrder.siteLat !== null && visit.workOrder.siteLng !== null
      ? { id: visit.workOrder.id, lat: Number(visit.workOrder.siteLat), lng: Number(visit.workOrder.siteLng) }
      : null;

  const findings: Finding[] = [
    ...farFromJob(checkIn, job),
    // Home coordinates arrive with spec section 3; until then this rule has nothing to compare.
    ...checkInNearHome(checkIn, null, []),
    ...(visit.workOrder && roamingJobCategories().has(visit.workOrder.jobCategory) ? [] : leftWorkArea(checkIn, fixes)),
    ...(visit.checkInAt >= PINGS_LIVE_SINCE
      ? missedPings(
          visit.checkInAt,
          fixes.filter((f) => f.kind !== "CHECK_IN").map((f) => f.at),
          visit.checkOutAt ?? new Date(),
        )
      : []),
    ...lowAccuracy(checkIn),
    ...(checkOut ? lowAccuracy(checkOut) : []),
    ...statedLocationMismatch(checkIn.key, visit.checkInNote, visit.checkInLocationDistanceMeters),
    ...timeMismatch(checkIn.key, visit.checkInDeclaredTime, visit.checkInAt, visit.checkInDeviceAt),
    ...(visit.checkOutAt
      ? [
          ...statedLocationMismatch(`checkout:${visit.id}`, visit.checkOutNote, visit.checkOutLocationDistanceMeters),
          ...timeMismatch(`checkout:${visit.id}`, visit.checkOutDeclaredTime, visit.checkOutAt, visit.checkOutDeviceAt),
        ]
      : []),
    ...impossibleTravel(dayFixes).filter((f) => belongsTo(f, visitKeys)),
    ...mockLocation(dayFixes).filter((f) => belongsTo(f, visitKeys)),
    ...(event ? clockSkew(event.leg === "CHECK_IN" ? checkIn.key : `checkout:${visit.id}`, event.clientSentAt, event.serverAt) : []),
  ];
  return { employeeId: visit.employeeId, findings };
}

/**
 * Runs every rule over a visit and records the findings.
 *
 * Never throws: an evaluation failure must not fail the check-in, check-out or audit answer that
 * triggered it. It is logged and the visit is re-evaluated on its next event anyway.
 */
export async function evaluateVisit(siteAttendanceId: string, event?: VisitEvent): Promise<void> {
  try {
    const result = await findingsForVisit(siteAttendanceId, event);
    if (result) await recordFindings(result.employeeId, siteAttendanceId, result.findings);
  } catch (err) {
    console.error(`evaluateVisit(${siteAttendanceId}) failed:`, err);
  }
}

/** The phone's clock when it sent the request (outbox adds `clientSentAt`); null if absent or junk. */
export function parseClientSentAt(body: unknown): Date | null {
  const value = (body as { clientSentAt?: unknown } | null)?.clientSentAt;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Re-evaluates shifts that are still open, so a gap in pings is noticed while it is happening
 * rather than only at the next ping or at check-out. Called by the attendance poller every few
 * minutes. Limited to shifts opened in the last 36 hours - an older open shift is a forgotten
 * check-out (Team Attendance flags those), and its single long gap was already recorded.
 */
export async function evaluateOpenShifts(): Promise<number> {
  const open = await prisma.siteAttendance.findMany({
    where: { checkOutAt: null, checkInAt: { gte: new Date(Date.now() - 36 * 3_600_000) } },
    select: { id: true },
  });
  for (const v of open) await evaluateVisit(v.id);
  return open.length;
}
