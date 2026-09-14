import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, History } from 'lucide-react'
import * as api from '../lib/api'
import type { MyAttendanceVisit } from '../lib/api'
import { Panel, EmptyState, TableSkeleton } from './ui'
import { clockOf, totalTransportCost } from '../lib/siteAttendance'
import { useT } from '../i18n'

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** The time as the person typed it, falling back to the recorded clock time. */
function shownTime(declared: string | null, recordedIso: string | null): string {
  if (declared) return declared
  return recordedIso ? clockOf(new Date(recordedIso)) : '—'
}

/**
 * "My Attendance" at the bottom of the landing page: every check-in/check-out the signed-in user
 * made, a month at a time, with a small summary. Shows what they entered and how long they were
 * in — never coordinates or location flags (CLAUDE.md §7a).
 */
function MyAttendanceHistory() {
  const t = useT()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [visits, setVisits] = useState<MyAttendanceVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isCurrentMonth = monthKey(cursor) === monthKey(new Date())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getMyAttendanceHistory(monthKey(cursor))
      .then(({ visits }) => {
        if (!cancelled) setVisits(visits)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t.myAttendance.loadFailed)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cursor]) // eslint-disable-line react-hooks/exhaustive-deps

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  }

  function duration(visit: MyAttendanceVisit): string {
    if (!visit.checkOutAt) return '—'
    const minutes = Math.max(0, Math.round((new Date(visit.checkOutAt).getTime() - new Date(visit.checkInAt).getTime()) / 60000))
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? t.shared.hoursMinutes(h, m) : t.shared.minutesOnly(m)
  }

  const days = new Set(visits.map((v) => new Date(v.checkInAt).toDateString())).size
  const totalMinutes = visits.reduce(
    (sum, v) => (v.checkOutAt ? sum + (new Date(v.checkOutAt).getTime() - new Date(v.checkInAt).getTime()) / 60000 : sum),
    0,
  )
  const totalTransport = visits.reduce((sum, v) => sum + totalTransportCost(v), 0)
  const hoursTotal = t.shared.hoursMinutes(Math.floor(totalMinutes / 60), Math.round(totalMinutes % 60))

  const monthLabel = `${t.shared.months[cursor.getMonth()]} ${cursor.getFullYear()}`
  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })

  const monthPicker = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => shiftMonth(-1)}
        aria-label={t.myAttendance.previousMonth}
        className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[8.5rem] text-center text-sm font-medium text-ink-100">{monthLabel}</span>
      <button
        type="button"
        onClick={() => shiftMonth(1)}
        disabled={isCurrentMonth}
        aria-label={t.myAttendance.nextMonth}
        className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )

  return (
    <Panel title={t.myAttendance.title} icon={History} action={monthPicker}>
      {!loading && !error && visits.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t.myAttendance.statDays, value: String(days) },
            { label: t.myAttendance.statCheckIns, value: String(visits.length) },
            { label: t.myAttendance.statHours, value: hoursTotal },
            { label: t.myAttendance.statTransport, value: totalTransport.toFixed(2) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-ink-800 bg-ink-950 px-3 py-2.5">
              <div className="text-[11px] font-semibold tracking-widest text-ink-400">{s.label}</div>
              <div className="mt-1 text-lg font-semibold text-ink-100">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : visits.length === 0 ? (
        <EmptyState icon={History} message={t.myAttendance.empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                <th className="px-3 py-3 font-semibold">{t.myAttendance.colDate}</th>
                <th className="px-3 py-3 font-semibold">{t.myAttendance.colIn}</th>
                <th className="px-3 py-3 font-semibold">{t.myAttendance.colOut}</th>
                <th className="px-3 py-3 font-semibold">{t.myAttendance.colWhere}</th>
                <th className="px-3 py-3 font-semibold">{t.myAttendance.colHours}</th>
                <th className="px-3 py-3 font-semibold">{t.myAttendance.colTransport}</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-ink-800 align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-3 text-ink-100">{dateFormat.format(new Date(v.checkInAt))}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-ink-100">
                    {shownTime(v.checkInDeclaredTime, v.checkInAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {v.checkOutAt ? (
                      <>
                        <span className="font-mono text-ink-100">{shownTime(v.checkOutDeclaredTime, v.checkOutAt)}</span>
                        {v.checkOutByManager && (
                          <div className="text-xs text-ink-400">{t.myAttendance.closedByManager}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-cyan-accent">{t.myAttendance.stillIn}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-ink-300">
                    <div className="text-ink-100">{v.checkInNote || '—'}</div>
                    {v.checkOutNote && v.checkOutNote !== v.checkInNote && (
                      <div className="text-xs text-ink-400">{t.myAttendance.leftFrom(v.checkOutNote)}</div>
                    )}
                    {v.workOrder && (
                      <div className="mt-0.5 text-xs text-ink-400">
                        <span className="font-mono">{v.workOrder.workOrderNumber}</span> · {v.workOrder.title}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-100">{duration(v)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-100">{totalTransportCost(v).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

export default MyAttendanceHistory
