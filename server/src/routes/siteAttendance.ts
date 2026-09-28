import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ATTENDANCE_VIEW_ROLES, OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { distanceMeters, SITE_GEOFENCE_RADIUS_METERS } from "../lib/geo";
import { notifyEmployee, notifyRoles } from "../lib/notifications";
import { parseClockTime } from "../lib/clockTime";
import { checkLocationAgainstGps } from "../lib/locationMatch";
import { reverseGeocodeCached } from "../lib/reverseGeocode";
import { cancelPendingAudits, scheduleAuditTimes } from "../lib/attendanceAudit";
import { claimRequest, releaseRequest } from "../lib/idempotency";
import { notifyHrOfOvertime } from "../lib/overtimeQueue";
import { buildAttendanceReport, parseRange } from "../lib/attendanceReport";
import { computeLateByVisit, computeOvertimeDays, dayToDate, mauritiusDay, MAURITIUS_OFFSET_MINUTES } from "../lib/overtime";
import { generateStaffAttendancePdf } from "../lib/pdf/staffAttendancePdf";
import { isPhotoRequired, parseAttendancePhoto } from "../lib/attendancePhoto";
import { evaluateVisit, parseClientSentAt } from "../lib/anomalies";
import { liveStatus } from "../lib/liveMap";

const router = Router();

router.use(requireAuth);

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };
const WORK_ORDER_SUMMARY_SELECT = {
  select: { id: true, workOrderNumber: true, title: true, siteLat: true, siteLng: true },
} as const;
const VERIFICATIONS_INCLUDE = { orderBy: { checkedAt: "desc" as const } };
/** Compliance-check history for a session, oldest first - so a manager reads it as a timeline. */
const AUDITS_INCLUDE = { orderBy: { scheduledAt: "asc" as const } };
/** Whether a visit has a check-in photo - never the bytes, which only GET /:id/photo serves. */
const PHOTO_SUMMARY_SELECT = { select: { id: true, createdAt: true } } as const;
/** Enough of each anomaly for the register's Verified / Unverified / Flagged badge. */
const ANOMALY_SUMMARY_SELECT = { select: { id: true, type: true, severity: true, status: true } } as const;

const EXIT_REASONS = ["MATERIALS", "ANOTHER_SITE", "SUPERVISOR_INSTRUCTION", "EMERGENCY", "OTHER"] as const;
type ExitReason = (typeof EXIT_REASONS)[number];

function parseCoords(body: unknown): { lat: number; lng: number } | null {
  const { lat, lng } = (body as { lat?: unknown; lng?: unknown }) ?? {};
  if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
  if (typeof lng !== "number" || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Beyond this the "accuracy" is meaningless (a whole-country guess) - stored capped, never rejected. */
const MAX_ACCURACY_METERS = 100_000;
/** A device clock further off than this from the server is junk rather than skew - not stored. */
const MAX_DEVICE_CLOCK_DRIFT_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The phone's accuracy radius and fix time that come with a GPS reading. Both are advisory context
 * for reviewers - neither is ever a reason to refuse a check-in, so junk just becomes null. The
 * device time is never used for late/overtime/hours; the server receive time is the official one.
 */
export function parseFixMeta(body: unknown, now = new Date()): { accuracyMeters: number | null; deviceAt: Date | null } {
  const { accuracy, deviceTime } = (body as { accuracy?: unknown; deviceTime?: unknown }) ?? {};

  const accuracyMeters =
    typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0
      ? Math.min(Math.round(accuracy), MAX_ACCURACY_METERS)
      : null;

  let deviceAt: Date | null = null;
  if (typeof deviceTime === "number" || typeof deviceTime === "string") {
    const parsed = new Date(deviceTime);
    if (!Number.isNaN(parsed.getTime()) && Math.abs(parsed.getTime() - now.getTime()) <= MAX_DEVICE_CLOCK_DRIFT_MS) {
      deviceAt = parsed;
    }
  }

  return { accuracyMeters, deviceAt };
}

function parseNote(body: unknown): string | null {
  const note = (body as { note?: unknown } | null)?.note;
  return typeof note === "string" && note.trim() ? note.trim().slice(0, 200) : null;
}

/** The site name the technician typed. Optional, display only - never geocoded. */
function parseSite(body: unknown): string | null {
  const site = (body as { site?: unknown } | null)?.site;
  return typeof site === "string" && site.trim() ? site.trim().slice(0, 200) : null;
}

/** Upper bound on a single leg's travel cost - a sanity guard against a fat-fingered entry, not a policy. */
const MAX_TRANSPORT_COST = 100_000;

/**
 * Travel cost for one leg, in MUR. Absent/blank is a valid answer ("if applicable"), so this
 * returns a tri-state: `{ value }` for a usable number including none, `{ error }` for junk.
 * Accepts a numeric string as well as a number - the form sends `e.target.value`, and
 * `Number.isFinite("250")` is false, which is exactly how the quotation payment-terms percentage
 * silently failed every real submission once already (CLAUDE.md §9). The client converts too;
 * this is the belt to that pair of braces.
 */
export function parseTransportCost(value: unknown): { value: number | null } | { error: string } {
  if (value === undefined || value === null || value === "") return { value: null };
  const amount = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return { error: "Transport cost must be a number" };
  }
  if (amount < 0) return { error: "Transport cost cannot be negative" };
  if (amount > MAX_TRANSPORT_COST) return { error: `Transport cost looks wrong - keep it under ${MAX_TRANSPORT_COST}` };
  return { value: Math.round(amount * 100) / 100 };
}

/** The typed arrival/departure time. Optional, but rejected outright if present and unparseable. */
export function parseDeclaredTime(value: unknown): { value: string | null } | { error: string } {
  if (value === undefined || value === null || value === "") return { value: null };
  const parsed = parseClockTime(value);
  if (!parsed) return { error: "Time must be in HH:MM format" };
  return { value: parsed };
}

/** [start, end) bounds for a "YYYY-MM" month string, falling back to the current UTC month. */
function monthRange(value: unknown): { start: Date; end: Date } {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  const now = new Date();
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end };
}

/** Parses "YYYY-MM-DD" to UTC midnight - same convention as every other filter in this codebase. */
function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * An explicit from/to day range wins over `month` when both days are supplied. A week is the
 * point of this - and a week regularly straddles a month boundary, which the month-only version
 * could never express. `to` is inclusive of that whole day, so the exclusive end is the next
 * midnight. Falls back to the month behaviour so existing callers are unaffected.
 */
function reportRange(query: Record<string, unknown>): { start: Date; end: Date } {
  const from = parseDateOnly(query.from);
  const to = parseDateOnly(query.to);
  if (from && to && to >= from) {
    return { start: from, end: new Date(to.getTime() + 24 * 60 * 60 * 1000) };
  }
  return monthRange(query.month);
}

/** Team-wide view for managers: who's checked in right now, plus the given month's history (defaults to this month). */
router.get("/", requireRole(...ATTENDANCE_VIEW_ROLES), async (req, res) => {
  const { start, end } = reportRange(req.query as Record<string, unknown>);
  const { employeeId, includePast } = req.query;
  const employeeFilter = typeof employeeId === "string" && employeeId ? { employeeId } : {};
  // Defaults to current staff only (ON_LEAVE still counts as current - same convention as
  // isAssignable() on the client - only TERMINATED is excluded). A departed employee's history
  // still exists and is never deleted; ?includePast=true brings it back for payroll/audit lookups.
  const activeFilter = includePast === "true" ? {} : { employee: { employmentStatus: { not: "TERMINATED" as const } } };

  const [current, history] = await Promise.all([
    prisma.siteAttendance.findMany({
      where: { checkOutAt: null, ...employeeFilter, ...activeFilter },
      include: { employee: { select: EMPLOYEE_SELECT }, workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE, audits: AUDITS_INCLUDE, checkInPhoto: PHOTO_SUMMARY_SELECT, anomalies: ANOMALY_SUMMARY_SELECT },
      orderBy: { checkInAt: "desc" },
    }),
    prisma.siteAttendance.findMany({
      where: { checkInAt: { gte: start, lt: end }, ...employeeFilter, ...activeFilter },
      include: { employee: { select: EMPLOYEE_SELECT }, workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE, audits: AUDITS_INCLUDE, checkInPhoto: PHOTO_SUMMARY_SELECT, anomalies: ANOMALY_SUMMARY_SELECT },
      orderBy: { checkInAt: "desc" },
    }),
  ]);

  // Per-technician roll-up for the month, built from the same `history` rows rather than a
  // separate query - keeps "days present" (distinct calendar days) and the on-site/outside-site
  // verification trust counters right next to the register that already has this data.
  const summaryByEmployee = new Map<
    string,
    {
      employee: (typeof history)[number]["employee"];
      days: Set<string>;
      totalCheckIns: number;
      totalHoursOnSite: number;
      totalTransportCost: number;
      locationMismatchCount: number;
    }
  >();
  for (const v of history) {
    if (!v.employee) continue;
    const key = v.employeeId;
    if (!summaryByEmployee.has(key)) {
      summaryByEmployee.set(key, {
        employee: v.employee,
        days: new Set(),
        totalCheckIns: 0,
        totalHoursOnSite: 0,
        totalTransportCost: 0,
        locationMismatchCount: 0,
      });
    }
    const entry = summaryByEmployee.get(key)!;
    entry.days.add(v.checkInAt.toISOString().slice(0, 10));
    entry.totalCheckIns += 1;
    // Both legs of the trip. Decimal columns come back as Prisma.Decimal, hence the Number().
    entry.totalTransportCost += Number(v.checkInTransportCost ?? 0) + Number(v.checkOutTransportCost ?? 0);
    if (v.checkOutAt) {
      entry.totalHoursOnSite += (v.checkOutAt.getTime() - v.checkInAt.getTime()) / 3_600_000;
    }
    // Only outright mismatches are counted. UNCHECKABLE is the ordinary result for text like
    // "Office" and carries no meaning, so folding it in here would make honest weeks look bad.
    if (v.checkInLocationMatch === "MISMATCH") entry.locationMismatchCount += 1;
    if (v.checkOutLocationMatch === "MISMATCH") entry.locationMismatchCount += 1;
  }
  const summary = Array.from(summaryByEmployee.values())
    .map((s) => ({
      employee: s.employee,
      daysPresent: s.days.size,
      totalCheckIns: s.totalCheckIns,
      totalHoursOnSite: Math.round(s.totalHoursOnSite * 10) / 10,
      totalTransportCost: Math.round(s.totalTransportCost * 100) / 100,
      locationMismatchCount: s.locationMismatchCount,
    }))
    .sort((a, b) => b.daysPresent - a.daysPresent);

  res.json({ current, history, summary });
});

/**
 * The Live Map (spec section 7): everyone on shift now, each with their check-in point, their
 * latest location reading (a 15-minute ping or an answered compliance check - whichever is
 * newer), the distance between the two, minutes since they were last seen, and a colour
 * (lib/liveMap.ts). The page polls this every 15 s. Shifts open longer than 36 h are left out -
 * those are forgotten check-outs (Team Attendance flags them), not people in the field.
 */
router.get("/live", requireRole(...ATTENDANCE_VIEW_ROLES), async (req, res) => {
  const now = new Date();
  const visits = await prisma.siteAttendance.findMany({
    where: {
      checkOutAt: null,
      checkInAt: { gte: new Date(now.getTime() - 36 * 3_600_000) },
      employee: { employmentStatus: { not: "TERMINATED" } },
    },
    select: {
      id: true,
      checkInAt: true,
      checkInLat: true,
      checkInLng: true,
      checkInPlace: true,
      checkInSite: true,
      checkInNote: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
      workOrder: { select: { id: true, workOrderNumber: true, title: true } },
      pings: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, lat: true, lng: true, accuracyMeters: true } },
      audits: {
        where: { lat: { not: null }, respondedAt: { not: null } },
        orderBy: { respondedAt: "desc" },
        take: 1,
        select: { respondedAt: true, lat: true, lng: true, place: true },
      },
      anomalies: { where: { status: "OPEN" }, select: { severity: true } },
    },
    orderBy: { checkInAt: "asc" },
  });

  const shifts = visits.map((v) => {
    const ping = v.pings[0];
    const audit = v.audits[0];
    const latest =
      ping && (!audit || ping.createdAt >= audit.respondedAt!)
        ? { kind: "PING" as const, at: ping.createdAt, lat: Number(ping.lat), lng: Number(ping.lng), accuracyMeters: ping.accuracyMeters }
        : audit
          ? { kind: "AUDIT" as const, at: audit.respondedAt!, lat: Number(audit.lat), lng: Number(audit.lng), accuracyMeters: null }
          : null;
    const anchor = { lat: Number(v.checkInLat), lng: Number(v.checkInLng) };
    const distance = latest ? Math.round(distanceMeters(anchor.lat, anchor.lng, latest.lat, latest.lng)) : null;
    const lastSeenAt = latest?.at ?? v.checkInAt;
    const minutesSinceLastFix = Math.round((now.getTime() - lastSeenAt.getTime()) / 60_000);
    return {
      id: v.id,
      employee: v.employee,
      workOrder: v.workOrder,
      checkIn: { at: v.checkInAt, ...anchor, place: v.checkInPlace, site: v.checkInSite, note: v.checkInNote },
      latest,
      distanceFromCheckInMeters: distance,
      lastSeenAt,
      minutesSinceLastFix,
      openAnomalies: v.anomalies.length,
      status: liveStatus({ openSeverities: v.anomalies.map((a) => a.severity), distanceFromCheckInMeters: distance, minutesSinceLastFix }),
    };
  });

  res.json({ generatedAt: now, shifts });
});

/**
 * The whole team's register over a date range, as a printable PDF — the admin's export of the
 * Staff Attendance table. Unlike the employee's own report (`/me/report/pdf`) this one prints the
 * GPS and the app's own timestamps alongside what was typed, and has no validation/DRAFT concept:
 * it is an internal management listing, not an official per-employee sheet.
 */
router.get("/report/pdf", requireRole(...ATTENDANCE_VIEW_ROLES), async (req, res) => {
  const range = parseRange(req.query.from, req.query.to);
  if ("error" in range) return res.status(400).json({ error: range.error });

  const offset = MAURITIUS_OFFSET_MINUTES * 60_000;
  const start = new Date(dayToDate(range.from).getTime() - offset);
  const end = new Date(dayToDate(range.to).getTime() + 86_400_000 - offset);
  // Same includePast convention as the register endpoint above - without this, the PDF could
  // silently include departed employees the screen it was exported from was actively hiding.
  const activeFilter =
    req.query.includePast === "true" ? {} : { employee: { employmentStatus: { not: "TERMINATED" as const } } };

  const [rows, decisions] = await Promise.all([
    prisma.siteAttendance.findMany({
      where: { checkInAt: { gte: start, lt: end }, ...activeFilter },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { checkInAt: "asc" },
    }),
    prisma.overtimeDecision.findMany({
      where: { status: "APPROVED", date: { gte: dayToDate(range.from), lte: dayToDate(range.to) } },
      select: { employeeId: true, date: true, minutes: true },
    }),
  ]);

  const visits = rows.map((v) => ({
    ...v,
    employeeName: v.employee ? `${v.employee.firstName} ${v.employee.lastName}` : "—",
  }));

  // Overtime hangs off each employee-day's last check-in, exactly as it does on screen.
  const lastOfDay = new Map<string, (typeof visits)[number]>();
  for (const v of visits) {
    const key = `${v.employeeId}|${mauritiusDay(v.checkInAt)}`;
    const current = lastOfDay.get(key);
    if (!current || v.checkInAt > current.checkInAt) lastOfDay.set(key, v);
  }
  const approvedOvertime = new Map<string, number>();
  for (const d of decisions) {
    const v = lastOfDay.get(`${d.employeeId}|${d.date.toISOString().slice(0, 10)}`);
    if (v && d.minutes > 0) approvedOvertime.set(v.id, d.minutes);
  }
  const pendingOvertime = new Map<string, number>();
  for (const day of computeOvertimeDays(visits)) {
    const v = lastOfDay.get(`${day.employeeId}|${day.date}`);
    if (v && day.minutes > 0 && !approvedOvertime.has(v.id)) pendingOvertime.set(v.id, day.minutes);
  }

  const doc = generateStaffAttendancePdf({
    from: range.from,
    to: range.to,
    visits,
    late: computeLateByVisit(visits),
    approvedOvertime,
    pendingOvertime,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="staff-attendance-${range.from}-to-${range.to}.pdf"`);
  doc.pipe(res);
});

/**
 * A visit's check-in photo, for the people who can read the attendance register. 404 when there
 * never was one or it has passed the 90-day retention (lib/attendancePhoto.ts) - the visit's times
 * and GPS outlive the photo.
 */
router.get("/:id/photo", requireRole(...ATTENDANCE_VIEW_ROLES), async (req, res) => {
  const photo = await prisma.siteAttendancePhoto.findUnique({ where: { siteAttendanceId: req.params.id as string } });
  if (!photo) return res.status(404).json({ error: "No check-in photo for this visit" });
  res.setHeader("Content-Type", photo.mimeType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(Buffer.from(photo.data));
});

// A supervisor-triggered nudge, not a live remote GPS ping: it asks the technician to open the
// app, and the widget then verifies on mount. True push-to-device would need new infrastructure
// (a push subscription); this reuses the existing notification system for a cheap, honest version.
// The message deliberately doesn't mention location - the technician's own widget no longer
// surfaces the tracking back at them, so telling them to "verify your location" here would
// reintroduce exactly what that change removed.
router.post("/:id/request-verification", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const session = await prisma.siteAttendance.findUnique({ where: { id }, select: { employeeId: true, checkOutAt: true } });
  if (!session) return res.status(404).json({ error: "Site attendance session not found" });
  if (session.checkOutAt) return res.status(400).json({ error: "This technician has already checked out" });

  await notifyEmployee(session.employeeId, "LOCATION_CHECK_REQUESTED", "Your supervisor asked you to open the app", {
    message: "Please open My Attendance on the dashboard.",
    link: "/dashboard",
  });
  res.json({ ok: true });
});

/**
 * Closes a session the technician forgot to check out of.
 *
 * Deliberately records no coordinates: nobody observed where they were, and writing a position
 * nobody captured would put a fabricated location into the record this system exists to be
 * trusted on. `checkOutByManager` keeps an administrative close from reading as a real one.
 *
 * `checkOutAt` is optional and exists because "now" is usually the wrong answer - a session left
 * open since last week would otherwise book a 163-hour visit into that month's hours. A manager
 * who knows the technician actually left at 17:00 on the 27th can say so.
 */
router.post("/:id/close", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { checkOutAt, note } = req.body ?? {};

  const session = await prisma.siteAttendance.findUnique({
    where: { id },
    select: { id: true, checkInAt: true, checkOutAt: true },
  });
  if (!session) return res.status(404).json({ error: "Site attendance session not found" });
  if (session.checkOutAt) return res.status(400).json({ error: "This session is already closed" });

  let closedAt = new Date();
  if (checkOutAt !== undefined && checkOutAt !== null && checkOutAt !== "") {
    const parsed = new Date(checkOutAt);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: "Provide a valid check-out date and time" });
    }
    if (parsed <= session.checkInAt) {
      return res.status(400).json({ error: "Check-out must be after the check-in" });
    }
    if (parsed.getTime() > Date.now() + 60_000) {
      return res.status(400).json({ error: "Check-out cannot be in the future" });
    }
    closedAt = parsed;
  }

  const siteAttendance = await prisma.siteAttendance.update({
    where: { id },
    data: {
      checkOutAt: closedAt,
      checkOutByManager: true,
      checkOutNote: typeof note === "string" && note.trim() ? note.trim().slice(0, 200) : "Closed by management",
    },
    include: { employee: { select: EMPLOYEE_SELECT }, workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE, audits: AUDITS_INCLUDE },
  });
  await notifyHrOfOvertime(siteAttendance.employeeId, siteAttendance.checkInAt);
  await cancelPendingAudits(siteAttendance.id);
  res.json({ siteAttendance });
});

router.get("/me", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const [current, history] = await Promise.all([
    prisma.siteAttendance.findFirst({
      where: { employeeId: employee.id, checkOutAt: null },
      include: { workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE, audits: AUDITS_INCLUDE },
    }),
    prisma.siteAttendance.findMany({
      where: { employeeId: employee.id },
      include: { workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE, audits: AUDITS_INCLUDE },
      orderBy: { checkInAt: "desc" },
      take: 10,
    }),
  ]);

  // photoRequired rides along so the check-in card knows whether to ask for the camera.
  res.json({ current, history, photoRequired: isPhotoRequired() });
});

/**
 * The caller's own attendance for a month (?month=YYYY-MM, default this month) — the "My
 * Attendance" history on their landing page. Deliberately only what they entered themselves plus
 * the recorded times: no coordinates and no location-match result, since the technician's own
 * screen doesn't surface the tracking back at them (CLAUDE.md §7a). Managers see all of it.
 */
router.get("/me/history", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const { start, end } = monthRange(req.query.month);
  const visits = await prisma.siteAttendance.findMany({
    where: { employeeId: employee.id, checkInAt: { gte: start, lt: end } },
    select: {
      id: true,
      checkInAt: true,
      checkInDeclaredTime: true,
      checkInNote: true,
      checkInSite: true,
      checkInTransportCost: true,
      checkInTransportNote: true,
      checkOutAt: true,
      checkOutDeclaredTime: true,
      checkOutNote: true,
      checkOutSite: true,
      checkOutTransportCost: true,
      checkOutTransportNote: true,
      checkOutByManager: true,
      workOrder: { select: { id: true, workOrderNumber: true, title: true } },
    },
    orderBy: { checkInAt: "desc" },
  });

  // Overtime only shows once HR has approved it (routes/overtime.ts).
  const approved = await prisma.overtimeDecision.findMany({
    where: { employeeId: employee.id, status: "APPROVED", date: { gte: start, lt: end } },
    select: { date: true, minutes: true },
  });
  const approvedOvertime = approved.map((d) => ({ date: d.date.toISOString().slice(0, 10), minutes: d.minutes }));

  res.json({ visits, approvedOvertime });
});

/**
 * The caller's own attendance as a printable PDF for a date range (?from=YYYY-MM-DD&to=YYYY-MM-DD).
 * DRAFT-watermarked unless Admin/HR has validated a range covering it and nothing has changed since
 * (lib/attendanceReport.ts). No coordinates or location flags.
 */
router.get("/me/report/pdf", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub }, select: { id: true } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const range = parseRange(req.query.from, req.query.to);
  if ("error" in range) return res.status(400).json({ error: range.error });

  const report = await buildAttendanceReport(employee.id, range.from, range.to);
  if (!report) return res.status(404).json({ error: "Employee not found" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
  report.doc.pipe(res);
});

/** The caller's own assigned, still-open work orders — for the "which job?" picker on check-in. */
router.get("/my-work-orders", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const workOrders = await prisma.workOrder.findMany({
    where: {
      technicians: { some: { employeeId: employee.id } },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      customer: { select: { id: true, name: true, company: true } },
    },
    orderBy: { scheduledDate: "desc" },
  });

  res.json({ workOrders });
});

router.post("/check-in", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });
  const fix = parseFixMeta(req.body);
  // The typed location is optional (user request, 2026-09-14); the GPS fix is still required.
  const note = parseNote(req.body);

  const declaredTime = parseDeclaredTime((req.body as { timeIn?: unknown })?.timeIn);
  if ("error" in declaredTime) return res.status(400).json({ error: declaredTime.error });
  const transportCost = parseTransportCost((req.body as { transportCost?: unknown })?.transportCost);
  if ("error" in transportCost) return res.status(400).json({ error: transportCost.error });
  const transportNote = parseNote({ note: (req.body as { transportNote?: unknown })?.transportNote });
  if (transportCost.value === 0 && !transportNote) {
    return res.status(400).json({ error: "Explain why transport cost is zero" });
  }
  const photo = parseAttendancePhoto((req.body as { photo?: unknown })?.photo);
  if ("error" in photo) return res.status(400).json({ error: photo.error });
  if (!photo.photo && isPhotoRequired()) {
    return res.status(400).json({ error: "Take a check-in photo first", code: "PHOTO_REQUIRED" });
  }

  // A check-in queued offline is replayed on reconnect; if the first attempt actually landed
  // before the signal dropped, hand back the open session rather than creating a second one.
  const clientRequestId = (req.body as { clientRequestId?: unknown })?.clientRequestId;
  if (!(await claimRequest(clientRequestId, "site-check-in"))) {
    const existing = await prisma.siteAttendance.findFirst({
      where: { employee: { userId: req.user!.sub }, checkOutAt: null },
      include: { workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE, audits: AUDITS_INCLUDE },
    });
    return res.status(200).json({ siteAttendance: existing, deduped: true });
  }

  try {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
    if (!employee) {
      await releaseRequest(clientRequestId);
      return res.status(403).json({ error: "No employee record is linked to your account" });
    }

    const openVisit = await prisma.siteAttendance.findFirst({
      where: { employeeId: employee.id, checkOutAt: null },
    });
    if (openVisit) {
      // Usually a stale screen - checked in from another phone, or an offline check-in that has
      // since synced. The code and the open session let the app offer "check out of that one"
      // instead of a dead end.
      await releaseRequest(clientRequestId);
      return res.status(409).json({
        error: "You are already checked in. Check out of your open visit first.",
        code: "ALREADY_CHECKED_IN",
        openSession: {
          id: openVisit.id,
          checkInAt: openVisit.checkInAt,
          checkInSite: openVisit.checkInSite,
          checkInNote: openVisit.checkInNote,
        },
      });
    }

    // The technician optionally picks which job they're on. It must be one assigned to them and
    // still open — a check-in that names a stranger's job or a closed one is refused. The link is
    // display + Team Attendance context only; it does not drive the (inert) geofence path.
    const rawWorkOrderId = (req.body as { workOrderId?: unknown }).workOrderId;
    let workOrderId: string | null = null;
    if (typeof rawWorkOrderId === "string" && rawWorkOrderId) {
      const wo = await prisma.workOrder.findUnique({
        where: { id: rawWorkOrderId },
        select: { status: true, technicians: { where: { employeeId: employee.id }, select: { id: true } } },
      });
      if (!wo || wo.technicians.length === 0) {
        await releaseRequest(clientRequestId);
        return res.status(400).json({ error: "That work order isn't one of your assigned jobs" });
      }
      if (wo.status === "COMPLETED" || wo.status === "CANCELLED") {
        await releaseRequest(clientRequestId);
        return res.status(400).json({ error: "That job is already closed" });
      }
      workOrderId = rawWorkOrderId;
    }

    // Both advisory, both run in parallel - neither ever blocks a technician from checking in.
    // reverseGeocodeCached resolves once here rather than live on every admin page view later
    // (CLAUDE.md, reverse-geocoding note) - a cache hit is instant, a miss costs one Nominatim
    // round trip that every future check-in at the same site skips entirely.
    const [locationCheck, checkInPlace] = await Promise.all([
      checkLocationAgainstGps(note, coords),
      reverseGeocodeCached(coords.lat, coords.lng),
    ]);

    const siteAttendance = await prisma.siteAttendance.create({
      data: {
        employeeId: employee.id,
        workOrderId,
        checkInLat: coords.lat,
        checkInLng: coords.lng,
        checkInAccuracyMeters: fix.accuracyMeters,
        checkInDeviceAt: fix.deviceAt,
        checkInPlace,
        checkInNote: note,
        checkInSite: parseSite(req.body),
        checkInDeclaredTime: declaredTime.value,
        checkInTransportCost: transportCost.value,
        checkInTransportNote: transportNote,
        checkInLocationMatch: locationCheck.match,
        checkInLocationDistanceMeters: locationCheck.distanceMeters,
        // Created with the visit, in the same write, so a check-in never lands without its photo.
        checkInPhoto: photo.photo
          ? {
              create: {
                // Same cast as daily report photos: a Node Buffer is a Uint8Array, Prisma's Bytes type just narrows its backing store.
                data: photo.photo.buffer as unknown as Uint8Array<ArrayBuffer>,
                mimeType: photo.photo.mimeType,
                lat: coords.lat,
                lng: coords.lng,
              },
            }
          : undefined,
      },
      include: { workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE, audits: AUDITS_INCLUDE },
    });

    // 2-4 random "are you still there" audit pings, timed against this check-in - see
    // lib/attendanceAudit.ts. Scheduled here, sent later by the poller (POST
    // /api/push/run-attendance-audits); any still PENDING at checkout are cancelled below.
    const auditTimes = scheduleAuditTimes(siteAttendance.checkInAt);
    await prisma.attendanceAudit.createMany({
      data: auditTimes.map((scheduledAt) => ({
        siteAttendanceId: siteAttendance.id,
        employeeId: employee.id,
        scheduledAt,
      })),
    });

    // Anomaly rules (lib/anomalies.ts). Not awaited: the technician's check-in must not wait on
    // them, and evaluateVisit never throws. Re-run on every later event of the visit anyway.
    void evaluateVisit(siteAttendance.id, {
      leg: "CHECK_IN",
      clientSentAt: parseClientSentAt(req.body),
      serverAt: siteAttendance.checkInAt,
    });

    // Only a genuinely new check-in reaches here - the deduped-replay branch above already
    // returned. Scoped to OPS_MANAGE_ROLES (not HR): Team Attendance/Field Operations, the screens
    // this links to, are already OPS_MANAGE_ROLES-gated, so notifying HR would point at a page
    // they can't open.
    await notifyRoles(
      OPS_MANAGE_ROLES,
      "SITE_CHECKIN_RECORDED",
      `${employee.firstName} ${employee.lastName} checked in`,
      { message: note ?? undefined, link: "/dashboard/operations/field-tracking" },
    );

    res.status(201).json({ siteAttendance });
  } catch (err) {
    await releaseRequest(clientRequestId);
    throw err;
  }
});

router.post("/check-out", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });
  const fix = parseFixMeta(req.body);

  const declaredTime = parseDeclaredTime((req.body as { timeOut?: unknown })?.timeOut);
  if ("error" in declaredTime) return res.status(400).json({ error: declaredTime.error });
  const transportCost = parseTransportCost((req.body as { transportCost?: unknown })?.transportCost);
  if ("error" in transportCost) return res.status(400).json({ error: transportCost.error });
  const transportNote = parseNote({ note: (req.body as { transportNote?: unknown })?.transportNote });
  if (transportCost.value === 0 && !transportNote) {
    return res.status(400).json({ error: "Explain why transport cost is zero" });
  }

  // As with check-in: a replay of a check-out that already landed returns the last session
  // rather than the "not currently checked in" 404 that would otherwise alarm the technician.
  const clientRequestId = (req.body as { clientRequestId?: unknown })?.clientRequestId;
  if (!(await claimRequest(clientRequestId, "site-check-out"))) {
    const last = await prisma.siteAttendance.findFirst({
      where: { employee: { userId: req.user!.sub } },
      orderBy: { checkInAt: "desc" },
      include: { workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE, audits: AUDITS_INCLUDE },
    });
    return res.status(200).json({ siteAttendance: last, deduped: true });
  }

  try {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
    if (!employee) {
      await releaseRequest(clientRequestId);
      return res.status(403).json({ error: "No employee record is linked to your account" });
    }

    const openVisit = await prisma.siteAttendance.findFirst({
      where: { employeeId: employee.id, checkOutAt: null },
    });
    if (!openVisit) {
      await releaseRequest(clientRequestId);
      return res.status(404).json({ error: "You are not currently checked in" });
    }

    // checkInAt is stamped by the database clock and this by the app server's, so in principle
    // the two can disagree. A check-out at or before its check-in is impossible - refuse it rather
    // than store a session with negative hours.
    const checkOutAt = new Date();
    if (checkOutAt.getTime() <= openVisit.checkInAt.getTime()) {
      await releaseRequest(clientRequestId);
      return res.status(400).json({ error: "Check-out must be after the check-in. Wait a moment and try again." });
    }

    const checkOutNote = parseNote(req.body);
    const [locationCheck, checkOutPlace] = await Promise.all([
      checkLocationAgainstGps(checkOutNote, coords),
      reverseGeocodeCached(coords.lat, coords.lng),
    ]);

    const siteAttendance = await prisma.siteAttendance.update({
      where: { id: openVisit.id },
      data: {
        checkOutAt,
        checkOutLat: coords.lat,
        checkOutLng: coords.lng,
        checkOutAccuracyMeters: fix.accuracyMeters,
        checkOutDeviceAt: fix.deviceAt,
        checkOutPlace,
        checkOutNote,
        checkOutSite: parseSite(req.body),
        checkOutDeclaredTime: declaredTime.value,
        checkOutTransportCost: transportCost.value,
        checkOutTransportNote: transportNote,
        checkOutLocationMatch: locationCheck.match,
        checkOutLocationDistanceMeters: locationCheck.distanceMeters,
      },
      include: { workOrder: WORK_ORDER_SUMMARY_SELECT, verifications: VERIFICATIONS_INCLUDE, audits: AUDITS_INCLUDE },
    });
    await notifyHrOfOvertime(siteAttendance.employeeId, siteAttendance.checkInAt);
    // Nothing should ping after the shift has ended - cancel whatever audits were still pending.
    await cancelPendingAudits(siteAttendance.id);
    void evaluateVisit(siteAttendance.id, { leg: "CHECK_OUT", clientSentAt: parseClientSentAt(req.body), serverAt: checkOutAt });
    res.json({ siteAttendance });
  } catch (err) {
    await releaseRequest(clientRequestId);
    throw err;
  }
});

/** Pings closer together than this are ignored - a phone flipping in and out of the app. */
const MIN_PING_INTERVAL_MS = 2 * 60 * 1000;

/**
 * A location reading during an open shift (spec section 4): sent by the app every 15 minutes and
 * whenever it returns to the foreground - only while the app is open, since a web app cannot read
 * the location in the background (client/src/lib/useShiftPings.ts). Stored as an AttendancePing
 * and evaluated against the anomaly rules (left the work area, travel, fake GPS, missed pings).
 *
 * Like the audit confirm, the response carries no verdict: the technician's own screen never
 * shows on-site/off-site results (CLAUDE.md §7a).
 */
router.post("/ping", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });
  const fix = parseFixMeta(req.body);

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub }, select: { id: true } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const visit = await prisma.siteAttendance.findFirst({
    where: { employeeId: employee.id, checkOutAt: null },
    select: { id: true, pings: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
  });
  if (!visit) return res.status(409).json({ error: "Not checked in", code: "NO_OPEN_SHIFT" });

  const last = visit.pings[0]?.createdAt;
  if (last && Date.now() - last.getTime() < MIN_PING_INTERVAL_MS) return res.json({ ok: true, skipped: true });

  await prisma.attendancePing.create({
    data: { siteAttendanceId: visit.id, lat: coords.lat, lng: coords.lng, accuracyMeters: fix.accuracyMeters, deviceAt: fix.deviceAt },
  });
  void evaluateVisit(visit.id);
  res.json({ ok: true });
});

/** A periodic (not continuous) re-check of the technician's location while checked in and linked to a work order. */
router.post("/verify-location", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { employeeId: employee.id, checkOutAt: null },
    include: { workOrder: true },
  });
  if (!openVisit) return res.status(404).json({ error: "You are not currently checked in" });

  if (openVisit.workOrder?.siteLat == null || openVisit.workOrder.siteLng == null) {
    return res.json({ skipped: true });
  }

  const distance = distanceMeters(
    coords.lat,
    coords.lng,
    Number(openVisit.workOrder.siteLat),
    Number(openVisit.workOrder.siteLng),
  );
  const verification = await prisma.siteVerification.create({
    data: {
      siteAttendanceId: openVisit.id,
      lat: coords.lat,
      lng: coords.lng,
      distanceMeters: Math.round(distance),
      status: distance <= SITE_GEOFENCE_RADIUS_METERS ? "ON_SITE" : "OUTSIDE_SITE",
    },
  });
  res.status(201).json({ verification });
});

router.post("/exit-reason", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const { reason, note } = req.body ?? {};
  if (typeof reason !== "string" || !EXIT_REASONS.includes(reason as ExitReason)) {
    return res.status(400).json({ error: "A valid reason is required" });
  }

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { employeeId: employee.id, checkOutAt: null },
  });
  if (!openVisit) return res.status(404).json({ error: "You are not currently checked in" });

  const recentChecks = await prisma.siteVerification.findMany({
    where: { siteAttendanceId: openVisit.id },
    orderBy: { checkedAt: "desc" },
  });
  // One reason covers the whole current excursion: every consecutive unexplained OUTSIDE_SITE
  // check back to the last ON_SITE check (or the start), not just the single latest row — a
  // technician away for 30+ minutes can miss several 10-minute periodic checks before explaining.
  const pendingIds: string[] = [];
  for (const check of recentChecks) {
    if (check.status !== "OUTSIDE_SITE" || check.exitReason) break;
    pendingIds.push(check.id);
  }
  if (pendingIds.length === 0) return res.status(404).json({ error: "No unexplained site departure to update" });

  const exitReasonNote = typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null;
  await prisma.siteVerification.updateMany({
    where: { id: { in: pendingIds } },
    data: { exitReason: reason as ExitReason, exitReasonNote },
  });
  const verification = await prisma.siteVerification.findUniqueOrThrow({ where: { id: pendingIds[0] } });
  res.json({ verification });
});

export default router;
