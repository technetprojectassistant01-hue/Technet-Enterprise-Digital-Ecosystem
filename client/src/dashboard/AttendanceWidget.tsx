import { useEffect, useState } from 'react'
import { BellOff, BellRing, Briefcase, LogIn, LogOut, MapPin, MapPinOff } from 'lucide-react'
import * as api from '../lib/api'
import type { SiteAttendance } from '../lib/api'
import { getPosition, locationPermission, LocationDeniedError } from '../lib/geolocation'
import { clockOf, currentClockTime, statedTimeSuffix, ATTENDANCE_CHANGED_EVENT } from '../lib/siteAttendance'
import { Panel, Modal } from './ui'
import { useToast } from './ToastContext'
import { disablePushReminders, enablePushReminders, pushSupport } from '../lib/pushNotifications'
import { listOutbox, submitOrQueue, subscribeOutbox } from '../lib/outbox'
import { useT } from '../i18n'

const inputClass =
  'w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const fieldLabelClass = 'text-xs font-semibold tracking-widest text-ink-400'

/** Remembered on the device: the person tapped "Don't allow" on our location dialog. */
const LOCATION_DECLINED_KEY = 'technet-location-declined'
/** Remembered on the device: our first "Allow location?" dialog has been shown. */
const LOCATION_ASKED_KEY = 'technet-location-asked'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function writeFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // Storage blocked: the dialog just shows again next time.
  }
}

/**
 * Our own location dialogs, shown before and after the phone's permission prompt (whose wording
 * and buttons we can't change):
 * - ask: first time — Allow / Don't allow. Allow triggers the phone's prompt.
 * - needed: they declined before and tried to check in — Allow location / Not now.
 * - blocked: the phone/browser has location blocked — how to turn it back on, and Try again.
 */
type LocationDialogMode = 'ask' | 'needed' | 'blocked'

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
    return <span className="text-xs text-ink-400">{t.attendance.remindersNeedHomeScreen}</span>
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
 * one big unambiguous status, one primary action, few required fields (time and transport; site and
 * location are optional since 2026-09-14). The GPS fix is still taken on every check-in and out.
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
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  // A check-in/out saved on the device during a signal drop and not yet synced (see lib/outbox).
  const [pendingKinds, setPendingKinds] = useState<string[]>([])

  const [note, setNote] = useState('')
  // The site name, kept apart from the location because only the location is checked against GPS.
  const [site, setSite] = useState('')
  const [declaredTime, setDeclaredTime] = useState(currentClockTime)
  // The box is prefilled with the clock, so a technician who just opens the app and taps through
  // gets the right time with no typing. If they never touched it, we re-read the clock at submit
  // rather than sending the prefill — on a page open a while, the prefill is stale.
  const [declaredTimeEdited, setDeclaredTimeEdited] = useState(false)
  const [transportCost, setTransportCost] = useState('')
  const [transportNote, setTransportNote] = useState('')

  const [locationDialog, setLocationDialog] = useState<LocationDialogMode | null>(null)
  /** What to do once location is available: submit the check-in/out, or nothing (asked on page load). */
  const [pendingAction, setPendingAction] = useState<((pos: GeolocationPosition) => Promise<void>) | null>(null)

  function load() {
    setLoading(true)
    api
      .getMyAttendance()
      .then(({ current }) => setCurrent(current))
      .catch(() => setCurrent(null))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useEffect(() => {
    if (readFlag(LOCATION_ASKED_KEY) || readFlag(LOCATION_DECLINED_KEY)) return
    locationPermission().then((state) => {
      if (state === 'prompt' || state === 'unknown') {
        setPendingAction(null)
        setLocationDialog('ask')
      }
    })
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
    setSite('')
    setTransportCost('')
    setTransportNote('')
    setDeclaredTime(currentClockTime())
    setDeclaredTimeEdited(false)
  }

  /** Transport cost is required — a technician with no travel enters 0. */
  function parseTransport(): { value: number; note: string | undefined } | { error: string } {
    if (!transportCost.trim()) return { error: t.attendance.enterTransport }
    const amount = Number(transportCost)
    if (!Number.isFinite(amount) || amount < 0) return { error: t.attendance.transportInvalid }
    const note = transportNote.trim()
    if (amount === 0 && !note) return { error: t.attendance.zeroTransportNoteRequired }
    return { value: amount, note: note || undefined }
  }

  /** Gets a GPS fix and runs the action with it; a refusal opens the "blocked" dialog. */
  async function runWithLocation(action: ((pos: GeolocationPosition) => Promise<void>) | null) {
    setActioning(true)
    try {
      const pos = await getPosition()
      writeFlag(LOCATION_DECLINED_KEY, false)
      writeFlag(LOCATION_ASKED_KEY, true)
      if (action) await action(pos)
    } catch (err) {
      if (err instanceof LocationDeniedError) {
        setPendingAction(() => action)
        setLocationDialog('blocked')
      } else {
        toast.error(err instanceof Error ? err.message : t.attendance.checkInFailed)
      }
    } finally {
      setActioning(false)
    }
  }

  /** Check-in and check-out both need location: go straight ahead if allowed, otherwise ask first. */
  async function withLocation(action: (pos: GeolocationPosition) => Promise<void>) {
    const state = await locationPermission()
    if (state === 'granted' || (state === 'unknown' && readFlag(LOCATION_ASKED_KEY) && !readFlag(LOCATION_DECLINED_KEY))) {
      return runWithLocation(action)
    }
    setPendingAction(() => action)
    setLocationDialog(state === 'denied' ? 'blocked' : readFlag(LOCATION_DECLINED_KEY) ? 'needed' : 'ask')
  }

  function allowLocation() {
    const action = pendingAction
    setLocationDialog(null)
    setPendingAction(null)
    writeFlag(LOCATION_ASKED_KEY, true)
    runWithLocation(action)
  }

  function declineLocation() {
    setLocationDialog(null)
    setPendingAction(null)
    writeFlag(LOCATION_ASKED_KEY, true)
    writeFlag(LOCATION_DECLINED_KEY, true)
  }

  async function handleCheckIn() {
    if (!declaredTime) {
      toast.error(t.attendance.enterTimeIn)
      return
    }
    const transport = parseTransport()
    if ('error' in transport) {
      toast.error(transport.error)
      return
    }
    await withLocation(async (pos) => {
      const { queued } = await submitOrQueue({
        kind: 'check-in',
        label: t.attendance.outboxCheckIn(site.trim() || note.trim()),
        endpoint: '/api/site-attendance/check-in',
        body: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          note: note.trim() || undefined,
          site: site.trim() || undefined,
          timeIn: declaredTimeEdited ? declaredTime : currentClockTime(),
          transportCost: transport.value,
          transportNote: transport.note,
        },
      })
      toast.success(queued ? t.attendance.queued : t.attendance.checkedInToast)
      window.dispatchEvent(new Event(ATTENDANCE_CHANGED_EVENT))
      resetForm()
      load()
    })
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
    await withLocation(async (pos) => {
      const { queued } = await submitOrQueue({
        kind: 'check-out',
        label: t.attendance.outboxCheckOut,
        endpoint: '/api/site-attendance/check-out',
        body: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          note: note || undefined,
          site: site.trim() || undefined,
          timeOut: declaredTimeEdited ? declaredTime : currentClockTime(),
          transportCost: transport.value,
          transportNote: transport.note,
        },
      })
      toast.success(queued ? t.attendance.queued : t.attendance.checkedOutToast)
      window.dispatchEvent(new Event(ATTENDANCE_CHANGED_EVENT))
      resetForm()
      load()
    })
  }

  if (loading) return null

  const primaryButton =
    'flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-accent px-4 py-3.5 text-base font-semibold text-ink-950 transition hover:bg-cyan-accent-dark disabled:opacity-60'

  return (
    // max-w-md + mx-auto: a compact, phone-shaped card centred on a wide screen — this is a focused
    // single-task view, not a full-width dashboard panel.
    <>
    <Panel title={t.attendance.title} action={<ReminderToggle />} className="mx-auto w-full max-w-md">
      <div className="flex w-full flex-col gap-4">
        {/* Status card */}
        {checkedIn && current ? (
          <div className="rounded-xl border border-ink-700 bg-ink-950/60 px-4 py-5 text-center">
            <div className="text-[11px] font-semibold tracking-widest text-ink-400">{t.attendance.currentStatus}</div>
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
          const showTransportNote = transportCost.trim() !== '' && Number.isFinite(Number(transportCost)) && Number(transportCost) === 0
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
            <>
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
              {showTransportNote && (
                <div className="col-span-2 flex flex-col gap-1">
                  <label htmlFor="att-transport-note" className={fieldLabelClass}>
                    {t.attendance.transportNote}
                  </label>
                  <input
                    id="att-transport-note"
                    value={transportNote}
                    onChange={(e) => setTransportNote(e.target.value)}
                    placeholder={t.attendance.transportNotePlaceholder}
                    maxLength={200}
                    className={inputClass}
                  />
                </div>
              )}
            </>
          )
          const siteField = (
            <div className="flex flex-col gap-1">
              <label htmlFor="att-site" className={fieldLabelClass}>
                {t.attendance.site}
              </label>
              <input
                id="att-site"
                value={site}
                onChange={(e) => setSite(e.target.value)}
                placeholder={t.attendance.sitePlaceholder}
                maxLength={200}
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
              {siteField}
              <div className="flex flex-col gap-1">
                <label htmlFor="att-out-note" className={fieldLabelClass}>
                  {t.attendance.location}
                </label>
                <input
                  id="att-out-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.attendance.wherePlaceholder}
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
              <div className="grid grid-cols-2 gap-3">
                {time}
                {transport}
              </div>

              {siteField}

              <div className="flex flex-col gap-1">
                <label htmlFor="att-location" className={fieldLabelClass}>
                  {t.attendance.location}
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

              <button type="button" onClick={handleCheckIn} disabled={actioning} className={primaryButton}>
                <LogIn className="h-5 w-5" />
                {actioning ? t.attendance.checkingIn : t.attendance.checkIn}
              </button>
            </div>
          )
        })()}

      </div>
    </Panel>

    {locationDialog && (
      <Modal
        title={
          locationDialog === 'ask'
            ? t.attendance.locationAskTitle
            : locationDialog === 'needed'
              ? t.attendance.locationNeededTitle
              : t.attendance.locationBlockedTitle
        }
        onClose={() => (locationDialog === 'ask' ? declineLocation() : setLocationDialog(null))}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                locationDialog === 'blocked' ? 'bg-amber-400/10 text-amber-400' : 'bg-cyan-accent/10 text-cyan-accent'
              }`}
            >
              {locationDialog === 'blocked' ? <MapPinOff className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
            </span>
            <div className="flex flex-col gap-2 text-sm text-ink-200">
              <p>
                {locationDialog === 'ask'
                  ? t.attendance.locationAskBody
                  : locationDialog === 'needed'
                    ? t.attendance.locationNeededBody
                    : t.attendance.locationBlockedBody}
              </p>
              {locationDialog === 'blocked' && (
                <ol className="list-decimal space-y-1 pl-5 text-ink-300">
                  {t.attendance.locationBlockedSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={locationDialog === 'ask' ? declineLocation : () => setLocationDialog(null)}
              className="rounded-lg border border-ink-600 px-4 py-3 text-sm font-semibold text-ink-200 transition hover:bg-ink-800"
            >
              {locationDialog === 'ask' ? t.attendance.dontAllow : t.attendance.notNow}
            </button>
            <button
              type="button"
              onClick={allowLocation}
              className="rounded-lg bg-cyan-accent px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-cyan-accent-dark"
            >
              {locationDialog === 'blocked' ? t.attendance.tryAgain : locationDialog === 'ask' ? t.attendance.allow : t.attendance.allowLocation}
            </button>
          </div>
        </div>
      </Modal>
    )}
    </>
  )
}

export default AttendanceWidget
