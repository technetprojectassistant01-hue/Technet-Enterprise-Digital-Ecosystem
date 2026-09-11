import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowDown, ArrowUp, Check, Ellipsis, Share, SquarePlus, type LucideIcon } from 'lucide-react'
import { Modal } from './ui'
import { primaryButtonClass, secondaryButtonClass } from './buttonStyles'
import {
  isInstallPromptSnoozed,
  promptInstall,
  snoozeInstallPrompt,
  useInstallMethod,
  type InstallMethod,
} from '../lib/installPrompt'

type ShareSpot = 'bottom-center' | 'bottom-right' | 'top-right' | null

/**
 * Where the browser's Share control sits on this iPhone/iPad, so the guide can point at it.
 * Best effort from the user agent — layouts differ by browser and iOS version, and none of this
 * is exposed to a web page. When unsure it returns null and the guide just shows the steps.
 */
function iosShareSpot(): { spot: ShareSpot; viaMoreMenu: boolean } {
  const ua = navigator.userAgent
  const isIpad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  // Chrome on iOS keeps Share in the address bar, top right.
  if (/CriOS/.test(ua)) return { spot: 'top-right', viaMoreMenu: false }
  // Firefox, Edge and other iOS browsers: layouts vary too much to point anywhere honestly.
  if (/FxiOS|EdgiOS|OPiOS/.test(ua)) return { spot: null, viaMoreMenu: false }
  if (isIpad) return { spot: 'top-right', viaMoreMenu: false }
  // Safari 26 moved Share into the "…" menu at the right of the bottom bar. (Its user agent
  // freezes the iOS version, so the Safari version is the reliable signal.)
  const safariVersion = Number(ua.match(/Version\/(\d+)/)?.[1] ?? 0)
  if (safariVersion >= 26) return { spot: 'bottom-right', viaMoreMenu: true }
  return { spot: 'bottom-center', viaMoreMenu: false }
}

function GuideStep({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-accent/10 ring-1 ring-cyan-accent/30">
        <Icon className="h-5 w-5 text-cyan-accent" />
      </span>
      <span className="text-xs leading-snug text-ink-200">{label}</span>
    </div>
  )
}

/**
 * iPhone/iPad: no website can trigger the install, so instead of numbered instructions this dims
 * the page and points a bouncing arrow at the browser's Share control, with a picture of the three
 * taps. Safari's toolbar sits just outside the page, so an arrow at the page's edge points at it.
 */
function IosInstallGuide({ appName, onClose }: { appName: string; onClose: () => void }) {
  const { spot, viaMoreMenu } = iosShareSpot()
  const atTop = spot === 'top-right'
  const ArrowIcon = atTop ? ArrowUp : ArrowDown

  const arrowPosition: CSSProperties =
    spot === 'top-right'
      ? { top: 'calc(env(safe-area-inset-top) + 0.25rem)', right: '1rem' }
      : spot === 'bottom-right'
        ? { bottom: 'calc(env(safe-area-inset-bottom) + 0.25rem)', right: '1rem' }
        : { bottom: 'calc(env(safe-area-inset-bottom) + 0.25rem)', left: '50%', transform: 'translateX(-50%)' }

  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label={`How to install ${appName}`}
    >
      {spot && (
        <div className="absolute" style={arrowPosition} aria-hidden="true">
          <ArrowIcon className="h-10 w-10 animate-bounce text-cyan-accent drop-shadow-lg" strokeWidth={2.5} />
        </div>
      )}

      <div
        className="animate-scale-in absolute inset-x-4 mx-auto max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-2xl shadow-black/50"
        style={atTop ? { top: 'calc(env(safe-area-inset-top) + 4rem)' } : { bottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-sm font-semibold text-ink-100">Add {appName} to your Home Screen</p>
        <div className="mt-4 flex items-start gap-2">
          <GuideStep icon={viaMoreMenu ? Ellipsis : Share} label={viaMoreMenu ? 'Tap ⋯ then Share' : 'Tap Share'} />
          <GuideStep icon={SquarePlus} label="Tap Add to Home Screen" />
          <GuideStep icon={Check} label="Tap Add" />
        </div>
        <button type="button" onClick={onClose} className={`${primaryButtonClass} mt-5 w-full`}>
          Got it
        </button>
      </div>
    </div>
  )
}

/** Mac Safari / Firefox on Android: a website can't trigger the install there either. */
function InstallSteps({ method }: { method: 'mac-safari' | 'android-menu' }) {
  if (method === 'mac-safari') {
    return (
      <p className="text-sm text-ink-200">
        In Safari's menu bar, choose <strong>File → Add to Dock</strong>.
      </p>
    )
  }
  return (
    <p className="text-sm text-ink-200">
      Open the browser menu (<strong>⋮</strong>) and tap <strong>Install</strong>.
    </p>
  )
}

/** The install pop-up itself — shown automatically by InstallAppPrompt, or from Settings. */
export function InstallAppDialog({
  appName,
  method,
  onNotNow,
  onDone,
}: {
  appName: string
  method: InstallMethod
  onNotNow: () => void
  onDone: () => void
}) {
  const [showSteps, setShowSteps] = useState(false)

  async function handleInstall() {
    if (method === 'prompt') {
      await promptInstall()
      onDone()
    } else {
      setShowSteps(true)
    }
  }

  if (showSteps && method === 'ios') return <IosInstallGuide appName={appName} onClose={onDone} />

  return (
    <Modal title={`Install ${appName}`} onClose={onNotNow}>
      <div className="flex items-center gap-4">
        <img src="/icon-192.png" alt="" className="h-14 w-14 shrink-0 rounded-xl" />
        <p className="text-sm text-ink-200">Install this app for quick access.</p>
      </div>

      {showSteps && (method === 'mac-safari' || method === 'android-menu') ? (
        <>
          <div className="mt-5 rounded-lg border border-ink-700 bg-ink-950 p-4">
            <InstallSteps method={method} />
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={onDone} className={primaryButtonClass}>
              Done
            </button>
          </div>
        </>
      ) : (
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onNotNow} className={secondaryButtonClass}>
            Not now
          </button>
          <button type="button" onClick={() => void handleInstall()} className={primaryButtonClass}>
            Install now
          </button>
        </div>
      )}
    </Modal>
  )
}

// Once per page load across every InstallAppPrompt — so seeing it on the login page doesn't
// bring it straight back on the dashboard after signing in.
let shownThisVisit = false

/**
 * Pops the install dialog up once per visit, a few seconds in, on any device that can install
 * and hasn't already — unless "Not now" was chosen in the last week.
 */
export function InstallAppPrompt({ appName }: { appName: string }) {
  const method = useInstallMethod()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!method || shownThisVisit || isInstallPromptSnoozed()) return
    const timer = setTimeout(() => {
      shownThisVisit = true
      setOpen(true)
    }, 3000)
    return () => clearTimeout(timer)
  }, [method])

  if (!open || !method) return null
  return (
    <InstallAppDialog
      appName={appName}
      method={method}
      onNotNow={() => {
        snoozeInstallPrompt()
        setOpen(false)
      }}
      onDone={() => setOpen(false)}
    />
  )
}
