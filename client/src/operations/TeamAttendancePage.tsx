import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Lock, MapPin, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import * as api from '../lib/api'
import type { SiteAttendanceWithEmployee, TechnicianAttendanceSummary } from '../lib/api'
import { Panel, Badge, EmptyState, Modal, TableSkeleton } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, ATTENDANCE_VIEW_ROLES } from '../lib/permissions'
import { mapLink } from '../lib/geolocation'
import {
  hasLocationMismatch,
  hasStatedTimeGap,
  locationMismatchLabel,
  statedTimeGapLabel,
  statedTimeSuffix,
  totalTransportCost,
} from '../lib/siteAttendance'
import { formatMoney } from '../lib/format'
import { downloadCsv } from '../lib/csv'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { useEmployees } from '../erp/useEmployees'
import { useToast } from '../dashboard/ToastContext'
import { enumLabel, useT } from '../i18n'

const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function siteStatusTone(status: 'ON_SITE' | 'OUTSIDE_SITE' | 'UNVERIFIED') {
  if (status === 'ON_SITE') return 'success' as const
  if (status === 'OUTSIDE_SITE') return 'warning' as const
  return 'neutral' as const
}

function WorkOrderLink({ v }: { v: SiteAttendanceWithEmployee }) {
  if (!v.workOrder) return <span className="text-ink-400">—</span>
  return (
    <Link to={`/dashboard/operations/work-orders/${v.workOrder.id}`} className="text-cyan-accent hover:underline">
      {v.workOrder.workOrderNumber}
    </Link>
  )
}

/**
 * A session's random compliance-check history (CLAUDE.md §28) - collapsed to a one-line summary
 * by default, expandable to the full timeline. CANCELLED audits (still-pending ones a checkout
 * wiped out) are left out entirely - they're not a signal about anything, just noise. Unlike the
 * technician's own audit-check page, managers see the real match/mismatch verdict here - that
 * distinction (not concealment, just not confronting someone with it on their own screen) is the
 * same one the check-in widget already draws for location flags.
 */
function ComplianceChecks({ v }: { v: SiteAttendanceWithEmployee }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const relevant = v.audits.filter((a) => a.status !== 'CANCELLED')
  if (relevant.length === 0) return <span className="text-ink-400">{t.ops.team.checksNone}</span>

  const strikes = relevant.filter((a) => a.status === 'MISSED' || (a.status === 'CONFIRMED' && a.match === 'MISMATCH')).length

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 text-xs font-semibold hover:underline ${strikes > 0 ? 'text-amber-400' : 'text-ink-300'}`}
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {t.ops.team.checksSummary(relevant.length, strikes)}
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1 border-l border-ink-700 pl-3">
          {relevant.map((a) => (
            <li key={a.id} className="text-xs text-ink-400">
              {formatTime(a.scheduledAt)}
              {' — '}
              {a.status === 'PENDING' && t.ops.team.checkPending}
              {a.status === 'SKIPPED' && t.ops.team.checkSkipped}
              {a.status === 'MISSED' && <span className="font-medium text-amber-400">{t.ops.team.checkMissed}</span>}
              {a.status === 'CONFIRMED' &&
                (a.lat && a.lng ? (
                  <>
                    <a
                      href={mapLink(a.lat, a.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className={`hover:underline ${a.match === 'MISMATCH' ? 'font-medium text-amber-400' : 'text-cyan-accent'}`}
                      title={`${a.lat}, ${a.lng}`}
                    >
                      {a.match === 'MISMATCH' ? t.ops.team.checkMismatch(a.distanceMeters ?? 0) : t.ops.team.checkMatched}
                    </a>
                    {a.place && ` · ${a.place}`}
                  </>
                ) : (
                  t.ops.team.checkMatched
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year!, mon! - 1 + delta, 1))
  return next.toISOString().slice(0, 7)
}

/** First and last day of a "YYYY-MM" month, as "YYYY-MM-DD" - the PDF export takes a day range,
 * not a month string, so this bridges the two view modes to the same request shape. */
function monthDayRange(month: string): { from: string; to: string } {
  const [year, mon] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year!, mon!, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatMonth(month: string): string {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Weeks run Monday to Sunday. Returns the Monday of the week containing `date`, as "YYYY-MM-DD". */
function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = d.getUTCDay() // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - (weekday === 0 ? 6 : weekday - 1))
  return d.toISOString().slice(0, 10)
}

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDayShort(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function formatWeek(weekStart: string): string {
  return `${formatDayShort(weekStart)} – ${formatDayShort(addDays(weekStart, 6))}`
}

/** Past this, an open session is almost certainly a forgotten check-out rather than a long shift. */
const STALE_SESSION_HOURS = 14

function openForHours(v: SiteAttendanceWithEmployee): number {
  return (Date.now() - new Date(v.checkInAt).getTime()) / 3_600_000
}

/** "YYYY-MM-DDTHH:MM" in local time, the value <input type="datetime-local"> expects. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Elapsed time on site, blank while a session is still open. */
function hoursOnSite(v: SiteAttendanceWithEmployee): string {
  if (!v.checkOutAt) return ''
  const hours = (new Date(v.checkOutAt).getTime() - new Date(v.checkInAt).getTime()) / 3_600_000
  return hours.toFixed(2)
}

function TeamAttendancePage() {
  const t = useT()
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, ATTENDANCE_VIEW_ROLES)
  const employees = useEmployees()
  const toast = useToast()

  const [month, setMonth] = useState(currentMonth())
  const [period, setPeriod] = useState<'month' | 'week'>('month')
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [includePast, setIncludePast] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [current, setCurrent] = useState<SiteAttendanceWithEmployee[]>([])
  const [history, setHistory] = useState<SiteAttendanceWithEmployee[]>([])
  const [summary, setSummary] = useState<TechnicianAttendanceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [closing, setClosing] = useState<SiteAttendanceWithEmployee | null>(null)
  const [closeAt, setCloseAt] = useState('')
  const [closeNote, setCloseNote] = useState('')
  const [closeError, setCloseError] = useState<string | null>(null)
  const [submittingClose, setSubmittingClose] = useState(false)

  // Default the picker to now, but the manager is expected to correct it - "now" is the wrong
  // answer for a session that has been sitting open since last week.
  useEffect(() => {
    if (!closing) return
    setCloseAt(toLocalInputValue(new Date()))
    setCloseNote('')
    setCloseError(null)
  }, [closing])

  async function handleClose() {
    if (!closing) return
    setSubmittingClose(true)
    setCloseError(null)
    try {
      await api.closeSiteAttendance(closing.id, {
        checkOutAt: closeAt ? new Date(closeAt).toISOString() : undefined,
        note: closeNote || undefined,
      })
      toast.success(t.ops.team.sessionClosed)
      setClosing(null)
      reload()
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : t.ops.team.closeFailed)
    } finally {
      setSubmittingClose(false)
    }
  }

  function reload() {
    if (!canAccess) return
    setLoading(true)
    api
      .listTeamAttendance(
        period === 'week'
          ? { from: weekStart, to: addDays(weekStart, 6), employeeId: employeeFilter || undefined, includePast }
          : { month, employeeId: employeeFilter || undefined, includePast },
      )
      .then(({ current, history, summary }) => {
        setCurrent(current)
        setHistory(history)
        setSummary(summary)
      })
      .catch((err) => setError(err instanceof Error ? err.message : t.ops.team.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [canAccess, period, month, weekStart, employeeFilter, includePast]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * CSV rather than a real .xlsx: it opens straight in Excel, and the app already exports Work
   * Orders and Intervention Reports this way. A true .xlsx would mean pulling in a spreadsheet
   * library for formatting we have not been asked for.
   *
   * Exports whatever period is on screen, so "end of the week" is: switch to Week, then Export.
   * Both the stated time and the recorded one are included side by side - the sheet should carry
   * the same distinction the app does, not collapse it into a single number.
   */
  function exportCsv() {
    const label = period === 'week' ? `${weekStart}_to_${addDays(weekStart, 6)}` : month
    downloadCsv(
      `attendance-${label}`,
      [
        { header: 'Date', accessor: (v: SiteAttendanceWithEmployee) => v.checkInAt.slice(0, 10) },
        {
          header: 'Technician',
          accessor: (v: SiteAttendanceWithEmployee) => `${v.employee?.firstName ?? ''} ${v.employee?.lastName ?? ''}`.trim(),
        },
        { header: 'Work Order', accessor: (v: SiteAttendanceWithEmployee) => v.workOrder?.workOrderNumber ?? '' },
        { header: 'Time In (stated)', accessor: (v: SiteAttendanceWithEmployee) => v.checkInDeclaredTime ?? '' },
        { header: 'Check-In Recorded', accessor: (v: SiteAttendanceWithEmployee) => formatTime(v.checkInAt) },
        { header: 'Check-In Site', accessor: (v: SiteAttendanceWithEmployee) => v.checkInSite ?? '' },
        { header: 'Check-In Location', accessor: (v: SiteAttendanceWithEmployee) => v.checkInNote ?? '' },
        { header: 'Time Out (stated)', accessor: (v: SiteAttendanceWithEmployee) => v.checkOutDeclaredTime ?? '' },
        {
          header: 'Check-Out Recorded',
          accessor: (v: SiteAttendanceWithEmployee) => (v.checkOutAt ? formatTime(v.checkOutAt) : ''),
        },
        { header: 'Check-Out Site', accessor: (v: SiteAttendanceWithEmployee) => v.checkOutSite ?? '' },
        { header: 'Check-Out Location', accessor: (v: SiteAttendanceWithEmployee) => v.checkOutNote ?? '' },
        { header: 'Hours On Site', accessor: (v: SiteAttendanceWithEmployee) => hoursOnSite(v) },
        {
          header: 'Transport (MUR)',
          accessor: (v: SiteAttendanceWithEmployee) =>
            totalTransportCost(v) > 0 ? totalTransportCost(v).toFixed(2) : '',
        },
        {
          header: 'Location Flag',
          accessor: (v: SiteAttendanceWithEmployee) =>
            [
              locationMismatchLabel(v.checkInLocationMatch, v.checkInLocationDistanceMeters),
              locationMismatchLabel(v.checkOutLocationMatch, v.checkOutLocationDistanceMeters),
            ]
              .filter(Boolean)
              .join('; '),
        },
        {
          header: 'Time Flag',
          accessor: (v: SiteAttendanceWithEmployee) =>
            [
              statedTimeGapLabel(v.checkInDeclaredTime, v.checkInAt),
              statedTimeGapLabel(v.checkOutDeclaredTime, v.checkOutAt),
            ]
              .filter(Boolean)
              .join('; '),
        },
      ],
      history,
    )
  }

  /** The same period on screen, as a real PDF - the register's server-side generator
   * (`GET /api/site-attendance/report/pdf`) already existed with no UI ever calling it. */
  async function exportPdf() {
    const { from, to } = period === 'week' ? { from: weekStart, to: addDays(weekStart, 6) } : monthDayRange(month)
    setPdfDownloading(true)
    try {
      await api.downloadPdf(api.staffAttendanceReportPdfUrl(from, to, includePast), `team-attendance-${from}-to-${to}.pdf`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myAttendance.downloadFailed)
    } finally {
      setPdfDownloading(false)
    }
  }

  /** What the summary and empty states call the period on screen - a week or a month. */
  const periodLabel = period === 'week' ? `${formatWeek(weekStart)} ${weekStart.slice(0, 4)}` : formatMonth(month)

  const groupedByDay = useMemo(() => {
    const map = new Map<string, SiteAttendanceWithEmployee[]>()
    for (const v of history) {
      const day = v.checkInAt.slice(0, 10)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(v)
    }
    return Array.from(map.entries())
  }, [history])

  // Stated-vs-recorded time-gap counts per technician, computed from the same rows the register
  // renders (client-side, so the comparison uses the browser's Mauritius wall clock rather than
  // the server's UTC). Feeds the "Time Flags" column of the summary alongside the server's
  // location-flag count.
  const timeGapCountByEmployee = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of history) {
      if (hasStatedTimeGap(v)) map.set(v.employeeId, (map.get(v.employeeId) ?? 0) + 1)
    }
    return map
  }, [history])

  if (!canAccess) {
    return <EmptyState icon={Lock} message={t.shared.restrictedToOps} />
  }

  if (error) return <EmptyState icon={MapPin} message={error} />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">{t.ops.team.title}</h1>
        <p className="mt-1 text-sm text-ink-300">{t.ops.team.subtitle}</p>
      </div>

      <Panel title={t.ops.team.currentlyIn}>
        {loading ? (
          <TableSkeleton rows={3} cols={2} />
        ) : current.length === 0 ? (
          <p className="text-sm text-ink-400">{t.shared.nobodyCheckedIn}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {current.map((v) => {
              const latest = v.verifications[0] ?? null
              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg bg-ink-800 px-4 py-2.5"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-ink-100">
                      {v.employee?.firstName} {v.employee?.lastName}
                      {v.employee?.position && <span className="text-ink-400"> · {v.employee.position}</span>}
                      {v.workOrder && (
                        <>
                          <span className="text-ink-600">·</span>
                          <WorkOrderLink v={v} />
                        </>
                      )}
                      {v.workOrder?.siteLat && v.workOrder?.siteLng && (
                        <Badge tone={siteStatusTone(latest?.status ?? 'UNVERIFIED')}>
                          {enumLabel(t.labels.siteStatus, latest?.status ?? 'UNVERIFIED')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-ink-400">
                      {t.ops.team.since(new Date(v.checkInAt).toLocaleString())}
                      {v.checkInPlace && <span title={`${v.checkInLat}, ${v.checkInLng}`}> · {v.checkInPlace}</span>}
                      {v.checkInSite && <span> · {v.checkInSite}</span>}
                      {v.checkInNote && <span> · {v.checkInNote}</span>}
                      {openForHours(v) >= STALE_SESSION_HOURS && (
                        <span className="ml-2 font-medium text-amber-400">
                          {Math.floor(openForHours(v) / 24) >= 1
                            ? t.ops.team.openDays(Math.floor(openForHours(v) / 24))
                            : t.ops.team.openHours(Math.round(openForHours(v)))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={mapLink(v.checkInLat, v.checkInLng)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-cyan-accent hover:underline"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {t.ops.team.viewLocation}
                    </a>
                    <button
                      type="button"
                      onClick={() => setClosing(v)}
                      className="text-xs text-ink-400 hover:text-amber-400"
                    >
                      {t.ops.team.closeSession}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title={t.ops.team.summary} icon={Users}>
        <p className="mb-4 text-sm text-ink-300">{t.ops.team.summaryNote(periodLabel)}</p>
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : summary.length === 0 ? (
          <p className="text-sm text-ink-400">{t.ops.team.noCheckIns(periodLabel)}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-ink-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-2 font-semibold">{t.shared.technicianCol}</th>
                  <th className="px-3 py-2 font-semibold">{t.ops.team.daysPresent}</th>
                  <th className="px-3 py-2 font-semibold">{t.ops.team.checkInsCol}</th>
                  <th className="px-3 py-2 font-semibold">{t.ops.team.hoursOnSite}</th>
                  <th className="px-3 py-2 font-semibold">{t.shared.transportCol}</th>
                  <th className="px-3 py-2 font-semibold">{t.ops.team.locationFlags}</th>
                  <th className="px-3 py-2 font-semibold">{t.ops.team.timeFlags}</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.employee.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-2 text-ink-100">
                      {s.employee.firstName} {s.employee.lastName}
                      {s.employee.position && <span className="text-ink-400"> · {s.employee.position}</span>}
                    </td>
                    <td className="px-3 py-2 text-ink-300">{s.daysPresent}</td>
                    <td className="px-3 py-2 text-ink-300">{s.totalCheckIns}</td>
                    <td className="px-3 py-2 text-ink-300">{s.totalHoursOnSite}</td>
                    <td className="px-3 py-2 text-ink-300">
                      {s.totalTransportCost > 0 ? formatMoney(s.totalTransportCost) : <span className="text-ink-400">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {s.locationMismatchCount > 0 ? (
                        <span className="font-medium text-amber-400">{s.locationMismatchCount}</span>
                      ) : (
                        <span className="text-ink-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {(timeGapCountByEmployee.get(s.employee.id) ?? 0) > 0 ? (
                        <span className="font-medium text-amber-400">{timeGapCountByEmployee.get(s.employee.id)}</span>
                      ) : (
                        <span className="text-ink-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={t.ops.team.register}>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-md border border-ink-600">
            {(['month', 'week'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm transition ${
                  period === p ? 'bg-cyan-accent text-ink-950' : 'text-ink-300 hover:text-ink-100'
                }`}
              >
                {p === 'week' ? t.ops.team.week : t.ops.team.month}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              period === 'week' ? setWeekStart((w) => addDays(w, -7)) : setMonth((m) => shiftMonth(m, -1))
            }
            aria-label={period === 'week' ? t.ops.team.previousWeek : t.ops.team.previousMonth}
            className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-sm font-medium text-ink-100">
            {period === 'week' ? formatWeek(weekStart) : formatMonth(month)}
          </span>
          <button
            type="button"
            onClick={() =>
              period === 'week' ? setWeekStart((w) => addDays(w, 7)) : setMonth((m) => shiftMonth(m, 1))
            }
            aria-label={period === 'week' ? t.ops.team.nextWeek : t.ops.team.nextMonth}
            className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {period === 'week' && weekStart !== mondayOf(new Date()) && (
            <button
              type="button"
              onClick={() => setWeekStart(mondayOf(new Date()))}
              className="text-sm text-ink-300 hover:text-ink-100"
            >
              {t.ops.team.thisWeek}
            </button>
          )}
          {period === 'month' && month !== currentMonth() && (
            <button
              type="button"
              onClick={() => setMonth(currentMonth())}
              className="text-sm text-ink-300 hover:text-ink-100"
            >
              {t.ops.team.thisMonth}
            </button>
          )}
          <button
            type="button"
            onClick={exportCsv}
            disabled={history.length === 0}
            className={`${secondaryButtonClass} disabled:opacity-50`}
          >
            <Download className="h-4 w-4" />
            {period === 'week' ? t.ops.team.exportWeek : t.ops.team.exportMonth}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={history.length === 0 || pdfDownloading}
            className={`${secondaryButtonClass} disabled:opacity-50`}
          >
            <Download className="h-4 w-4" />
            {t.ops.team.exportPdf}
          </button>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-300">
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e) => setIncludePast(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-600 bg-ink-950 text-cyan-accent focus:ring-cyan-accent/40"
            />
            {t.ops.team.includePastEmployees}
          </label>
          <div className="ml-auto flex flex-col gap-1">
            <label className={labelClass}>{t.shared.technicianCol}</label>
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={inputClass}>
              <option value="">{t.ops.team.allTechnicians}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </div>
          {employeeFilter && (
            <button
              type="button"
              onClick={() => setEmployeeFilter('')}
              className="text-xs font-semibold text-ink-400 hover:text-ink-100"
            >
              {t.ops.team.clearFilter}
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : groupedByDay.length === 0 ? (
          <p className="text-sm text-ink-400">{t.ops.team.noCheckIns(periodLabel)}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {groupedByDay.map(([day, entries]) => (
              <div key={day}>
                <h3 className="mb-2 text-xs font-semibold tracking-widest text-ink-400">
                  {t.ops.team.dayHeading(formatDay(day), entries.length)}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-ink-800">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                        <th className="px-3 py-2 font-semibold">{t.shared.technicianCol}</th>
                        <th className="px-3 py-2 font-semibold">{t.ops.team.workOrderCol}</th>
                        <th className="px-3 py-2 font-semibold">{t.ops.team.checkInCol}</th>
                        <th className="px-3 py-2 font-semibold">{t.ops.team.checkOutCol}</th>
                        <th className="px-3 py-2 font-semibold">{t.shared.transportCol}</th>
                        <th className="px-3 py-2 font-semibold">{t.ops.team.checksCol}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((v) => (
                        <tr
                          key={v.id}
                          className={`border-b border-ink-800 last:border-0 ${
                            hasLocationMismatch(v) || hasStatedTimeGap(v) ? 'bg-amber-400/5' : ''
                          }`}
                        >
                          <td className="px-3 py-2 text-ink-100">
                            {v.employee?.firstName} {v.employee?.lastName}
                          </td>
                          <td className="px-3 py-2 text-ink-300">
                            <WorkOrderLink v={v} />
                          </td>
                          <td className="px-3 py-2 text-ink-300">
                            <a
                              href={mapLink(v.checkInLat, v.checkInLng)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-cyan-accent hover:underline"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              {formatTime(v.checkInAt)}
                              {statedTimeSuffix(v.checkInDeclaredTime, v.checkInAt)}
                              {v.checkInSite && <span> · {v.checkInSite}</span>}
                      {v.checkInNote && <span> · {v.checkInNote}</span>}
                            </a>
                            {v.checkInPlace && (
                              <span className="mt-0.5 block text-[11px] text-ink-400" title={`${v.checkInLat}, ${v.checkInLng}`}>
                                {v.checkInPlace}
                              </span>
                            )}
                            {locationMismatchLabel(v.checkInLocationMatch, v.checkInLocationDistanceMeters) && (
                              <span className="mt-0.5 block text-[11px] font-medium text-amber-400">
                                ⚠ {locationMismatchLabel(v.checkInLocationMatch, v.checkInLocationDistanceMeters)}
                              </span>
                            )}
                            {statedTimeGapLabel(v.checkInDeclaredTime, v.checkInAt) && (
                              <span className="mt-0.5 block text-[11px] font-medium text-amber-400">
                                ⚠ {t.ops.team.statedTimeOffBy(statedTimeGapLabel(v.checkInDeclaredTime, v.checkInAt)!)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-ink-300">
                            {v.checkOutAt && v.checkOutLat && v.checkOutLng ? (
                              <a
                                href={mapLink(v.checkOutLat, v.checkOutLng)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-cyan-accent hover:underline"
                              >
                                <MapPin className="h-3.5 w-3.5" />
                                {formatTime(v.checkOutAt)}
                                {statedTimeSuffix(v.checkOutDeclaredTime, v.checkOutAt)}
                                {v.checkOutSite && <span> · {v.checkOutSite}</span>}
                                {v.checkOutNote && <span> · {v.checkOutNote}</span>}
                              </a>
                            ) : (
                              <span className="text-ink-400">{t.ops.team.stillCheckedIn}</span>
                            )}
                            {v.checkOutPlace && (
                              <span className="mt-0.5 block text-[11px] text-ink-400" title={`${v.checkOutLat}, ${v.checkOutLng}`}>
                                {v.checkOutPlace}
                              </span>
                            )}
                            {v.checkOutByManager && (
                              <span className="mt-0.5 block text-[11px] text-ink-400">{t.ops.team.closedByManagement}</span>
                            )}
                            {locationMismatchLabel(v.checkOutLocationMatch, v.checkOutLocationDistanceMeters) && (
                              <span className="mt-0.5 block text-[11px] font-medium text-amber-400">
                                ⚠ {locationMismatchLabel(v.checkOutLocationMatch, v.checkOutLocationDistanceMeters)}
                              </span>
                            )}
                            {statedTimeGapLabel(v.checkOutDeclaredTime, v.checkOutAt) && (
                              <span className="mt-0.5 block text-[11px] font-medium text-amber-400">
                                ⚠ {t.ops.team.statedTimeOffBy(statedTimeGapLabel(v.checkOutDeclaredTime, v.checkOutAt)!)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-ink-300">
                            {totalTransportCost(v) > 0 ? formatMoney(totalTransportCost(v)) : <span className="text-ink-400">—</span>}
                            {(v.checkInTransportNote || v.checkOutTransportNote) && (
                              <span className="mt-0.5 block text-xs text-ink-400">
                                {v.checkInTransportNote || v.checkOutTransportNote}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 align-top text-ink-300">
                            <ComplianceChecks v={v} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {closing && (
        <Modal title={t.ops.team.closeTitle} onClose={() => setClosing(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              {t.ops.team.closeIntro(
                `${closing.employee?.firstName ?? ''} ${closing.employee?.lastName ?? ''}`.trim(),
                new Date(closing.checkInAt).toLocaleString(),
              )}
            </p>

            <div className="flex flex-col gap-1">
              <label htmlFor="close-at" className={labelClass}>
                {t.ops.team.checkedOutAt}
              </label>
              <input
                id="close-at"
                type="datetime-local"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="close-note" className={labelClass}>
                {t.ops.team.noteOptional}
              </label>
              <input
                id="close-note"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                placeholder={t.ops.team.notePlaceholder}
                maxLength={200}
                className={inputClass}
              />
            </div>

            <p className="text-xs text-ink-400">{t.ops.team.closeDisclaimer}</p>

            {closeError && <p className="text-sm text-red-400">{closeError}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setClosing(null)} className={secondaryButtonClass}>
                {t.common.cancel}
              </button>
              <button type="button" onClick={handleClose} disabled={submittingClose} className={primaryButtonClass}>
                {submittingClose ? t.ops.team.closing : t.ops.team.closeSession}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default TeamAttendancePage
