import { useEffect } from 'react'
import * as api from './api'
import { ApiError } from './api'
import { getPosition, locationPermission } from './geolocation'
import { ATTENDANCE_CHANGED_EVENT } from './siteAttendance'

/** Spec 2026-09-26, section 4: a reading every 15 minutes during an open shift... */
const PING_INTERVAL_MS = 15 * 60 * 1000
/** ...and on returning to the foreground - but not again within 2 minutes (the server ignores those too). */
const MIN_GAP_MS = 2 * 60 * 1000

/** The flags AttendanceWidget keeps for its own location dialogs. */
function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/**
 * Shift pings: while the signed-in technician has an open shift **and the app is open on screen**,
 * send a location reading every 15 minutes and whenever the app comes back to the foreground.
 *
 * What this cannot do, and must never be described as doing: read the location in the
 * background. A web app (even installed to the home screen) gets no location while the phone is
 * locked, another app is in front, or the app is closed. Those stretches simply have no pings -
 * the server records them as MISSED_PING, a low-severity "unobserved" marker, not as leaving.
 * Continuous background tracking would need a native app. The random push compliance checks
 * (§28) are what reach a technician whose app is closed; they run alongside this.
 *
 * It never asks for location permission itself: pinging only when permission is already granted
 * (or, where the browser can't say, when the technician allowed it for check-in) - a permission
 * prompt popping up every 15 minutes would be both useless and maddening. Failures are silent: a
 * missed reading is exactly what MISSED_PING exists to show.
 */
export function useShiftPings(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let shiftOpen = false
    let lastSent = 0
    let sending = false

    async function refresh() {
      try {
        const { current } = await api.getMyAttendance()
        shiftOpen = !!current
      } catch {
        // Offline or signed out - leave the last known state.
      }
    }

    async function ping() {
      if (!shiftOpen || sending || document.visibilityState !== 'visible') return
      if (Date.now() - lastSent < MIN_GAP_MS) return
      const permission = await locationPermission()
      const allowed =
        permission === 'granted' ||
        (permission === 'unknown' && flag('technet-location-asked') && !flag('technet-location-declined'))
      if (!allowed) return

      sending = true
      lastSent = Date.now()
      try {
        const pos = await getPosition()
        await api.sendShiftPing({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          deviceTime: pos.timestamp,
        })
      } catch (err) {
        if (err instanceof ApiError && err.data?.code === 'NO_OPEN_SHIFT') shiftOpen = false
      } finally {
        sending = false
      }
    }

    // Opening the app counts as coming to the foreground.
    refresh().then(ping)
    const timer = window.setInterval(ping, PING_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh().then(ping)
    }
    // A check-in is itself a location reading, so the next ping is due 15 minutes after it.
    const onAttendanceChanged = () => {
      lastSent = Date.now()
      refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(ATTENDANCE_CHANGED_EVENT, onAttendanceChanged)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(ATTENDANCE_CHANGED_EVENT, onAttendanceChanged)
    }
  }, [enabled])
}
