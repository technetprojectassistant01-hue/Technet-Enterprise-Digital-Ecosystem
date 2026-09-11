import { useEffect, useState } from 'react'
import { Share } from 'lucide-react'
import { Modal } from './ui'
import { primaryButtonClass, secondaryButtonClass } from './buttonStyles'
import {
  isInstallPromptSnoozed,
  promptInstall,
  snoozeInstallPrompt,
  useInstallMethod,
  type InstallMethod,
} from '../lib/installPrompt'

/** Where a website can't trigger the install itself, the steps the person has to take instead. */
function InstallSteps({ method }: { method: Exclude<InstallMethod, 'prompt'> }) {
  if (method === 'ios') {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-200">
        <li>
          Tap the Share button <Share className="inline h-4 w-4 align-text-bottom text-cyan-accent" /> in
          the browser toolbar.
        </li>
        <li>
          Scroll down and tap <strong>Add to Home Screen</strong>.
        </li>
        <li>
          Tap <strong>Add</strong>. The app appears on your home screen.
        </li>
      </ol>
    )
  }
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

  return (
    <Modal title={`Install ${appName}`} onClose={onNotNow}>
      <div className="flex items-center gap-4">
        <img src="/icon-192.png" alt="" className="h-14 w-14 shrink-0 rounded-xl" />
        <p className="text-sm text-ink-200">Install this app for quick access.</p>
      </div>

      {showSteps && method !== 'prompt' ? (
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

/**
 * Pops the install dialog up once per visit, a few seconds in, on any device that can install
 * and hasn't already — unless "Not now" was chosen in the last week.
 */
export function InstallAppPrompt({ appName }: { appName: string }) {
  const method = useInstallMethod()
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!method || shown || isInstallPromptSnoozed()) return
    const timer = setTimeout(() => {
      setOpen(true)
      setShown(true)
    }, 3000)
    return () => clearTimeout(timer)
  }, [method, shown])

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
