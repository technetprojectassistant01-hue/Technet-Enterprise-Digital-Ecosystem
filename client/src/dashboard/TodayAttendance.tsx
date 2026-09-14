import { useEffect, useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import * as api from '../lib/api'
import type { MyAttendanceVisit } from '../lib/api'
import { Panel, TableSkeleton } from './ui'
import { ATTENDANCE_CHANGED_EVENT, clockOf, totalTransportCost } from '../lib/siteAttendance'
import { useT } from '../i18n'

function sameLocalDay(iso: string, day: Date): boolean {
  return new Date(iso).toDateString() === day.toDateString()
}

/**
 * "Today" under the check-in card: the signed-in user's check-ins and check-outs for today, newest
 * first. Refreshes when the card checks in or out (ATTENDANCE_CHANGED_EVENT). Like My Attendance,
 * only what they entered and the times — no coordinates or location flags (CLAUDE.md §7a).
 */
function TodayAttendance() {
  const t = useT()
  const [visits, setVisits] = useState<MyAttendanceVisit[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    function load() {
      api
        .getMyAttendanceHistory()
        .then(({ visits }) => {
          if (cancelled) return
          const today = new Date()
          setVisits(visits.filter((v) => sameLocalDay(v.checkInAt, today)))
          setError(null)
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : t.myAttendance.loadFailed)
        })
    }
    load()
    window.addEventListener(ATTENDANCE_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(ATTENDANCE_CHANGED_EVENT, load)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function shown(declared: string | null, recordedIso: string): string {
    return declared || clockOf(new Date(recordedIso))
  }

  function duration(v: MyAttendanceVisit): string | null {
    if (!v.checkOutAt) return null
    const minutes = Math.max(0, Math.round((new Date(v.checkOutAt).getTime() - new Date(v.checkInAt).getTime()) / 60000))
    const h = Math.floor(minutes / 60)
    return h > 0 ? t.shared.hoursMinutes(h, minutes % 60) : t.shared.minutesOnly(minutes)
  }

  return (
    <Panel title={t.myAttendance.todayTitle} icon={CalendarCheck}>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!error && visits === null && <TableSkeleton rows={2} cols={3} />}
      {!error && visits !== null && visits.length === 0 && (
        <p className="text-sm text-ink-300">{t.myAttendance.todayEmpty}</p>
      )}
      {!error && visits !== null && visits.length > 0 && (
        <ul className="flex flex-col gap-2">
          {visits.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-ink-800 bg-ink-950 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-mono text-sm text-ink-100">
                  <span>{shown(v.checkInDeclaredTime, v.checkInAt)}</span>
                  <span className="text-ink-400">→</span>
                  {v.checkOutAt ? (
                    <span>{shown(v.checkOutDeclaredTime, v.checkOutAt)}</span>
                  ) : (
                    <span className="font-sans text-xs font-semibold text-cyan-accent">{t.myAttendance.stillIn}</span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-ink-300">
                  {[v.checkInSite, v.checkInNote].filter(Boolean).join(' — ') || '—'}
                  {v.workOrder && <span className="font-mono"> · {v.workOrder.workOrderNumber}</span>}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-ink-300">
                {duration(v) && <span className="text-sm font-medium text-ink-100">{duration(v)}</span>}
                <span>MUR {totalTransportCost(v).toFixed(2)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export default TodayAttendance
