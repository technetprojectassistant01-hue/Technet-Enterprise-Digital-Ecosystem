import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { AttendanceAnomaly, CustomerSummary } from '../lib/api'
import { Modal } from '../dashboard/ui'
import { inputClass, labelClass, primaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useT } from '../i18n'

type Choice = { kind: 'match'; placeId: string } | { kind: 'new' } | { kind: 'none' }

/**
 * "Confirm Genuine" on a visit's anomaly, with the spec's section 2 offer: save the check-in
 * location as a known place, or match it to an existing place within 250 m. The decision itself
 * (GENUINE + note) is always recorded; the place part is optional ("Don't save").
 */
function SavePlaceDialog({ anomaly, note, onClose, onDone }: {
  anomaly: AttendanceAnomaly
  note: string
  onClose: () => void
  onDone: () => void
}) {
  const t = useT()
  const toast = useToast()
  const visit = anomaly.siteAttendance!
  const [nearby, setNearby] = useState<{ id: string; name: string; distanceMeters: number }[] | null>(null)
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [choice, setChoice] = useState<Choice>({ kind: 'new' })
  const [name, setName] = useState(visit.checkInSite || visit.checkInNote || visit.checkInPlace?.split(',')[0] || '')
  const [customerId, setCustomerId] = useState('')
  const [radius, setRadius] = useState('250')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .knownPlacesNear(visit.checkInLat, visit.checkInLng)
      .then(({ places }) => {
        setNearby(places)
        // The nearest existing place is the likeliest answer - preselect it.
        if (places.length) setChoice({ kind: 'match', placeId: places[0].id })
      })
      .catch(() => setNearby([]))
    api.listCustomers().then(({ customers }) => setCustomers(customers)).catch(() => setCustomers([]))
  }, [visit.checkInLat, visit.checkInLng])

  async function submit() {
    if (choice.kind === 'new' && !name.trim()) return
    setBusy(true)
    try {
      await api.decideAttendanceAnomaly(anomaly.id, { status: 'GENUINE', note: note.trim() || undefined })
      if (choice.kind === 'none') {
        toast.success(t.ops.anomalies.decided)
      } else {
        const { linked } = await api.confirmVisitPlace(
          choice.kind === 'match'
            ? { siteAttendanceId: visit.id, knownPlaceId: choice.placeId }
            : { siteAttendanceId: visit.id, name: name.trim(), customerId: customerId || undefined, radiusMeters: Number(radius) || undefined },
        )
        toast.success(t.ops.anomalies.savedPlace(linked))
      }
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.anomalies.decideFailed)
    } finally {
      setBusy(false)
    }
  }

  const radioRow = 'flex items-start gap-2 rounded-lg border border-ink-800 px-3 py-2.5 text-sm text-ink-200'

  return (
    <Modal title={t.ops.anomalies.savePlaceTitle} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-300">{t.ops.anomalies.savePlaceIntro}</p>
        {visit.checkInPlace && <p className="text-xs text-ink-400">{visit.checkInPlace}</p>}

        <div className="flex flex-col gap-2">
          {(nearby ?? []).map((p) => (
            <label key={p.id} className={radioRow}>
              <input
                type="radio"
                name="place-choice"
                checked={choice.kind === 'match' && choice.placeId === p.id}
                onChange={() => setChoice({ kind: 'match', placeId: p.id })}
                className="mt-0.5"
              />
              {t.ops.anomalies.matchExisting(p.name, p.distanceMeters)}
            </label>
          ))}
          <label className={radioRow}>
            <input type="radio" name="place-choice" checked={choice.kind === 'new'} onChange={() => setChoice({ kind: 'new' })} className="mt-0.5" />
            {t.ops.anomalies.saveNew}
          </label>
          {choice.kind === 'new' && (
            <div className="grid grid-cols-1 gap-3 pl-6 sm:grid-cols-2">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className={labelClass}>{t.ops.anomalies.placeName}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>{t.ops.anomalies.placeClient}</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>{t.ops.anomalies.placeRadius}</label>
                <input type="number" inputMode="numeric" min={50} max={2000} value={radius} onChange={(e) => setRadius(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
          <label className={radioRow}>
            <input type="radio" name="place-choice" checked={choice.kind === 'none'} onChange={() => setChoice({ kind: 'none' })} className="mt-0.5" />
            {t.ops.anomalies.dontSave}
          </label>
        </div>

        <button
          type="button"
          disabled={busy || (choice.kind === 'new' && !name.trim())}
          onClick={submit}
          className={`justify-center py-2.5 ${primaryButtonClass}`}
        >
          {busy ? t.ops.anomalies.deciding : t.ops.anomalies.confirm}
        </button>
      </div>
    </Modal>
  )
}

export default SavePlaceDialog
