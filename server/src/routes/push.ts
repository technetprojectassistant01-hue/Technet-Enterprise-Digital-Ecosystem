import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { pushConfigured, sendPushToUser } from "../lib/push";
import { todayUtc } from "../lib/leaveRequests";

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

export default router;
