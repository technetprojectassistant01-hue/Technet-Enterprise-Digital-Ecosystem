import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import * as api from '../lib/api'
import type { OvertimeItem, SiteAttendanceWithEmployee } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from './ui'
import { clockOf, locationMismatchLabel } from '../lib/siteAttendance'
import { computeDayFlags } from '../lib/workSchedule'
import { mapLink } from '../lib/geolocation'
import { useT } from '../i18n'

/** Local calendar day of a timestamp, "YYYY-MM-DD" — matches the server's Mauritius day. */
function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * The admin landing page's attendance table. An admin administers the website rather than visiting
 * sites, so they get everybody else's register instead of a check-in card of their own.
 *
 * Each row is one visit and shows both halves side by side: what the member of staff typed (time
 * and location, on both legs) against what the app actually recorded (server timestamp and GPS
 * fix). Keeping them adjacent is the whole point — a match is unremarkable, a gap is what a
 * manager needs to see (CLAUDE.md §7a).
 *
 * Late is worked out here from the standard hours (lib/workSchedule.ts), per employee so one
 * person's day can't be folded into another's. Overtime comes from the server instead
 * (GET /api/overtime), because that is the figure HR's approval is recorded against — approving
 * here writes the same OvertimeDecision the Workforce → Overtime screen does.
 */
function StaffAttendancePanel() {
  const t = useT()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [visits, setVisits] = useState<SiteAttendanceWithEmployee[]>([])
  const [overtime, setOvertime] = useState<OvertimeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deciding, setDeciding] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const month = monthKey(cursor)
  const isCurrentMonth = month === monthKey(new Date())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([api.listTeamAttendance({ month }), api.listOvertime(month)])
      .then(([attendance, ot]) => {
        if (cancelled) return
        setVisits(attendance.history)
        setOvertime(ot.items)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t.staffAttendance.loadFailed)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [month, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(item: OvertimeItem, approve: boolean) {
    const key = `${item.employeeId}|${item.date}`
    setDeciding(key)
    try {
      await api.decideOvertime({ employeeId: item.employeeId, date: item.date, approve })
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.staffAttendance.decideFailed)
    } finally {
      setDeciding(null)
    }
  }

  async function undo(item: OvertimeItem) {
    const key = `${item.employeeId}|${item.date}`
    setDeciding(key)
    try {
      await api.undoOvertimeDecision(item.employeeId, item.date)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.staffAttendance.decideFailed)
    } finally {
      setDeciding(null)
    }
  }

  function span(minutes: number): string {
    const rounded = Math.max(0, Math.round(minutes))
    const h = Math.floor(rounded / 60)
    return h > 0 ? t.shared.hoursMinutes(h, rounded % 60) : t.shared.minutesOnly(rounded)
  }

  /** The time the person typed, falling back to the clock time the app recorded. */
  function entered(declared: string | null, recordedIso: string | null): string {
    if (declared) return declared
    return recordedIso ? clockOf(new Date(recordedIso)) : '—'
  }

  // Late is per person per day, so the flags are computed one employee at a time — feeding every
  // employee's visits in together would merge unrelated people's days.
  const lateByVisit = new Map<string, number>()
  {
    const byEmployee = new Map<string, SiteAttendanceWithEmployee[]>()
    for (const v of visits) {
      byEmployee.set(v.employeeId, [...(byEmployee.get(v.employeeId) ?? []), v])
    }
    for (const list of byEmployee.values()) {
      for (const [id, minutes] of computeDayFlags(list).late) lateByVisit.set(id, minutes)
    }
  }

  // Overtime belongs to an employee's whole day, so its cell hangs off that day's last check-in.
  const overtimeByKey = new Map(overtime.map((o) => [`${o.employeeId}|${o.date}`, o]))
  const overtimeVisitIds = new Map<string, OvertimeItem>()
  {
    const lastOfDay = new Map<string, SiteAttendanceWithEmployee>()
    for (const v of visits) {
      const key = `${v.employeeId}|${dayKey(v.checkInAt)}`
      const current = lastOfDay.get(key)
      if (!current || new Date(v.checkInAt) > new Date(current.checkInAt)) lastOfDay.set(key, v)
    }
    for (const [key, v] of lastOfDay) {
      const item = overtimeByKey.get(key)
      if (item && (item.minutes > 0 || item.decision)) overtimeVisitIds.set(v.id, item)
    }
  }

  // Newest day first, then alphabetically by person, then in clock order within their day.
  const rows = [...visits].sort((a, b) => {
    const dayDiff = dayKey(b.checkInAt).localeCompare(dayKey(a.checkInAt))
    if (dayDiff !== 0) return dayDiff
    const nameDiff = `${a.employee?.firstName} ${a.employee?.lastName}`.localeCompare(
      `${b.employee?.firstName} ${b.employee?.lastName}`,
    )
    if (nameDiff !== 0) return nameDiff
    return new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime()
  })

  const people = new Set(visits.map((v) => v.employeeId)).size
  const days = new Set(visits.map((v) => dayKey(v.checkInAt))).size
  const stillIn = visits.filter((v) => !v.checkOutAt).length
  const pendingOvertime = overtime.filter((o) => o.status === 'PENDING' && o.minutes > 0).length

  const monthLabel = `${t.shared.months[cursor.getMonth()]} ${cursor.getFullYear()}`
  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })

  const monthPicker = (
    <div className="flex items-center gap-1">
      <Link
        to="/dashboard/operations/team-attendance"
        className="mr-2 hidden text-xs font-semibold text-cyan-accent hover:underline sm:inline"
      >
        {t.staffAttendance.viewFull}
      </Link>
      <button
        type="button"
        onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
        aria-label={t.myAttendance.previousMonth}
        className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[8.5rem] text-center text-sm font-medium text-ink-100">{monthLabel}</span>
      <button
        type="button"
        onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
        disabled={isCurrentMonth}
        aria-label={t.myAttendance.nextMonth}
        className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )

  /** The GPS the app captured, as a map link — there is no embedded map anywhere (CLAUDE.md §9). */
  function gpsCell(lat: string | null, lng: string | null, mismatch: string | null) {
    if (!lat || !lng) return <span className="text-ink-500">{t.staffAttendance.noGps}</span>
    return (
      <div className="flex flex-col gap-1">
        <a
          href={mapLink(lat, lng)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-cyan-accent hover:underline"
        >
          {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
        </a>
        {mismatch && <Badge tone="warning">{mismatch}</Badge>}
      </div>
    )
  }

  return (
    <Panel title={t.staffAttendance.title} icon={Users} action={monthPicker}>
      {!loading && !error && visits.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t.staffAttendance.colStaff, value: t.staffAttendance.peopleThisMonth(people) },
            { label: t.staffAttendance.statDays, value: String(days) },
            { label: t.staffAttendance.statLate, value: String(lateByVisit.size) },
            { label: t.staffAttendance.statOvertimePending, value: String(pendingOvertime) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-ink-800 bg-ink-950 px-3 py-2.5">
              <div className="text-[11px] font-semibold tracking-widest text-ink-400">{s.label}</div>
              <div className="mt-1 text-lg font-semibold text-ink-100">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {stillIn > 0 && !loading && (
        <div className="mb-3">
          <Badge tone="accent">{t.staffAttendance.onSiteNow(stillIn)}</Badge>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {loading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} message={t.staffAttendance.empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[68rem] text-left text-sm">
            <thead>
              <tr className="text-[10px] tracking-widest text-ink-500">
                <th className="px-3 pb-1" colSpan={2} />
                <th className="border-l border-ink-800 px-3 pb-1 font-semibold" colSpan={4}>
                  {t.staffAttendance.groupEntered}
                </th>
                <th className="border-l border-ink-800 px-3 pb-1 font-semibold" colSpan={4}>
                  {t.staffAttendance.groupSystem}
                </th>
                <th className="border-l border-ink-800 px-3 pb-1" colSpan={2} />
              </tr>
              <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                <th className="px-3 py-2 font-semibold">{t.staffAttendance.colStaff}</th>
                <th className="px-3 py-2 font-semibold">{t.staffAttendance.colDate}</th>
                <th className="border-l border-ink-800 px-3 py-2 font-semibold">{t.staffAttendance.colIn}</th>
                <th className="px-3 py-2 font-semibold">{t.staffAttendance.colOut}</th>
                <th className="px-3 py-2 font-semibold">{t.staffAttendance.colLocationIn}</th>
                <th className="px-3 py-2 font-semibold">{t.staffAttendance.colLocationOut}</th>
                <th className="border-l border-ink-800 px-3 py-2 font-semibold">{t.staffAttendance.colIn}</th>
                <th className="px-3 py-2 font-semibold">{t.staffAttendance.colOut}</th>
                <th className="px-3 py-2 font-semibold">{t.staffAttendance.colGpsIn}</th>
                <th className="px-3 py-2 font-semibold">{t.staffAttendance.colGpsOut}</th>
                <th className="border-l border-ink-800 px-3 py-2 font-semibold">{t.staffAttendance.colFlags}</th>
                <th className="px-3 py-2 font-semibold">{t.staffAttendance.colOvertime}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const lateMinutes = lateByVisit.get(v.id)
                const ot = overtimeVisitIds.get(v.id)
                const busy = ot ? deciding === `${ot.employeeId}|${ot.date}` : false
                return (
                  <tr key={v.id} className="border-b border-ink-800 align-top last:border-0">
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-ink-100">
                      {v.employee ? `${v.employee.firstName} ${v.employee.lastName}` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-300">
                      {dateFormat.format(new Date(v.checkInAt))}
                    </td>

                    <td className="whitespace-nowrap border-l border-ink-800 px-3 py-3 font-mono text-ink-100">
                      {entered(v.checkInDeclaredTime, v.checkInAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-ink-100">
                      {v.checkOutAt ? (
                        entered(v.checkOutDeclaredTime, v.checkOutAt)
                      ) : (
                        <span className="font-sans text-xs font-semibold text-cyan-accent">
                          {t.staffAttendance.stillIn}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      {[v.checkInSite, v.checkInNote].filter(Boolean).join(' — ') || t.staffAttendance.noSite}
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      {[v.checkOutSite, v.checkOutNote].filter(Boolean).join(' — ') || t.staffAttendance.noSite}
                    </td>

                    <td className="whitespace-nowrap border-l border-ink-800 px-3 py-3 font-mono text-ink-300">
                      {clockOf(new Date(v.checkInAt))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-ink-300">
                      {v.checkOutAt ? clockOf(new Date(v.checkOutAt)) : '—'}
                      {v.checkOutByManager && (
                        <div className="mt-1 font-sans text-[11px] text-ink-400">
                          {t.staffAttendance.closedByManager}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {gpsCell(
                        v.checkInLat,
                        v.checkInLng,
                        locationMismatchLabel(v.checkInLocationMatch, v.checkInLocationDistanceMeters),
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {gpsCell(
                        v.checkOutLat,
                        v.checkOutLng,
                        locationMismatchLabel(v.checkOutLocationMatch, v.checkOutLocationDistanceMeters),
                      )}
                    </td>

                    <td className="border-l border-ink-800 px-3 py-3">
                      <div className="flex flex-col gap-1">
                        {lateMinutes !== undefined && (
                          <Badge tone="warning">{t.myAttendance.lateBy(span(lateMinutes))}</Badge>
                        )}
                        {ot && ot.minutes > 0 && (
                          <Badge tone="accent">{t.myAttendance.overtimeBy(span(ot.minutes))}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {!ot ? (
                        <span className="text-ink-500">—</span>
                      ) : ot.status === 'PENDING' ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[11px] text-ink-400">{t.staffAttendance.pending}</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => decide(ot, true)}
                              className="rounded-md bg-cyan-accent px-2.5 py-1 text-xs font-semibold text-ink-950 transition hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {t.staffAttendance.approve}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => decide(ot, false)}
                              className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {t.staffAttendance.reject}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start gap-1.5">
                          <Badge tone={ot.status === 'APPROVED' ? 'success' : 'danger'}>
                            {ot.status === 'APPROVED' ? t.staffAttendance.approved : t.staffAttendance.rejected}
                          </Badge>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => undo(ot)}
                            className="text-xs text-ink-400 hover:text-cyan-accent disabled:opacity-50"
                          >
                            {t.staffAttendance.undo}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

export default StaffAttendancePanel
