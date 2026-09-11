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
 * update; only a controller *replacing* an existing one does. The current controller is tracked
 * rather than captured once, so a page that was uncontrolled when it loaded still gets the bar
 * for a deploy that lands later.
 *
 * This only fires because sw.js's bytes change on every deploy — the build stamps a fresh build
 * id into it (vite.config.ts). Without that, an app-code-only deploy produced no new worker.
 */
export function watchForAppUpdate(onUpdateReady: () => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {}

  let controller = navigator.serviceWorker.controller
  const onControllerChange = () => {
    if (controller) onUpdateReady()
    controller = navigator.serviceWorker.controller
  }
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

  const checkForUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => reg?.update()).catch(() => {})
  }
  // An installed PWA can sit open for hours without a navigation that would otherwise trigger
  // the browser's own update check, so look periodically — and whenever it's brought back to the
  // foreground, which is how a home-screen app is usually "reopened" on a phone.
  const interval = setInterval(checkForUpdate, 20 * 60 * 1000)
  const onVisible = () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  }
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(interval)
  }
}
