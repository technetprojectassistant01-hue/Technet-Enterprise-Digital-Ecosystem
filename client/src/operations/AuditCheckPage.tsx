import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import { Panel } from '../dashboard/ui'
import { primaryButtonClass } from '../dashboard/buttonStyles'
import { getPosition, LocationDeniedError } from '../lib/geolocation'
import { useT } from '../i18n'

type ViewState = 'loading' | 'pending' | 'confirmed' | 'already' | 'expired' | 'unavailable'

/**
 * Opened from the "Compliance check" push notification (see server/src/routes/push.ts and
 * client/public/sw.js's notificationclick handler) - a foreground page, so
 * navigator.geolocation works normally here even though the notification itself came from a
 * Service Worker, which cannot read location on its own.
 *
 * Deliberately never tells the technician whether their answer matched or mismatched - same
 * no-covert-monitoring precedent as AttendanceWidget.tsx (CLAUDE.md §7a). The verdict is only
 * ever shown to managers on the Attendance Anomalies queue.
 */
function AuditCheckPage() {
  const t = useT()
  const [params] = useSearchParams()
  const id = params.get('id')
  const [state, setState] = useState<ViewState>('loading')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setState('unavailable')
      return
    }
    api
      .getAttendanceAudit(id)
      .then(({ audit, expired }) => {
        if (expired) setState('expired')
        else if (audit.status !== 'PENDING') setState('already')
        else setState('pending')
      })
      .catch(() => setState('unavailable'))
  }, [id])

  async function handleConfirm() {
    if (!id) return
    setConfirming(true)
    setError(null)
    try {
      const position = await getPosition()
      await api.confirmAttendanceAudit(id, {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      })
      setState('confirmed')
    } catch (err) {
      if (err instanceof LocationDeniedError) {
        setError(t.ops.auditCheck.locationDenied)
      } else if (err instanceof ApiError && err.status === 410) {
        setState('expired')
      } else if (err instanceof ApiError && err.status === 400) {
        setState('already')
      } else {
        setError(err instanceof Error ? err.message : t.ops.auditCheck.confirmFailed)
      }
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Panel title={t.ops.auditCheck.title} icon={ShieldCheck}>
        {state === 'loading' && <p className="text-sm text-ink-400">…</p>}
        {state === 'unavailable' && <p className="text-sm text-ink-400">{t.ops.auditCheck.loadFailed}</p>}
        {state === 'confirmed' && <p className="text-sm text-ink-200">{t.ops.auditCheck.confirmed}</p>}
        {state === 'already' && <p className="text-sm text-ink-200">{t.ops.auditCheck.alreadyAnswered}</p>}
        {state === 'expired' && <p className="text-sm text-ink-200">{t.ops.auditCheck.expired}</p>}
        {state === 'pending' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">{t.ops.auditCheck.pendingIntro}</p>
            <button type="button" onClick={handleConfirm} disabled={confirming} className={primaryButtonClass}>
              {confirming ? t.ops.auditCheck.confirming : t.ops.auditCheck.confirmButton}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )}
      </Panel>
    </div>
  )
}

export default AuditCheckPage
