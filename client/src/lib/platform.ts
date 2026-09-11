/** Small device checks shared by push notifications and the install prompt. */

export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports itself as a Mac; a touch screen gives it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** True when running as the installed home-screen app rather than in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own non-standard flag, still the only reliable signal there.
    (navigator as { standalone?: boolean }).standalone === true
  )
}
