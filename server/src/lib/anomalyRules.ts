import { distanceMeters } from "./geo";
import { MAURITIUS_OFFSET_MINUTES } from "./overtime";
import type { AnomalySeverity, AnomalyType } from "../generated/prisma/client";

/**
 * The verified-attendance spec's anomaly rules (2026-09-26, section 5), as pure functions: each
 * takes plain values and returns findings, never touches the database, so every rule is unit
 * tested on its own (anomalyRules.test.ts). lib/anomalies.ts loads the data, calls these, and
 * records the results with de-duplication.
 *
 * Every finding carries a `key` naming the exact occurrence it is about (a fix, a pair of fixes,
 * a leg of the visit). Evaluating the same visit twice yields the same keys, which is what keeps
 * re-evaluation from double-counting.
 */

export interface Finding {
  type: AnomalyType;
  severity: AnomalySeverity;
  key: string;
  details: Record<string, unknown>;
}

/** One GPS reading from a visit: its check-in, check-out, an answered audit ping, or a shift ping. */
export interface Fix {
  key: string;
  kind: "CHECK_IN" | "CHECK_OUT" | "AUDIT" | "PING";
  at: Date;
  lat: number;
  lng: number;
  /** Phone-reported radius in metres; null where it wasn't recorded (audits, older rows). */
  accuracyMeters: number | null;
}

// Thresholds, as the spec states them.
export const FAR_FROM_JOB_METERS = 500;
export const NEAR_HOME_METERS = 300;
export const LEFT_WORK_AREA_METERS = 500;
export const IMPOSSIBLE_SPEED_KMH = 150;
export const LOW_ACCURACY_METERS = 200;
export const CLOCK_SKEW_MS = 5 * 60 * 1000;
export const TIME_MISMATCH_MINUTES = 15;
export const STATED_LOCATION_MISMATCH_METERS = 2000;
/** "Five or more consecutive fixes with identical coordinates". */
export const IDENTICAL_FIX_RUN = 5;
/**
 * A reading coarser than this is network/Wi-Fi positioning, which legitimately returns the very
 * same point again and again indoors - so it doesn't count toward the identical-fixes run.
 */
export const IDENTICAL_FIX_MAX_ACCURACY_METERS = 50;
/** MISSED_PING: more than this with no location reading during an open shift. */
export const MISSED_PING_MINUTES = 45;
/** "A jump away and back within minutes". */
export const JUMP_BACK_WINDOW_MS = 10 * 60 * 1000;
const JUMP_AWAY_METERS = 1000;
const JUMP_BACK_METERS = 150;
/**
 * Below this, "impossible travel" is just two noisy fixes taken seconds apart - 300m of GPS drift
 * in 5 seconds is 216 km/h on paper. A real jump has to clear both this floor and the two fixes'
 * own accuracy radii.
 */
const MIN_TRAVEL_METERS = 1000;

const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.round(distanceMeters(a.lat, a.lng, b.lat, b.lng));

/**
 * FAR_FROM_JOB: the check-in is more than 500 m from the linked job's coordinates. HIGH when a
 * manager set the job's site; MEDIUM when the coordinates were geocoded from the customer's own
 * address (spec section 2) - one customer often has several sites (CLAUDE.md §7b), so that may be
 * the office rather than the job, and "far from it" is weaker evidence.
 */
export function farFromJob(
  checkIn: Fix,
  job: { id: string; lat: number; lng: number; fromCustomerAddress?: boolean } | null,
): Finding[] {
  if (!job) return [];
  const distance = meters(checkIn, job);
  if (distance <= FAR_FROM_JOB_METERS) return [];
  return [
    {
      type: "FAR_FROM_JOB",
      severity: job.fromCustomerAddress ? "MEDIUM" : "HIGH",
      key: checkIn.key,
      details: { distanceMeters: distance, workOrderId: job.id, siteSource: job.fromCustomerAddress ? "CUSTOMER_ADDRESS" : "MANAGER" },
    },
  ];
}

/**
 * UNVERIFIED_LOCATION (low): no job linked and no known place matched - informational, so a
 * reviewer can confirm the spot and save it as a known place; the next check-in there then
 * matches and this stops appearing for it.
 */
export function unverifiedLocation(checkIn: Fix, context: { hasJob: boolean; knownPlaceId: string | null }): Finding[] {
  if (context.hasJob || context.knownPlaceId) return [];
  return [{ type: "UNVERIFIED_LOCATION", severity: "LOW", key: checkIn.key, details: {} }];
}

/**
 * CHECKIN_NEAR_HOME (high): the check-in is within 300 m of the employee's home, unless a job that
 * day is at that address. Home coordinates arrive with section 3; until then `home` is null and
 * this never fires.
 */
export function checkInNearHome(
  checkIn: Fix,
  home: { lat: number; lng: number } | null,
  jobsThatDay: { lat: number; lng: number }[],
): Finding[] {
  if (!home) return [];
  const distance = meters(checkIn, home);
  if (distance > NEAR_HOME_METERS) return [];
  if (jobsThatDay.some((job) => meters(job, home) <= NEAR_HOME_METERS)) return [];
  return [{ type: "CHECKIN_NEAR_HOME", severity: "HIGH", key: checkIn.key, details: { distanceMeters: distance } }];
}

/**
 * LEFT_WORK_AREA (medium): a fix during the shift - a 15-minute shift ping or an answered random
 * audit ping - more than 500 m from the check-in (the shift's anchor). Roaming jobs are exempt;
 * the caller simply doesn't run this rule for them (lib/anomalies.ts, ROAMING_JOB_CATEGORIES).
 */
export function leftWorkArea(anchor: Fix, fixes: Fix[]): Finding[] {
  return fixes
    .filter((f) => f.kind === "AUDIT" || f.kind === "PING")
    .map((f) => ({ fix: f, distance: meters(anchor, f) }))
    .filter(({ distance }) => distance > LEFT_WORK_AREA_METERS)
    .map(({ fix, distance }) => ({
      type: "LEFT_WORK_AREA" as const,
      severity: "MEDIUM" as const,
      key: fix.key,
      details: { distanceMeters: distance, at: fix.at.toISOString() },
    }));
}

/**
 * IMPOSSIBLE_TRAVEL (high): faster than 150 km/h between two consecutive fixes, across every
 * visit that day (pass the whole day's fixes, not one visit's).
 */
export function impossibleTravel(dayFixes: Fix[]): Finding[] {
  const sorted = [...dayFixes].sort((a, b) => a.at.getTime() - b.at.getTime());
  const findings: Finding[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const distance = meters(a, b);
    const noise = (a.accuracyMeters ?? 0) + (b.accuracyMeters ?? 0);
    if (distance < Math.max(MIN_TRAVEL_METERS, noise)) continue;
    const hours = (b.at.getTime() - a.at.getTime()) / 3_600_000;
    const kmh = hours > 0 ? distance / 1000 / hours : Infinity;
    if (kmh <= IMPOSSIBLE_SPEED_KMH) continue;
    findings.push({
      type: "IMPOSSIBLE_TRAVEL",
      severity: "HIGH",
      key: `${a.key}>${b.key}`,
      details: {
        distanceMeters: distance,
        minutes: Math.round(hours * 600) / 10,
        speedKmh: Number.isFinite(kmh) ? Math.round(kmh) : null,
        from: a.at.toISOString(),
        to: b.at.toISOString(),
      },
    });
  }
  return findings;
}

/**
 * MOCK_LOCATION_SUSPECTED (high) - heuristics only. A browser cannot see whether a fake-GPS app
 * is running; these are the patterns such apps tend to leave:
 * - an accuracy of exactly 0 (real receivers always report some uncertainty);
 * - five or more consecutive fixes with identical coordinates. The spec says "to 7 decimals", but
 *   coordinates are stored to 6 (~0.1 m), so identical-to-6 is the strictest check available -
 *   and real GPS repeating the same 0.1 m point five times is suspicious enough. Readings coarser
 *   than 50 m don't count: Wi-Fi positioning repeats the same point honestly;
 * - a jump of over 1 km away and straight back within 10 minutes.
 */
export function mockLocation(dayFixes: Fix[]): Finding[] {
  const sorted = [...dayFixes].sort((a, b) => a.at.getTime() - b.at.getTime());
  const findings: Finding[] = [];

  for (const f of sorted) {
    if (f.accuracyMeters === 0) {
      findings.push({ type: "MOCK_LOCATION_SUSPECTED", severity: "HIGH", key: `zero-accuracy:${f.key}`, details: { reason: "ZERO_ACCURACY", at: f.at.toISOString() } });
    }
  }

  const precise = (f: Fix) => f.accuracyMeters === null || f.accuracyMeters <= IDENTICAL_FIX_MAX_ACCURACY_METERS;
  const same = (a: Fix, b: Fix) =>
    precise(a) && precise(b) && a.lat.toFixed(6) === b.lat.toFixed(6) && a.lng.toFixed(6) === b.lng.toFixed(6);
  let runStart = 0;
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && same(sorted[i], sorted[runStart])) continue;
    const run = i - runStart;
    if (run >= IDENTICAL_FIX_RUN) {
      findings.push({
        type: "MOCK_LOCATION_SUSPECTED",
        severity: "HIGH",
        key: `identical:${sorted[runStart].key}`,
        details: { reason: "IDENTICAL_FIXES", count: run, from: sorted[runStart].at.toISOString(), to: sorted[i - 1].at.toISOString() },
      });
    }
    runStart = i;
  }

  for (let i = 2; i < sorted.length; i++) {
    const [a, b, c] = [sorted[i - 2], sorted[i - 1], sorted[i]];
    if (c.at.getTime() - a.at.getTime() > JUMP_BACK_WINDOW_MS) continue;
    if (meters(a, b) > JUMP_AWAY_METERS && meters(b, c) > JUMP_AWAY_METERS && meters(a, c) <= JUMP_BACK_METERS) {
      findings.push({
        type: "MOCK_LOCATION_SUSPECTED",
        severity: "HIGH",
        key: `jump:${b.key}`,
        details: { reason: "JUMP_AND_BACK", distanceMeters: meters(a, b), at: b.at.toISOString() },
      });
    }
  }
  return findings;
}

/** LOW_ACCURACY (low): the phone reported an accuracy radius worse than 200 m. */
export function lowAccuracy(fix: Fix): Finding[] {
  if (fix.accuracyMeters === null || fix.accuracyMeters <= LOW_ACCURACY_METERS) return [];
  return [{ type: "LOW_ACCURACY", severity: "LOW", key: fix.key, details: { accuracyMeters: fix.accuracyMeters } }];
}

/**
 * CLOCK_SKEW (medium): the phone's clock at the moment it sent the request differs from the
 * server's by more than 5 minutes. Deliberately *not* the GPS fix time: a check-in saved offline
 * and synced an hour later has an old fix time for a good reason, and that is not a clock problem.
 */
export function clockSkew(key: string, clientSentAt: Date | null, serverAt: Date): Finding[] {
  if (!clientSentAt) return [];
  const skewMs = clientSentAt.getTime() - serverAt.getTime();
  if (Math.abs(skewMs) <= CLOCK_SKEW_MS) return [];
  return [{ type: "CLOCK_SKEW", severity: "MEDIUM", key, details: { skewMinutes: Math.round(skewMs / 60_000) } }];
}

/** Minutes past midnight, Mauritius time, of an instant. */
function mauritiusMinutes(at: Date): number {
  const shifted = new Date(at.getTime() + MAURITIUS_OFFSET_MINUTES * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** Gap between two times of day, the short way round midnight. */
function clockGap(a: number, b: number): number {
  const diff = Math.abs(a - b) % 1440;
  return Math.min(diff, 1440 - diff);
}

const parseHHMM = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/**
 * TIME_MISMATCH (medium): the typed time differs from the recorded (server) time by more than 15
 * minutes. One exception, so an honest offline check-in isn't flagged: if the phone took its GPS
 * fix well before the server received it (the entry sat in the offline queue) and the typed time
 * matches that fix time, the typed time was right.
 */
export function timeMismatch(key: string, typed: string | null, recordedAt: Date, deviceAt: Date | null): Finding[] {
  if (!typed) return [];
  const typedMinutes = parseHHMM(typed);
  if (typedMinutes === null) return [];
  const gap = clockGap(typedMinutes, mauritiusMinutes(recordedAt));
  if (gap <= TIME_MISMATCH_MINUTES) return [];
  if (deviceAt) {
    const queuedMinutes = (recordedAt.getTime() - deviceAt.getTime()) / 60_000;
    if (queuedMinutes > TIME_MISMATCH_MINUTES && clockGap(typedMinutes, mauritiusMinutes(deviceAt)) <= TIME_MISMATCH_MINUTES) return [];
  }
  return [{ type: "TIME_MISMATCH", severity: "MEDIUM", key, details: { typed, gapMinutes: gap } }];
}

/**
 * STATED_LOCATION_MISMATCH (medium): the typed location geocodes more than 2 km from the GPS fix.
 * Replaces the old 10 km "X km from stated" flag. Note what CLAUDE.md §7a measured: a place name
 * resolves to an area centroid, and real honest check-ins sat 5-6 km from theirs ("Réduit",
 * "Ébène") - so at 2 km this will raise false positives that reviewers mark as such.
 */
export function statedLocationMismatch(key: string, typed: string | null, distance: number | null): Finding[] {
  if (!typed || distance === null || distance <= STATED_LOCATION_MISMATCH_METERS) return [];
  return [{ type: "STATED_LOCATION_MISMATCH", severity: "MEDIUM", key, details: { typed, distanceMeters: distance } }];
}

/**
 * MISSED_PING (low): more than 45 minutes with no location reading during an open shift - counted
 * from the check-in, through every ping and answered audit, to the check-out (or `now` while the
 * shift is still open). Low severity on purpose: a web app cannot read the location in the
 * background, so a technician who locks the phone or closes the app produces exactly this gap
 * without doing anything wrong. It records *when* the shift went unobserved; it is not by itself
 * evidence of leaving. Each gap is keyed by its start, so a still-growing gap is counted once.
 */
export function missedPings(checkInAt: Date, fixTimes: Date[], end: Date): Finding[] {
  const times = [checkInAt, ...fixTimes].map((d) => d.getTime()).filter((t) => t >= checkInAt.getTime() && t <= end.getTime());
  times.sort((a, b) => a - b);
  times.push(end.getTime());
  const findings: Finding[] = [];
  for (let i = 1; i < times.length; i++) {
    const minutes = Math.round((times[i] - times[i - 1]) / 60_000);
    if (minutes <= MISSED_PING_MINUTES) continue;
    const from = new Date(times[i - 1]).toISOString();
    findings.push({ type: "MISSED_PING", severity: "LOW", key: `gap:${from}`, details: { from, to: new Date(times[i]).toISOString(), minutes } });
  }
  return findings;
}
