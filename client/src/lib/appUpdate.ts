/**
 * Detects when a new deploy's service worker has taken over the page, so the app can prompt for
 * a reload instead of leaving someone stuck on stale code until they fully close and reopen it.
 *
 * sw.js calls `skipWaiting()` unconditionally on install (needed so push/offline-sync keep
 * working without a manual close), which means there's no normal "waiting" service worker to
 * inspect — the new one activates and claims every open page almost immediately. The reliable
 * signal is `controllerchange`: it fires on every open tab/PWA window the instant a *different*
 * service worker takes over. The already-loaded React bundle in that window is still the old one
 * even though the worker underneath it changed — only a reload picks up the new JS.
 *
 * Guarded so the very first registration (no controller yet → one appears) doesn't count as an
 * update; only a controller *replacing* an existing one does.
 */
export function watchForAppUpdate(onUpdateReady: () => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {}

  const hadController = !!navigator.serviceWorker.controller
  const onControllerChange = () => {
    if (hadController) onUpdateReady()
  }
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

  // An installed PWA can sit open for hours without a navigation that would otherwise trigger
  // the browser's own update check, so ask it to look for a new worker periodically.
  const interval = setInterval(() => {
    navigator.serviceWorker.getRegistration().then((reg) => reg?.update())
  }, 20 * 60 * 1000)

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    clearInterval(interval)
  }
}
