import { LEFT_WORK_AREA_METERS, MISSED_PING_MINUTES } from "./anomalyRules";
import type { AnomalySeverity } from "../generated/prisma/client";

/**
 * The Live Map's colour for one technician on shift (spec 2026-09-26, section 7). Pure, so it is
 * tested on its own (liveMap.test.ts) and the page never has to re-derive it.
 *
 * - RED: an open HIGH anomaly on the shift, or the latest reading is more than 500 m from the
 *   check-in (the LEFT_WORK_AREA distance).
 * - AMBER: an open MEDIUM anomaly, or no location reading for more than 45 minutes (the
 *   MISSED_PING gap) - "not seen lately", which with a closed app is ordinary; hence amber, not red.
 * - GREEN: otherwise.
 *
 * LOW anomalies (low GPS accuracy, missed pings as recorded) don't colour anything on their own.
 */
export type LiveStatus = "GREEN" | "AMBER" | "RED";

export function liveStatus(input: {
  openSeverities: AnomalySeverity[];
  distanceFromCheckInMeters: number | null;
  minutesSinceLastFix: number;
}): LiveStatus {
  const { openSeverities, distanceFromCheckInMeters, minutesSinceLastFix } = input;
  if (openSeverities.includes("HIGH")) return "RED";
  if (distanceFromCheckInMeters !== null && distanceFromCheckInMeters > LEFT_WORK_AREA_METERS) return "RED";
  if (openSeverities.some((s) => s === "MEDIUM" || s === "STANDARD")) return "AMBER";
  if (minutesSinceLastFix > MISSED_PING_MINUTES) return "AMBER";
  return "GREEN";
}
