import * as api from './api'
import { isIos, isStandalone } from './platform'

/**
 * Web Push for the 08:15 / 17:15 reminders and the random compliance checks. Since 2026-09-29 a
 * technician's phone is registered at Check In (ensurePushRegistered), not only via "Remind me",
 * so compliance checks reach every technician - a phone with no registration gets none (SKIPPED).
 *
 * Two things make this awkward and are worth stating rather than rediscovering:
 *
 * 1. The permission prompt must follow a real user gesture. Browsers penalise sites that ask on
 *    page load, and Chrome can permanently block a site that does. So this is only ever called
 *    from a button click.
 * 2. On iOS, Web Push works ONLY when the site has been added to the home screen. In a normal
 *    Safari tab `PushManager` is absent, so a technician on an iPhone must install the app first
 *    - which is why `pushSupport()` reports that case separately instead of just "unsupported".
 */

export type PushSupport = 'supported' | 'needs-home-screen' | 'unsupported'

export function pushSupport(): PushSupport {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return 'unsupported'
  if (!('PushManager' in window)) return isIos() && !isStandalone() ? 'needs-home-screen' : 'unsupported'
  if (isIos() && !isStandalone()) return 'needs-home-screen'
  return 'supported'
}

/**
 * The VAPID public key arrives base64url-encoded; PushManager wants raw bytes.
 * Backed by an explicit ArrayBuffer because `applicationServerKey` requires one - a plain
 * `Uint8Array` is typed over `ArrayBufferLike`, which also admits SharedArrayBuffer.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalised)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

/**
 * Asks permission, subscribes, and registers the device with the server.
 * Throws with a message worth showing the technician - "denied" in particular is a dead end they
 * can only fix in browser settings, so say so rather than failing silently.
 */
export async function enablePushReminders(): Promise<void> {
  const { enabled, publicKey } = await api.getPushPublicKey()
  if (!enabled || !publicKey) throw new Error('Reminders are not configured on the server yet')

  const registration = await registerServiceWorker()
  if (!registration) throw new Error('This browser will not run the background worker reminders need')

  const permission = await Notification.requestPermission()
  if (permission === 'denied') {
    throw new Error('Notifications are blocked for this site — allow them in your browser settings')
  }
  if (permission !== 'granted') throw new Error('Notification permission was not granted')

  await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      // Required to be true by every current browser: a push must always be shown to the user,
      // never used silently. That constraint is the reason this can't be used for tracking.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))

  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('The browser returned an incomplete subscription')
  }

  await api.savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent,
  })
}

export type PushReadiness = 'ready' | 'off' | 'blocked' | 'needs-home-screen' | 'unsupported'

/** Can this phone receive compliance checks and reminders right now, as far as the browser says? */
export function pushReadiness(): PushReadiness {
  const support = pushSupport()
  if (support !== 'supported') return support
  if (Notification.permission === 'denied') return 'blocked'
  return Notification.permission === 'granted' ? 'ready' : 'off'
}

/**
 * Makes sure this phone is registered for push, so compliance checks reach the technician
 * (2026-09-29: they are for every technician, not only those who tapped "Remind me").
 *
 * With `ask`, and permission not yet decided, it asks - and the prompt is the FIRST thing it
 * does, before any network wait: iOS only honours a permission request that follows the tap
 * directly, so callers invoke this at the very start of a click handler (Check In, Turn on).
 * Without `ask` it never prompts; with permission already granted it registers silently, which
 * needs no tap. Never throws - returns what it could achieve.
 */
export async function ensurePushRegistered({ ask }: { ask: boolean }): Promise<PushReadiness> {
  const readiness = pushReadiness()
  if (readiness === 'blocked' || readiness === 'needs-home-screen' || readiness === 'unsupported') return readiness
  if (readiness === 'off') {
    if (!ask) return 'off'
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  }
  try {
    await enablePushReminders()
    return 'ready'
  } catch {
    return 'off'
  }
}

export async function disablePushReminders(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await subscription.unsubscribe().catch(() => {})
  }
  await api.removeAllPushSubscriptions()
}
