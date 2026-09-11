import { useSyncExternalStore } from 'react'
import { isIos, isStandalone } from './platform'

/**
 * "Install this app" support.
 *
 * Browsers differ on what a website is allowed to do here, and the pop-up has to be honest about
 * it rather than showing a button that silently does nothing:
 *
 *  - Chrome / Edge / Samsung Internet (Android, Windows, Mac, ChromeOS) fire `beforeinstallprompt`.
 *    We hold on to that event, and "Install now" replays it — the browser's own install dialog.
 *  - iPhone / iPad: no website can trigger the install. The only route is Share → Add to Home
 *    Screen, so "Install now" shows those steps instead.
 *  - Safari on Mac (17+): File → Add to Dock. Firefox on Android: browser menu → Install.
 *  - Firefox on desktop can't install web apps at all, so nothing is offered there.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallMethod = 'prompt' | 'ios' | 'mac-safari' | 'android-menu'

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function getInstallMethod(): InstallMethod | null {
  if (installed || isStandalone()) return null
  if (deferredPrompt) return 'prompt'
  if (isIos()) return 'ios'
  const ua = navigator.userAgent
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) {
    return 'mac-safari'
  }
  if (/Android/.test(ua) && /Firefox/.test(ua)) return 'android-menu'
  return null
}

/**
 * Called once at startup, before React renders: `beforeinstallprompt` can fire very early and is
 * never re-sent, so a listener attached later by a component would miss it. Also points the page
 * at the portal's own manifest on /portal, so a customer installs the Client Portal (which opens
 * on their portal), not the staff app.
 */
export function initInstallSupport(): void {
  if (typeof window === 'undefined') return

  if (window.location.pathname.startsWith('/portal')) {
    document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/portal.webmanifest')
    document
      .querySelector('meta[name="apple-mobile-web-app-title"]')
      ?.setAttribute('content', 'Technet Portal')
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    // Stop Chrome's own mini-infobar; our pop-up offers the same thing in the app's words.
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    emit()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** How this device can install the app right now, or null if it can't (or already has). */
export function useInstallMethod(): InstallMethod | null {
  return useSyncExternalStore(subscribe, getInstallMethod, () => null)
}

/** Opens the browser's own install dialog. Only meaningful when the method is 'prompt'. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt
  if (!event) return false
  // The event can only be used once, whatever the person chooses.
  deferredPrompt = null
  await event.prompt()
  const { outcome } = await event.userChoice
  emit()
  return outcome === 'accepted'
}

const NOT_NOW_KEY = 'technet-install-not-now'
const NOT_NOW_DAYS = 7

/** "Not now" keeps the pop-up away for a week on this device (Settings still offers it). */
export function snoozeInstallPrompt(): void {
  try {
    localStorage.setItem(NOT_NOW_KEY, String(Date.now()))
  } catch {
    // Private browsing / blocked storage: the pop-up just comes back next time.
  }
}

export function isInstallPromptSnoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(NOT_NOW_KEY))
    return Boolean(at) && Date.now() - at < NOT_NOW_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}
