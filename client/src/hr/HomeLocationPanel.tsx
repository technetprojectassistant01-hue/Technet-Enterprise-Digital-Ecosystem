import { useEffect, useState } from 'react'
import { Home } from 'lucide-react'
import * as api from '../lib/api'
import type { EmployeeHome } from '../lib/api'
import { Panel } from '../dashboard/ui'
import { inputClass, labelClass, primaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useT } from '../i18n'

/**
 * HR's home-location field on the employee profile (spec 2026-09-26, section 3). Stored apart from
 * the employee record and served only to HR_ROLES, since the profile itself is readable by every
 * office role. Used only for the CHECKIN_NEAR_HOME anomaly - the address never appears on an
 * attendance page; a flag there shows just the distance.
 */
function HomeLocationPanel({ employeeId }: { employeeId: string }) {
  const t = useT()
  const toast = useToast()
  const [home, setHome] = useState<EmployeeHome | null>(null)
  const [address, setAddress] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .getEmployeeHome(employeeId)
      .then(({ home }) => {
        setHome(home)
        setAddress(home?.address ?? '')
      })
      .catch(() => setHome(null))
      .finally(() => setLoaded(true))
  }, [employeeId])

  async function save() {
    if (!address.trim()) return
    setBusy(true)
    try {
      const { home, located } = await api.setEmployeeHome(employeeId, address.trim())
      setHome(home)
      if (located) toast.success(t.workforce.homeLocation.saved)
      else toast.error(t.workforce.homeLocation.notLocated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.workforce.homeLocation.failed)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await api.clearEmployeeHome(employeeId)
      setHome(null)
      setAddress('')
      toast.success(t.workforce.homeLocation.removed)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.workforce.homeLocation.failed)
    } finally {
      setBusy(false)
    }
  }

  const located = home && home.lat !== null && home.lng !== null

  return (
    <Panel title={t.workforce.homeLocation.title} icon={Home}>
      <p className="mb-3 text-xs text-ink-400">{t.workforce.homeLocation.intro}</p>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>{t.workforce.homeLocation.address}</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t.workforce.homeLocation.placeholder}
          maxLength={300}
          disabled={!loaded}
          className={inputClass}
        />
      </div>
      {loaded && (
        <p className={`mt-2 text-xs ${home ? (located ? 'text-emerald-400' : 'text-amber-400') : 'text-ink-400'}`}>
          {!home ? t.workforce.homeLocation.none : located ? t.workforce.homeLocation.located : t.workforce.homeLocation.notLocated}
        </p>
      )}
      {home?.updatedBy && (
        <p className="mt-1 text-xs text-ink-500">
          {t.workforce.homeLocation.updatedBy(home.updatedBy.name, new Date(home.updatedAt).toLocaleDateString())}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !address.trim() || address.trim() === home?.address} onClick={save} className={primaryButtonClass}>
          {t.workforce.homeLocation.save}
        </button>
        {home && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="rounded-lg border border-ink-600 px-4 py-2 text-sm font-semibold text-ink-200 transition hover:bg-ink-800 disabled:opacity-50"
          >
            {t.workforce.homeLocation.remove}
          </button>
        )}
      </div>
    </Panel>
  )
}

export default HomeLocationPanel
