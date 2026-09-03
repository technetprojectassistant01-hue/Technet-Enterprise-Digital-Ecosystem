import webpush from "web-push";
import { prisma } from "./prisma";

/**
 * Web Push delivery. Unlike the in-app Notification bell, this reaches a device whose browser is
 * closed - which is the whole point of the 08:15 check-in reminder, since somebody who has not
 * opened the app is exactly who needs reminding.
 *
 * Configured only when VAPID keys are present. Without them every send is a no-op that logs
 * once, so local development and any environment that hasn't set the keys still boots normally
 * rather than crashing on an unrelated feature (same posture as email.ts and its Resend key).
 */
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@technet.mu";

export const pushConfigured = Boolean(publicKey && privateKey);

if (pushConfigured) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
} else {
  console.warn("[push] VAPID keys not set - push notifications are disabled.");
}

export interface PushPayload {
  title: string;
  body: string;
  /** Where clicking the notification should land the technician. */
  url?: string;
  /** Collapses repeats: a second reminder replaces the first rather than stacking. */
  tag?: string;
}

/**
 * Sends to every device a user has registered, and prunes the ones that are gone.
 *
 * A subscription dies silently when the browser is uninstalled, storage is cleared, or the push
 * service expires it. The service reports that as 404 or 410, and those rows must be deleted or
 * they accumulate forever and every future send wastes a request on them. Any other failure is
 * left alone - a transient 5xx from the push service is not evidence the device is gone.
 *
 * Returns how many devices were actually reached, so a caller can report honestly instead of
 * assuming delivery.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.warn(`[push] send failed for ${sub.id}:`, err instanceof Error ? err.message : err);
        }
      }
    }),
  );

  return delivered;
}
