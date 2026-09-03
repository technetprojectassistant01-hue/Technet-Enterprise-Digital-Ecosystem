import * as api from './api'

/**
 * Web Push opt-in for the 08:15 check-in reminder.
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

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own non-standard flag, still the only reliable signal there.
    (navigator as { standalone?: boolean }).standalone === true
  )
}

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

export async function disablePushReminders(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe().catch(() => {})
  await api.removePushSubscription(endpoint)
}
