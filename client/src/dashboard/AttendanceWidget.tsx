import { useEffect, useState } from 'react'
import { BellOff, BellRing, Briefcase, LogIn, LogOut } from 'lucide-react'
import * as api from '../lib/api'
import type { MyWorkOrderOption, SiteAttendance } from '../lib/api'
import { getPosition } from '../lib/geolocation'
import { clockOf, currentClockTime, statedTimeSuffix, totalTransportCost } from '../lib/siteAttendance'
import { formatMoney } from '../lib/format'
import { Panel } from './ui'
import { useToast } from './ToastContext'
import { disablePushReminders, enablePushReminders, pushSupport } from '../lib/pushNotifications'
import { listOutbox, submitOrQueue, subscribeOutbox } from '../lib/outbox'
import { useT } from '../i18n'

const inputClass =
  'w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const fieldLabelClass = 'text-xs font-semibold tracking-widest text-ink-400'

/** "2h 14m" since an ISO timestamp, or `justNow` under a minute. */
function durationSince(iso: string, now: number, justNow: string): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
  if (mins < 1) return justNow
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h === 0 ? `${m}m` : `${h}h ${m}m`
}

/**
 * Opt-in for the 08:15 weekday check-in reminder. Deliberately a button, not something that fires
 * on load — browsers penalise (and Chrome can block) a site that asks for notification permission
 * without a user gesture. iPhone users must add the app to the Home Screen first (Safari hides
 * PushManager in an ordinary tab), and saying so beats a button that fails invisibly.
 */
function ReminderToggle() {
  const toast = useToast()
  const t = useT()
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
    return <span className="text-xs text-ink-500">{t.attendance.remindersNeedHomeScreen}</span>
  }

  async function toggle() {
    setBusy(true)
    try {
      if (devices && devices > 0) {
        await disablePushReminders()
        toast.success(t.attendance.remindersOffToast)
      } else {
        await enablePushReminders()
        toast.success(t.attendance.remindersOnToast)
      }
      const status = await api.getPushStatus()
      setDevices(status.devices)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.attendance.reminderFailed)
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
      {devices > 0 ? t.attendance.remindersOn : t.attendance.remindMe}
    </button>
  )
}

/**
 * The technician's own attendance screen — the one used most, often one-handed and outdoors, so:
 * one big unambiguous status, one primary action, minimal required fields (only the location, on
 * check-in). Transport and a departure note sit behind a "Trip details" disclosure so a normal
 * check-out is a single tap.
 *
 * It deliberately does NOT surface the location tracking back at the technician — no coordinates,
 * no map, no on-site/off-site verdict, no "explain why you left" prompt. All of that is still
 * recorded and shown to Admin/HR/Operations on Team Attendance and Field Operations. This is about
 * not confronting somebody with monitoring in their own screen; it is not concealment (the
 * browser's geolocation prompt discloses the tracking before the first check-in can succeed, and
 * a decline blocks check-in). See CLAUDE.md §7a.
 */
function AttendanceWidget() {
  const toast = useToast()
  const t = useT()
  const [current, setCurrent] = useState<SiteAttendance | null>(null)
  const [history, setHistory] = useState<SiteAttendance[]>([])
  const [myWorkOrders, setMyWorkOrders] = useState<MyWorkOrderOption[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  // A check-in/out saved on the device during a signal drop and not yet synced (see lib/outbox).
  const [pendingKinds, setPendingKinds] = useState<string[]>([])

  const [note, setNote] = useState('')
  const [workOrderId, setWorkOrderId] = useState('')
  const [declaredTime, setDeclaredTime] = useState(currentClockTime)
  // The box is prefilled with the clock, so a technician who just opens the app and taps through
  // gets the right time with no typing. If they never touched it, we re-read the clock at submit
  // rather than sending the prefill — on a page open a while, the prefill is stale.
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
  useEffect(() => {
    api.getMyWorkOrders().then(({ workOrders }) => setMyWorkOrders(workOrders)).catch(() => setMyWorkOrders([]))
  }, [])

  // Tick the on-site duration once a minute while checked in.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const refresh = () =>
      listOutbox().then((items) =>
        setPendingKinds(items.filter((i) => i.kind === 'check-in' || i.kind === 'check-out').map((i) => i.kind)),
      )
    refresh()
    return subscribeOutbox(refresh)
  }, [])

  const pendingCheckIn = pendingKinds.includes('check-in')
  const pendingCheckOut = pendingKinds.includes('check-out')
  // "Checked in" from the technician's point of view: a live session, or a queued check-in not yet
  // followed by a queued check-out.
  const checkedIn = !!current || (pendingCheckIn && !pendingCheckOut)
  const awaitingSync = (pendingCheckIn && !current) || pendingCheckOut

  function resetForm() {
    setNote('')
    setWorkOrderId('')
    setTransportCost('')
    setDeclaredTime(currentClockTime())
    setDeclaredTimeEdited(false)
  }

  /** Transport cost is required — a technician with no travel enters 0. */
  function parseTransport(): { value: number } | { error: string } {
    if (!transportCost.trim()) return { error: t.attendance.enterTransport }
    const amount = Number(transportCost)
    if (!Number.isFinite(amount) || amount < 0) return { error: t.attendance.transportInvalid }
    return { value: amount }
  }

  async function handleCheckIn() {
    if (!note.trim()) {
      toast.error(t.attendance.enterLocation)
      return
    }
    if (!declaredTime) {
      toast.error(t.attendance.enterTimeIn)
      return
    }
    const transport = parseTransport()
    if ('error' in transport) {
      toast.error(transport.error)
      return
    }
    setActioning(true)
    try {
      const pos = await getPosition()
      const { queued } = await submitOrQueue({
        kind: 'check-in',
        label: t.attendance.outboxCheckIn(note.trim()),
        endpoint: '/api/site-attendance/check-in',
        body: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          note,
          workOrderId: workOrderId || undefined,
          timeIn: declaredTimeEdited ? declaredTime : currentClockTime(),
          transportCost: transport.value,
        },
      })
      toast.success(queued ? t.attendance.queued : t.attendance.checkedInToast)
      resetForm()
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.attendance.checkInFailed)
    } finally {
      setActioning(false)
    }
  }

  async function handleCheckOut() {
    if (!declaredTime) {
      toast.error(t.attendance.enterTimeOut)
      return
    }
    const transport = parseTransport()
    if ('error' in transport) {
      toast.error(transport.error)
      return
    }
    setActioning(true)
    try {
      const pos = await getPosition()
      const { queued } = await submitOrQueue({
        kind: 'check-out',
        label: t.attendance.outboxCheckOut,
        endpoint: '/api/site-attendance/check-out',
        body: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          note: note || undefined,
          timeOut: declaredTimeEdited ? declaredTime : currentClockTime(),
          transportCost: transport.value,
        },
      })
      toast.success(queued ? t.attendance.queued : t.attendance.checkedOutToast)
      resetForm()
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.attendance.checkOutFailed)
    } finally {
      setActioning(false)
    }
  }

  if (loading) return null

  const primaryButton =
    'flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-accent px-4 py-3.5 text-base font-semibold text-ink-950 transition hover:bg-cyan-accent-dark disabled:opacity-60'

  return (
    // max-w-md: a compact, phone-shaped card even on a wide screen — this is a focused
    // single-task view, not a full-width dashboard panel.
    <Panel title={t.attendance.title} action={<ReminderToggle />} className="max-w-md">
      <div className="flex w-full flex-col gap-4">
        {/* Status card */}
        {checkedIn && current ? (
          <div className="rounded-xl border border-ink-700 bg-ink-950/60 px-4 py-5 text-center">
            <div className="text-[11px] font-semibold tracking-widest text-ink-500">{t.attendance.currentStatus}</div>
            <div className="mt-1 flex items-center justify-center gap-2 text-base font-bold text-ink-100">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              {t.attendance.checkedIn}
            </div>
            <div className="mt-2 text-4xl font-bold tracking-tight text-cyan-accent">
              {durationSince(current.checkInAt, now, t.attendance.justNow)}
            </div>
            <div className="mt-1 text-xs text-ink-400">
              {t.attendance.since(clockOf(new Date(current.checkInAt)))}
              {statedTimeSuffix(current.checkInDeclaredTime, current.checkInAt)}
            </div>
            {current.workOrder && (
              <div className="mx-auto mt-3 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-ink-800 px-3 py-1.5 text-xs text-ink-200">
                <Briefcase className="h-3.5 w-3.5 shrink-0 text-cyan-accent" />
                <span className="truncate">
                  {current.workOrder.workOrderNumber} — {current.workOrder.title}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-ink-800 bg-ink-950/60 px-4 py-3 text-sm font-semibold">
            <span className={`h-2 w-2 rounded-full ${checkedIn ? 'bg-emerald-400' : 'bg-ink-500'}`} />
            <span className={checkedIn ? 'text-ink-100' : 'text-ink-300'}>
              {checkedIn ? t.attendance.checkedIn : t.attendance.notCheckedIn}
            </span>
            {(awaitingSync || (checkedIn && !current)) && (
              <span className="text-xs font-normal text-amber-300">{t.attendance.waitingToSync}</span>
            )}
          </div>
        )}

        {/* Primary action + its fields */}
        {(() => {
          const time = (
            <div className="flex flex-col gap-1">
              <label htmlFor="att-time" className={fieldLabelClass}>
                {checkedIn ? t.attendance.timeOut : t.attendance.timeIn}
              </label>
              <input
                id="att-time"
                type="time"
                value={declaredTime}
                onChange={(e) => {
                  setDeclaredTime(e.target.value)
                  setDeclaredTimeEdited(true)
                }}
                className={inputClass}
              />
            </div>
          )
          const transport = (
            <div className="flex flex-col gap-1">
              <label htmlFor="att-transport" className={fieldLabelClass}>
                {t.attendance.transport}
              </label>
              <input
                id="att-transport"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={transportCost}
                onChange={(e) => setTransportCost(e.target.value)}
                placeholder={t.attendance.transportPlaceholder}
                className={inputClass}
              />
            </div>
          )

          return checkedIn ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {time}
                {transport}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="att-out-note" className={fieldLabelClass}>
                  {t.attendance.leavingFrom}
                </label>
                <input
                  id="att-out-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.attendance.leavingFromPlaceholder}
                  maxLength={200}
                  className={inputClass}
                />
              </div>
              <button type="button" onClick={handleCheckOut} disabled={actioning} className={primaryButton}>
                <LogOut className="h-5 w-5" />
                {actioning ? t.attendance.checkingOut : t.attendance.checkOut}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="att-location" className={fieldLabelClass}>
                  {t.attendance.whereAreYou}
                </label>
                <input
                  id="att-location"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.attendance.wherePlaceholder}
                  maxLength={200}
                  className={inputClass}
                />
              </div>

              {myWorkOrders.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="att-wo" className={fieldLabelClass}>
                    {t.attendance.whichJob}
                  </label>
                  <select
                    id="att-wo"
                    value={workOrderId}
                    onChange={(e) => setWorkOrderId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t.attendance.noSpecificJob}</option>
                    {myWorkOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.workOrderNumber} — {wo.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {time}
                {transport}
              </div>

              <button type="button" onClick={handleCheckIn} disabled={actioning} className={primaryButton}>
                <LogIn className="h-5 w-5" />
                {actioning ? t.attendance.checkingIn : t.attendance.checkIn}
              </button>
            </div>
          )
        })()}

        {/* Today */}
        {history.length > 0 && (
          <div className="border-t border-ink-800 pt-3">
            <div className="mb-2 text-[11px] font-semibold tracking-widest text-ink-500">{t.attendance.recent}</div>
            <div className="flex flex-col gap-2.5">
              {history.slice(0, 5).map((v) => (
                <div key={v.id} className="flex items-start gap-2.5 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-accent/70" />
                  <div className="min-w-0 flex-1 text-ink-400">
                    <span className="text-ink-200">
                      {clockOf(new Date(v.checkInAt))}
                      {v.checkOutAt ? ` – ${clockOf(new Date(v.checkOutAt))}` : t.attendance.stillIn}
                    </span>
                    {v.checkInNote && <span> · {v.checkInNote}</span>}
                    {totalTransportCost(v) > 0 && (
                      <span className="text-ink-300"> · {formatMoney(totalTransportCost(v))}</span>
                    )}
                    <span className="block text-ink-500">{new Date(v.checkInAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

export default AttendanceWidget
