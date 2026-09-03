import { useEffect, useState } from 'react'
import { LogIn, LogOut, MapPin, RadioTower } from 'lucide-react'
import * as api from '../lib/api'
import type { SiteAttendance, SiteExitReason } from '../lib/api'
import { SITE_EXIT_REASON_LABELS } from '../lib/api'
import { getPosition, mapLink } from '../lib/geolocation'
import { Panel, Badge } from './ui'
import { primaryButtonClass, secondaryButtonClass } from './buttonStyles'
import { useToast } from './ToastContext'

const VERIFY_INTERVAL_MS = 10 * 60 * 1000
const EXIT_REASONS = Object.keys(SITE_EXIT_REASON_LABELS) as SiteExitReason[]

const noteInputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const fieldLabelClass = 'text-xs font-semibold tracking-widest text-ink-400'

/** Local wall-clock "HH:MM". Built from date parts, not toLocaleTimeString, so it can be compared
 * against a stored declared time without locale formatting getting in the way. */
function clockOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** The format both <input type="time"> and the server expect. */
function currentClockTime(): string {
  return clockOf(new Date())
}

/**
 * The technician's stated time, shown only when it differs from what the server recorded.
 * Repeating a matching value is noise; a mismatch is the thing worth seeing.
 */
function statedTimeSuffix(declared: string | null, actualIso: string | null): string {
  if (!declared || !actualIso) return ''
  return declared === clockOf(new Date(actualIso)) ? '' : ` (stated ${declared})`
}

function totalTransportCost(visit: SiteAttendance): number {
  return Number(visit.checkInTransportCost ?? 0) + Number(visit.checkOutTransportCost ?? 0)
}

function siteStatusTone(status: 'ON_SITE' | 'OUTSIDE_SITE' | 'UNVERIFIED') {
  if (status === 'ON_SITE') return 'success' as const
  if (status === 'OUTSIDE_SITE') return 'warning' as const
  return 'neutral' as const
}

function AttendanceWidget() {
  const toast = useToast()
  const [current, setCurrent] = useState<SiteAttendance | null>(null)
  const [history, setHistory] = useState<SiteAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [note, setNote] = useState('')
  const [declaredTime, setDeclaredTime] = useState(currentClockTime)
  // The box is prefilled with the clock, so a technician who just opens the app and taps through
  // gets the right time with no typing. If they never touched it, we re-read the clock at submit
  // rather than sending the prefill - on a page that has been open a while, that value is stale.
  const [declaredTimeEdited, setDeclaredTimeEdited] = useState(false)
  const [transportCost, setTransportCost] = useState('')
  const [exitReason, setExitReason] = useState<SiteExitReason | ''>('')
  const [exitNote, setExitNote] = useState('')
  const [submittingExit, setSubmittingExit] = useState(false)

  function load() {
    setLoading(true)
    api
      .getMyAttendance()
      .then(({ current, history }) => {
        setCurrent(current)
        setHistory(history)
      })
      .catch(() => {
        setCurrent(null)
        setHistory([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const hasSiteCoords = !!current?.workOrder?.siteLat && !!current?.workOrder?.siteLng
  const latestVerification = current?.verifications[0] ?? null
  const needsExitReason = latestVerification?.status === 'OUTSIDE_SITE' && !latestVerification.exitReason

  // Periodic (not continuous) location re-check while checked in and linked to a work order with a
  // known site — stops the moment the technician checks out or leaves this page.
  useEffect(() => {
    if (!current || !hasSiteCoords) return
    const interval = setInterval(() => {
      getPosition()
        .then((pos) => api.verifyMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
        .then(() => load())
        .catch(() => {
          // A missed periodic check isn't worth interrupting the technician with an error.
        })
    }, VERIFY_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, hasSiteCoords])

  async function handleVerifyNow() {
    setVerifying(true)
    try {
      const pos = await getPosition()
      const result = await api.verifyMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      if ('skipped' in result) {
        toast.error('Not linked to a work order with a site location')
      } else {
        toast.success(result.verification.status === 'ON_SITE' ? 'Verified: you are on site' : "You're outside the assigned site")
      }
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to verify location')
    } finally {
      setVerifying(false)
    }
  }

  async function handleSubmitExitReason() {
    if (!exitReason) return
    setSubmittingExit(true)
    try {
      await api.submitMyExitReason({ reason: exitReason, note: exitNote || undefined })
      toast.success('Reason recorded')
      setExitReason('')
      setExitNote('')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit reason')
    } finally {
      setSubmittingExit(false)
    }
  }

  /** Resets the form back to a fresh prefilled state after a successful check-in or check-out. */
  function resetForm() {
    setNote('')
    setTransportCost('')
    setDeclaredTime(currentClockTime())
    setDeclaredTimeEdited(false)
  }

  /** The number the API expects, or undefined when the field was left blank - never NaN. */
  function transportCostForSubmit(): number | undefined {
    if (!transportCost.trim()) return undefined
    const amount = Number(transportCost)
    return Number.isFinite(amount) ? amount : undefined
  }

  async function handleCheckIn() {
    if (!note.trim()) {
      toast.error('A location is required to check in')
      return
    }
    setActioning(true)
    try {
      const pos = await getPosition()
      await api.checkInAttendance({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        note,
        timeIn: declaredTimeEdited ? declaredTime : currentClockTime(),
        transportCost: transportCostForSubmit(),
      })
      toast.success('Checked in')
      resetForm()
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to check in')
    } finally {
      setActioning(false)
    }
  }

  async function handleCheckOut() {
    setActioning(true)
    try {
      const pos = await getPosition()
      await api.checkOutAttendance({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        note: note || undefined,
        timeOut: declaredTimeEdited ? declaredTime : currentClockTime(),
        transportCost: transportCostForSubmit(),
      })
      toast.success('Checked out')
      resetForm()
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to check out')
    } finally {
      setActioning(false)
    }
  }

  if (loading) return null

  return (
    <Panel title="My Attendance">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {current ? (
              <p className="text-sm text-ink-100">
                Checked in since {clockOf(new Date(current.checkInAt))}
                {statedTimeSuffix(current.checkInDeclaredTime, current.checkInAt)}
                {current.checkInNote && <span className="text-ink-400"> · {current.checkInNote}</span>}
                {Number(current.checkInTransportCost ?? 0) > 0 && (
                  <span className="text-ink-400"> · transport Rs {Number(current.checkInTransportCost).toFixed(2)}</span>
                )}
                {current.workOrder && (
                  <span className="text-ink-400"> · {current.workOrder.workOrderNumber} — {current.workOrder.title}</span>
                )}
                {current && hasSiteCoords && (
                  <Badge tone={siteStatusTone(latestVerification?.status ?? 'UNVERIFIED')}>
                    {latestVerification ? latestVerification.status.replace('_', ' ') : 'NOT YET VERIFIED'}
                  </Badge>
                )}
              </p>
            ) : (
              <p className="text-sm text-ink-400">Not checked in</p>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="site-declared-time" className={fieldLabelClass}>
                {current ? 'TIME OUT' : 'TIME IN'}
              </label>
              <input
                id="site-declared-time"
                type="time"
                value={declaredTime}
                onChange={(e) => {
                  setDeclaredTime(e.target.value)
                  setDeclaredTimeEdited(true)
                }}
                className={`${noteInputClass} w-32`}
              />
            </div>

            <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
              <label htmlFor="site-location" className={fieldLabelClass}>
                {current ? 'NOTE (OPTIONAL)' : 'LOCATION'}
              </label>
              <input
                id="site-location"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={current ? 'Anything worth recording' : 'Office, client site...'}
                maxLength={200}
                className={noteInputClass}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="site-transport-cost" className={fieldLabelClass}>
                TRANSPORT (MUR)
              </label>
              <input
                id="site-transport-cost"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={transportCost}
                onChange={(e) => setTransportCost(e.target.value)}
                placeholder="If applicable"
                className={`${noteInputClass} w-36`}
              />
            </div>

            <div className="flex items-center gap-2">
              {current && hasSiteCoords && (
                <button type="button" onClick={handleVerifyNow} disabled={verifying} className={secondaryButtonClass}>
                  <RadioTower className="h-4 w-4" />
                  Verify My Location
                </button>
              )}
              {current ? (
                <button type="button" onClick={handleCheckOut} disabled={actioning} className={secondaryButtonClass}>
                  <LogOut className="h-4 w-4" />
                  Check Out
                </button>
              ) : (
                <button type="button" onClick={handleCheckIn} disabled={actioning} className={primaryButtonClass}>
                  <LogIn className="h-4 w-4" />
                  Check In
                </button>
              )}
            </div>
          </div>
        </div>

        {needsExitReason && (
          <div className="flex flex-wrap items-end gap-3 border-t border-ink-800 pt-3">
            <p className="w-full text-xs font-semibold tracking-widest text-amber-400">YOU'RE NOT AT THE ASSIGNED SITE</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold tracking-widest text-ink-400">REASON</label>
              <select
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value as SiteExitReason | '')}
                className={noteInputClass}
              >
                <option value="">Select a reason...</option>
                {EXIT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {SITE_EXIT_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 min-w-[12rem] flex-col gap-1">
              <label className="text-xs font-semibold tracking-widest text-ink-400">NOTE (OPTIONAL)</label>
              <input
                value={exitNote}
                onChange={(e) => setExitNote(e.target.value)}
                maxLength={300}
                className={noteInputClass}
              />
            </div>
            <button
              type="button"
              onClick={handleSubmitExitReason}
              disabled={!exitReason || submittingExit}
              className={primaryButtonClass}
            >
              Submit
            </button>
          </div>
        )}

        {history.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-ink-800 pt-3">
            {history.slice(0, 5).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 text-xs text-ink-400">
                <a
                  href={mapLink(v.checkInLat, v.checkInLng)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-cyan-accent hover:underline"
                >
                  <MapPin className="h-3 w-3" />
                  {new Date(v.checkInAt).toLocaleString()}
                  {statedTimeSuffix(v.checkInDeclaredTime, v.checkInAt)}
                  {v.checkInNote && <span> · {v.checkInNote}</span>}
                </a>
                <span className="flex items-center gap-2">
                  {totalTransportCost(v) > 0 && (
                    <span className="text-ink-300">Rs {totalTransportCost(v).toFixed(2)}</span>
                  )}
                  {v.checkOutAt ? (
                    <a
                      href={v.checkOutLat && v.checkOutLng ? mapLink(v.checkOutLat, v.checkOutLng) : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-cyan-accent hover:underline"
                    >
                      → {clockOf(new Date(v.checkOutAt))}
                      {statedTimeSuffix(v.checkOutDeclaredTime, v.checkOutAt)}
                      {v.checkOutNote && <span> · {v.checkOutNote}</span>}
                    </a>
                  ) : (
                    'Still checked in'
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}

export default AttendanceWidget
