import { useState } from 'react'
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

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-ink-100">{t.settings.title}</h1>

      <Panel title={t.language.label}>
        <p className="mb-4 text-sm text-ink-300">{t.language.settingsHint}</p>
        <LanguageSwitcher variant="field" />
      </Panel>

      <div className="mt-6">
        <Panel title={t.settings.password}>
          <p className="text-sm text-ink-300">{t.settings.passwordManagedByAdmin}</p>
        </Panel>
      </div>

      <div className="mt-6">
        <InstallAppPanel />
      </div>
    </div>
  )
}

export default SettingsPage
