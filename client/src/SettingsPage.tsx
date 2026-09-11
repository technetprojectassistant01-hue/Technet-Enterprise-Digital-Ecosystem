import { useState, type FormEvent } from 'react'
import * as api from './lib/api'
import { Panel } from './dashboard/ui'
import { primaryButtonClass } from './dashboard/buttonStyles'
import { InstallAppDialog } from './dashboard/InstallAppDialog'
import LanguageSwitcher from './dashboard/LanguageSwitcher'
import { useInstallMethod } from './lib/installPrompt'
import { isStandalone } from './lib/platform'
import { useT } from './i18n'

/** Lets someone install the app after choosing "Not now" on the pop-up. */
function InstallAppPanel() {
  const t = useT()
  const method = useInstallMethod()
  const [open, setOpen] = useState(false)

  return (
    <Panel title={t.install.panelTitle}>
      {isStandalone() ? (
        <p className="text-sm text-ink-300">{t.install.alreadyInstalled}</p>
      ) : method ? (
        <>
          <p className="mb-4 text-sm text-ink-300">{t.install.panelHint}</p>
          <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
            {t.install.panelButton}
          </button>
          {open && (
            <InstallAppDialog
              appName="Technet Digital"
              method={method}
              onNotNow={() => setOpen(false)}
              onDone={() => setOpen(false)}
            />
          )}
        </>
      ) : (
        <p className="text-sm text-ink-300">{t.install.cannotInstall}</p>
      )}
    </Panel>
  )
}

function SettingsPage() {
  const t = useT()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword !== confirmPassword) {
      setError(t.settings.mismatch)
      return
    }

    setSubmitting(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.settings.failed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-ink-100">{t.settings.title}</h1>

      <Panel title={t.language.label}>
        <p className="mb-4 text-sm text-ink-300">{t.language.settingsHint}</p>
        <LanguageSwitcher variant="field" />
      </Panel>

      <div className="mt-6">
        <Panel title={t.settings.changePassword}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="currentPassword" className="text-xs font-semibold tracking-widest text-ink-400">
                {t.settings.currentPassword}
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="mt-2 w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-cyan-accent"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="text-xs font-semibold tracking-widest text-ink-400">
                {t.settings.newPassword}
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
                className="mt-2 w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-cyan-accent"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="text-xs font-semibold tracking-widest text-ink-400">
                {t.settings.confirmNewPassword}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
                className="mt-2 w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-ink-100 outline-none focus:border-cyan-accent"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? t.settings.updating : t.settings.updatePassword}
            </button>

            {error && <p className="text-center text-sm text-red-400">{error}</p>}
            {success && <p className="text-center text-sm text-cyan-accent">{t.settings.updated}</p>}
          </form>
        </Panel>
      </div>

      <div className="mt-6">
        <InstallAppPanel />
      </div>
    </div>
  )
}

export default SettingsPage
