import { useEffect, useState } from 'react'
import { BellOff, BellRing, LogIn, LogOut } from 'lucide-react'
import * as api from '../lib/api'
import type { SiteAttendance } from '../lib/api'
import { getPosition } from '../lib/geolocation'
import { clockOf, currentClockTime, statedTimeSuffix, totalTransportCost } from '../lib/siteAttendance'
import { formatMoney } from '../lib/format'
import { Panel } from './ui'
import { primaryButtonClass, secondaryButtonClass } from './buttonStyles'
import { useToast } from './ToastContext'
import { disablePushReminders, enablePushReminders, pushSupport } from '../lib/pushNotifications'

const VERIFY_INTERVAL_MS = 10 * 60 * 1000

const noteInputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const fieldLabelClass = 'text-xs font-semibold tracking-widest text-ink-400'

/**
 * Opt-in for the 08:15 weekday check-in reminder.
 *
 * Deliberately a button rather than something that fires on load: browsers penalise sites that
 * request notification permission without a user gesture, and Chrome can block a site outright
 * for it. iPhone users are told to add the app to their Home Screen first, because Safari does
 * not expose PushManager in an ordinary tab — there is no way around that, and saying so beats
 * a button that fails for reasons they cannot see.
 */
function ReminderToggle() {
  const toast = useToast()
  const [devices, setDevices] = useState<number | null>(null)
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const support = pushSupport()

  useEffect(() => {
    api
      .getPushStatus()
      .then(({ enabled, devices }) => {
        setAvailable(enabled)
        setDevices(devices)
      })
      .catch(() => setAvailable(false))
  }, [])

  if (!available || devices === null || support === 'unsupported') return null

  if (support === 'needs-home-screen') {
    return <span className="text-xs text-ink-500">Add to your Home Screen for check-in reminders</span>
  }

  async function toggle() {
    setBusy(true)
    try {
      if (devices && devices > 0) {
        await disablePushReminders()
        toast.success('Check-in reminders turned off')
      } else {
        await enablePushReminders()
        toast.success("Reminders on — we'll nudge you at 8:15 if you haven't checked in")
      }
      const status = await api.getPushStatus()
      setDevices(status.devices)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change reminder settings')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-cyan-accent disabled:opacity-50"
    >
      {devices > 0 ? <BellRing className="h-3.5 w-3.5 text-cyan-accent" /> : <BellOff className="h-3.5 w-3.5" />}
      {devices > 0 ? 'Reminders on' : 'Remind me to check in'}
    </button>
  )
}

/**
 * The technician's own view of their attendance: time, location, transport, and their recent
 * visits. Deliberately does NOT surface the location tracking back at them - no coordinates, no
 * map links, no on-site/outside-site badge, no "explain why you left the site" prompt. All of
 * that still happens and is still recorded; it is shown to Admin, HR and Operations on Team
 * Attendance and Field Operations instead.
 *
 * Note this is about not confronting somebody with monitoring in their own screen. It is not
 * concealment, and must not be built into it: the browser's own geolocation permission prompt
 * discloses the tracking to every technician before the first check-in can succeed, and check-in
 * fails outright if they decline. That disclosure is not ours to remove.
 */
function AttendanceWidget() {
  const toast = useToast()
  const [current, setCurrent] = useState<SiteAttendance | null>(null)
  const [history, setHistory] = useState<SiteAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)
  const [note, setNote] = useState('')
  const [declaredTime, setDeclaredTime] = useState(currentClockTime)
  // The box is prefilled with the clock, so a technician who just opens the app and taps through
  // gets the right time with no typing. If they never touched it, we re-read the clock at submit
  // rather than sending the prefill - on a page that has been open a while, that value is stale.
  const [declaredTimeEdited, setDeclaredTimeEdited] = useState(false)
  const [transportCost, setTransportCost] = useState('')

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

  /**
   * Periodic (not continuous) location re-check while checked in and linked to a work order with a
   * known site. Runs once on mount and every 10 minutes after, and stops the moment the technician
   * checks out or leaves this page - it is still foreground-tab-only, since there is no service
   * worker (see CLAUDE.md §9).
   *
   * The immediate first run replaces the old manual "Verify My Location" button: a supervisor's
   * requested check is now satisfied by the technician simply opening the app, rather than by
   * asking them to press something. Failures stay silent - a missed check isn't worth interrupting
   * somebody mid-job over, and the result is for managers, not for them.
   */
  useEffect(() => {
    if (!current || !hasSiteCoords) return

    const verify = () =>
      getPosition()
        .then((pos) => api.verifyMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
        .catch(() => {})

    verify()
    const interval = setInterval(verify, VERIFY_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, hasSiteCoords])

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
    <Panel title="My Attendance" action={<ReminderToggle />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {current ? (
              <p className="text-sm text-ink-100">
                Checked in since {clockOf(new Date(current.checkInAt))}
                {statedTimeSuffix(current.checkInDeclaredTime, current.checkInAt)}
                {current.checkInNote && <span className="text-ink-400"> · {current.checkInNote}</span>}
                {Number(current.checkInTransportCost ?? 0) > 0 && (
                  <span className="text-ink-400"> · transport {formatMoney(Number(current.checkInTransportCost))}</span>
                )}
                {current.workOrder && (
                  <span className="text-ink-400"> · {current.workOrder.workOrderNumber} — {current.workOrder.title}</span>
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
                {current ? 'LOCATION (OPTIONAL)' : 'LOCATION'}
              </label>
              <input
                id="site-location"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={current ? 'Where you are leaving from' : 'Office, client site...'}
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


        {history.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-ink-800 pt-3">
            {history.slice(0, 5).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 text-xs text-ink-400">
                <span>
                  {new Date(v.checkInAt).toLocaleString()}
                  {statedTimeSuffix(v.checkInDeclaredTime, v.checkInAt)}
                  {v.checkInNote && <span> · {v.checkInNote}</span>}
                </span>
                <span className="flex items-center gap-2">
                  {totalTransportCost(v) > 0 && (
                    <span className="text-ink-300">{formatMoney(totalTransportCost(v))}</span>
                  )}
                  {v.checkOutAt ? (
                    <span>
                      → {clockOf(new Date(v.checkOutAt))}
                      {statedTimeSuffix(v.checkOutDeclaredTime, v.checkOutAt)}
                      {v.checkOutNote && <span> · {v.checkOutNote}</span>}
                    </span>
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
