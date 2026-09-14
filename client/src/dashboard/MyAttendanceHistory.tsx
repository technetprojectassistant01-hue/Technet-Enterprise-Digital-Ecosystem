import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, History } from 'lucide-react'
import * as api from '../lib/api'
import type { MyAttendanceVisit } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from './ui'
import { ATTENDANCE_CHANGED_EVENT, clockOf, totalTransportCost } from '../lib/siteAttendance'
import { computeDayFlags } from '../lib/workSchedule'
import { downloadCsv } from '../lib/csv'
import { useT } from '../i18n'

/** Local calendar day of a timestamp, "YYYY-MM-DD" — matches the server's Mauritius day. */
function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
 * made, a month at a time, with a small summary, a Late badge against the standard work hours
 * (lib/workSchedule.ts), an Overtime badge only once HR has approved it, and a CSV export. Shows what they entered and how long they were in —
 * never coordinates or location flags (CLAUDE.md §7a).
 */
function MyAttendanceHistory() {
  const t = useT()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [visits, setVisits] = useState<MyAttendanceVisit[]>([])
  /** Overtime HR has approved, by day ("YYYY-MM-DD" → minutes). Nothing else is shown as overtime. */
  const [approvedOvertime, setApprovedOvertime] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Bumped when the check-in card checks in or out, to reload the month on screen. */
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const bump = () => setReloadKey((k) => k + 1)
    window.addEventListener(ATTENDANCE_CHANGED_EVENT, bump)
    return () => window.removeEventListener(ATTENDANCE_CHANGED_EVENT, bump)
  }, [])

  const isCurrentMonth = monthKey(cursor) === monthKey(new Date())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getMyAttendanceHistory(monthKey(cursor))
      .then(({ visits, approvedOvertime }) => {
        if (cancelled) return
        setVisits(visits)
        setApprovedOvertime(new Map(approvedOvertime.map((o) => [o.date, o.minutes])))
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
  }, [cursor, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  }

  /** "1h 20m" / "45m" */
  function span(minutes: number): string {
    const rounded = Math.max(0, Math.round(minutes))
    const h = Math.floor(rounded / 60)
    return h > 0 ? t.shared.hoursMinutes(h, rounded % 60) : t.shared.minutesOnly(rounded)
  }

  const { late } = computeDayFlags(visits)
  // Approved overtime sits on the day's last visit — the one with the latest check-in.
  const overtime = new Map<string, number>()
  {
    const lastByDay = new Map<string, MyAttendanceVisit>()
    for (const v of visits) {
      const key = dayKey(v.checkInAt)
      const current = lastByDay.get(key)
      if (!current || new Date(v.checkInAt) > new Date(current.checkInAt)) lastByDay.set(key, v)
    }
    for (const [key, v] of lastByDay) {
      const minutes = approvedOvertime.get(key)
      if (minutes) overtime.set(v.id, minutes)
    }
  }
  const lateDays = late.size
  const overtimeMinutes = [...overtime.values()].reduce((a, b) => a + b, 0)

  const days = new Set(visits.map((v) => new Date(v.checkInAt).toDateString())).size
  const totalMinutes = visits.reduce(
    (sum, v) => (v.checkOutAt ? sum + (new Date(v.checkOutAt).getTime() - new Date(v.checkInAt).getTime()) / 60000 : sum),
    0,
  )
  const totalTransport = visits.reduce((sum, v) => sum + totalTransportCost(v), 0)
  const hoursTotal = t.shared.hoursMinutes(Math.floor(totalMinutes / 60), Math.round(totalMinutes % 60))

  const monthLabel = `${t.shared.months[cursor.getMonth()]} ${cursor.getFullYear()}`
  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })

  // CSV (opens in Excel). Kept in English like the app's other exports — it's a data file.
  function exportCsv() {
    const csvDate = (iso: string) => {
      const d = new Date(iso)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    downloadCsv(
      `my-attendance-${monthKey(cursor)}`,
      [
        { header: 'Date', accessor: (v: MyAttendanceVisit) => csvDate(v.checkInAt) },
        { header: 'Time In', accessor: (v: MyAttendanceVisit) => shownTime(v.checkInDeclaredTime, v.checkInAt) },
        { header: 'Time Out', accessor: (v: MyAttendanceVisit) => (v.checkOutAt ? shownTime(v.checkOutDeclaredTime, v.checkOutAt) : '') },
        { header: 'Location', accessor: (v: MyAttendanceVisit) => v.checkInNote ?? '' },
        { header: 'Check-out Location', accessor: (v: MyAttendanceVisit) => v.checkOutNote ?? '' },
        { header: 'Transport (MUR)', accessor: (v: MyAttendanceVisit) => totalTransportCost(v).toFixed(2) },
        { header: 'Late (minutes)', accessor: (v: MyAttendanceVisit) => late.get(v.id) ?? '' },
        { header: 'Overtime (minutes)', accessor: (v: MyAttendanceVisit) => overtime.get(v.id) ?? '' },
      ],
      // Oldest first reads naturally in a spreadsheet.
      [...visits].reverse(),
    )
  }

  const monthPicker = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={exportCsv}
        disabled={loading || visits.length === 0}
        className="mr-2 inline-flex items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition hover:border-cyan-accent hover:text-cyan-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t.shared.exportCsv}</span>
      </button>
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
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: t.myAttendance.statDays, value: String(days) },
            { label: t.myAttendance.statHours, value: hoursTotal },
            { label: t.myAttendance.statLate, value: String(lateDays) },
            { label: t.myAttendance.statOvertime, value: span(overtimeMinutes) },
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
                <th className="px-3 py-3 font-semibold">{t.myAttendance.colTransport}</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-ink-800 align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-3 text-ink-100">{dateFormat.format(new Date(v.checkInAt))}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className="font-mono text-ink-100">{shownTime(v.checkInDeclaredTime, v.checkInAt)}</span>
                    {late.has(v.id) && (
                      <div className="mt-1">
                        <Badge tone="warning">{t.myAttendance.lateBy(span(late.get(v.id)!))}</Badge>
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {v.checkOutAt ? (
                      <>
                        <span className="font-mono text-ink-100">{shownTime(v.checkOutDeclaredTime, v.checkOutAt)}</span>
                        {overtime.has(v.id) && (
                          <div className="mt-1">
                            <Badge tone="accent">{t.myAttendance.overtimeBy(span(overtime.get(v.id)!))}</Badge>
                          </div>
                        )}
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
                  <td className="whitespace-nowrap px-3 py-3 text-ink-100">{totalTransportCost(v).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-400">{t.myAttendance.scheduleNote}</p>
    </Panel>
  )
}

export default MyAttendanceHistory
