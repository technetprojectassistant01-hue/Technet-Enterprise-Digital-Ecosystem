import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { pushConfigured, sendPushToUser } from "../lib/push";
import { todayUtc } from "../lib/leaveRequests";
import { AUDIT_NUDGE_DELAY_MS, AUDIT_RESPONSE_WINDOW_MS, evaluateStrike } from "../lib/attendanceAudit";

const router = Router();

/**
 * The public VAPID key the browser needs in order to subscribe. Public by design - it is meant
 * to be shipped to clients, and is useless without the private half.
 *
 * Unauthenticated on purpose: it carries no information about anybody, and the client needs it
 * before it can do anything useful. `enabled` lets the UI hide the whole feature rather than
 * offering a button that silently does nothing where the keys aren't configured.
 */
router.get("/public-key", (_req, res) => {
  res.json({ enabled: pushConfigured, publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
});

router.post("/subscribe", requireAuth, async (req, res) => {
  const { endpoint, keys, userAgent } = req.body ?? {};

  if (typeof endpoint !== "string" || !endpoint) {
    return res.status(400).json({ error: "A push endpoint is required" });
  }
  const p256dh = (keys as { p256dh?: unknown } | undefined)?.p256dh;
  const auth = (keys as { auth?: unknown } | undefined)?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string") {
    return res.status(400).json({ error: "Push subscription keys are required" });
  }

  // Keyed on endpoint, not on user: the same browser re-subscribing must update its row rather
  // than create a second one, or every notification gets delivered twice to the same device.
  // An endpoint can also change hands if somebody else logs into that browser, hence the userId
  // is updated too rather than only set on create.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh,
      auth,
      userId: req.user!.sub,
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 300) : null,
    },
    update: {
      p256dh,
      auth,
      userId: req.user!.sub,
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 300) : null,
    },
  });

  res.status(201).json({ ok: true });
});

router.post("/unsubscribe", requireAuth, async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (typeof endpoint !== "string" || !endpoint) {
    return res.status(400).json({ error: "A push endpoint is required" });
  }
  // Scoped to the caller so one user can't unsubscribe another's device.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user!.sub } });
  res.json({ ok: true });
});

router.post("/unsubscribe-all", requireAuth, async (req, res) => {
  await prisma.pushSubscription.deleteMany({ where: { userId: req.user!.sub } });
  res.json({ ok: true });
});

/** Whether this user has any device registered - drives the toggle's state in the UI. */
router.get("/status", requireAuth, async (req, res) => {
  const count = await prisma.pushSubscription.count({ where: { userId: req.user!.sub } });
  res.json({ enabled: pushConfigured, devices: count });
});

router.post("/test", requireAuth, async (req, res) => {
  const delivered = await sendPushToUser(req.user!.sub, {
    title: "Technet reminder test",
    body: "Push reminders are working on this device.",
    url: "/dashboard",
    tag: "reminder-test",
  });
  res.json({ delivered });
});

function mauritiusToday(): Date {
  const now = new Date(Date.now() + 4 * 60 * 60 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Fires attendance reminders from an external scheduler. The Render free instance sleeps after
 * roughly 15 minutes idle, so GitHub Actions wakes it at 08:15 and 17:15 Mauritius time.
 *
 * Guarded by a shared secret rather than a session, because the caller is a machine. Returns 404
 * rather than 401 when the secret is wrong or unset, so the endpoint's existence isn't
 * advertised to anybody probing.
 */
async function sendAttendanceReminders(kind: "check-in" | "check-out", req: Request, res: Response) {
  const secret = process.env.REMINDER_TRIGGER_SECRET;
  const provided = req.get("x-reminder-secret");
  if (!secret || provided !== secret) return res.status(404).json({ error: "Not found" });

  const today = mauritiusToday();

  // A gazetted holiday cancels the whole run - nobody is expected on site, so nobody should be
  // nagged. The calendar is maintained by hand precisely because several Mauritius holidays move.
  const holiday = await prisma.publicHoliday.findFirst({ where: { date: today } });
  if (holiday) {
    return res.json({ skipped: `Public holiday: ${holiday.name}`, remindedUsers: 0, devicesReached: 0 });
  }

  const employees = await prisma.employee.findMany({
    where: {
      employmentStatus: { not: "TERMINATED" },
      userId: { not: null },
      siteAttendance: kind === "check-in" ? { none: { checkOutAt: null } } : { some: { checkOutAt: null } },
      // On approved leave covering today.
      leaveRequests: { none: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } } },
    },
    select: { id: true, firstName: true, userId: true },
  });

  let devicesReached = 0;
  let remindedUsers = 0;
  for (const employee of employees) {
    const delivered = await sendPushToUser(employee.userId!, {
      title: kind === "check-in" ? "Time to check in" : "Time to check out",
      body:
        kind === "check-in"
          ? `Good morning ${employee.firstName} — open Technet Digital and check in for today.`
          : `Good afternoon ${employee.firstName} — open Technet Digital and check out when you have finished work.`,
      url: "/dashboard",
      tag: `${kind}-reminder`,
    });
    if (delivered > 0) remindedUsers += 1;
    devicesReached += delivered;
  }

  res.json({ kind, candidates: employees.length, remindedUsers, devicesReached, date: today.toISOString().slice(0, 10) });
}

router.post("/send-checkin-reminders", (req, res) => sendAttendanceReminders("check-in", req, res));
router.post("/send-checkout-reminders", (req, res) => sendAttendanceReminders("check-out", req, res));

/**
 * Fires and sweeps random attendance-audit pings, and (independent of that feature's own
 * enable flag) reminds anyone whose shift has been open unusually long to check out. Called by an
 * external cron service (cron-job.org, not GitHub Actions - see CLAUDE.md §27f for why) hitting
 * this endpoint directly with the same secret-guard and "machine caller" posture as the reminder
 * endpoints above.
 *
 * Polling frequency matters here, not just for promptness: the mid-window nudge
 * (AUDIT_NUDGE_DELAY_MS, 2.5 min) only has a chance to fire if this endpoint gets called more
 * often than the gap between the nudge delay and AUDIT_RESPONSE_WINDOW_MS (5 min) - at a 5-minute
 * poll interval there is no tick left to catch it before the window closes and the MISSED sweep
 * below takes it instead. The cron-job.org job should run at least every 1-2 minutes for the
 * nudge to actually work, not just every 5.
 *
 * The audit-ping half stays a no-op unless ATTENDANCE_AUDIT_ENABLED=true is set in the server
 * environment; the long-shift reminder always runs regardless, since it isn't GPS monitoring and
 * doesn't wait on that policy gate.
 */
/**
 * Reminds a technician who has been checked in for an unusually long time to check out, once per
 * open session. Deliberately independent of ATTENDANCE_AUDIT_ENABLED below - this is an ordinary
 * "don't forget" nudge, not GPS audit-ping monitoring, so it doesn't wait on the same Data
 * Protection Act policy gate. 14 hours matches STALE_SESSION_HOURS, the threshold
 * TeamAttendancePage.tsx already uses to flag a likely-forgotten session to managers - no shared
 * package between client and server (CLAUDE.md §6's role-groups precedent), so keep both in sync
 * by hand if this ever changes.
 */
const LONG_SHIFT_REMINDER_HOURS = 14;

async function sendLongShiftReminders(): Promise<number> {
  const staleSessions = await prisma.siteAttendance.findMany({
    where: {
      checkOutAt: null,
      longShiftReminderSentAt: null,
      checkInAt: { lte: new Date(Date.now() - LONG_SHIFT_REMINDER_HOURS * 60 * 60 * 1000) },
    },
    include: { employee: { select: { userId: true, firstName: true } } },
  });

  let reminded = 0;
  for (const session of staleSessions) {
    if (!session.employee.userId) continue;
    await sendPushToUser(session.employee.userId, {
      title: "Still checked in?",
      body: `Hi ${session.employee.firstName} — you've been checked in for a while. Remember to check out when you're done for the day.`,
      url: "/dashboard",
      tag: `long-shift-${session.id}`,
    });
    // Marked sent regardless of delivery count, same reasoning as the audit nudge above - no
    // device registered isn't something retrying on the next tick will fix.
    await prisma.siteAttendance.update({ where: { id: session.id }, data: { longShiftReminderSentAt: new Date() } });
    reminded += 1;
  }
  return reminded;
}

router.post("/run-attendance-audits", async (req, res) => {
  const secret = process.env.REMINDER_TRIGGER_SECRET;
  const provided = req.get("x-reminder-secret");
  if (!secret || provided !== secret) return res.status(404).json({ error: "Not found" });

  const longShiftReminders = await sendLongShiftReminders();

  if (process.env.ATTENDANCE_AUDIT_ENABLED !== "true") {
    return res.json({ enabled: false, pushed: 0, missed: 0, longShiftReminders });
  }

  const due = await prisma.attendanceAudit.findMany({
    where: { status: "PENDING", scheduledAt: { lte: new Date() }, pushSentAt: null },
    include: { employee: { select: { userId: true } } },
  });

  let pushed = 0;
  let skipped = 0;
  for (const audit of due) {
    if (!audit.employee.userId) {
      await prisma.attendanceAudit.update({ where: { id: audit.id }, data: { status: "SKIPPED" } });
      skipped += 1;
      continue;
    }
    const delivered = await sendPushToUser(audit.employee.userId, {
      title: "Compliance check",
      body: "Tap within 5 minutes to confirm you're on site.",
      url: `/dashboard/audit-check?id=${audit.id}`,
      tag: `audit-${audit.id}`,
    });
    if (delivered > 0) {
      await prisma.attendanceAudit.update({ where: { id: audit.id }, data: { pushSentAt: new Date() } });
      pushed += 1;
    } else {
      // No device registered - not the employee's fault, so this must not count as a strike.
      await prisma.attendanceAudit.update({ where: { id: audit.id }, data: { status: "SKIPPED" } });
      skipped += 1;
    }
  }

  // A second, re-alerting push for anyone who hasn't responded yet, partway through the window -
  // same tag as the first (see sendPushToUser's caller below), so it re-vibrates/re-sounds on the
  // device rather than stacking a duplicate. Excludes anything already past the full response
  // window - that's handled by the overdue sweep below instead, not nudged first.
  const dueForNudge = await prisma.attendanceAudit.findMany({
    where: {
      status: "PENDING",
      nudgedAt: null,
      pushSentAt: {
        not: null,
        lte: new Date(Date.now() - AUDIT_NUDGE_DELAY_MS),
        gt: new Date(Date.now() - AUDIT_RESPONSE_WINDOW_MS),
      },
    },
    include: { employee: { select: { userId: true } } },
  });

  let nudged = 0;
  for (const audit of dueForNudge) {
    if (!audit.employee.userId) continue;
    await sendPushToUser(audit.employee.userId, {
      title: "Compliance check",
      body: "Still waiting - tap now to confirm you're on site.",
      url: `/dashboard/audit-check?id=${audit.id}`,
      tag: `audit-${audit.id}`,
    });
    // Sent regardless of delivery count: a delivery failure here doesn't change anything about
    // the audit's own fate (still resolves via the poller's own MISSED sweep either way), so
    // there's nothing useful gained by distinguishing it from a successful nudge.
    await prisma.attendanceAudit.update({ where: { id: audit.id }, data: { nudgedAt: new Date() } });
    nudged += 1;
  }

  const overdue = await prisma.attendanceAudit.findMany({
    where: {
      status: "PENDING",
      pushSentAt: { lte: new Date(Date.now() - AUDIT_RESPONSE_WINDOW_MS) },
    },
  });
  for (const audit of overdue) {
    await prisma.attendanceAudit.update({ where: { id: audit.id }, data: { status: "MISSED" } });
    await evaluateStrike(audit.id);
  }

  res.json({ enabled: true, pushed, skipped, nudged, missed: overdue.length, longShiftReminders });
});

export default router;
