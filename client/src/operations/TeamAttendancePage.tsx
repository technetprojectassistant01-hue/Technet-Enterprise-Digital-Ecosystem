import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, MapPin, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import * as api from '../lib/api'
import type { SiteAttendanceWithEmployee, TechnicianAttendanceSummary } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES } from '../lib/permissions'
import { mapLink } from '../lib/geolocation'
import { useEmployees } from '../erp/useEmployees'

const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function siteStatusTone(status: 'ON_SITE' | 'OUTSIDE_SITE' | 'UNVERIFIED') {
  if (status === 'ON_SITE') return 'success' as const
  if (status === 'OUTSIDE_SITE') return 'warning' as const
  return 'neutral' as const
}

function WorkOrderLink({ v }: { v: SiteAttendanceWithEmployee }) {
  if (!v.workOrder) return <span className="text-ink-500">—</span>
  return (
    <Link to={`/dashboard/operations/work-orders/${v.workOrder.id}`} className="text-cyan-accent hover:underline">
      {v.workOrder.workOrderNumber}
    </Link>
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

function TeamAttendancePage() {
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, OPS_MANAGE_ROLES)
  const employees = useEmployees()

  const [month, setMonth] = useState(currentMonth())
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [current, setCurrent] = useState<SiteAttendanceWithEmployee[]>([])
  const [history, setHistory] = useState<SiteAttendanceWithEmployee[]>([])
  const [summary, setSummary] = useState<TechnicianAttendanceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canAccess) return
    setLoading(true)
    api
      .listTeamAttendance({ month, employeeId: employeeFilter || undefined })
      .then(({ current, history, summary }) => {
        setCurrent(current)
        setHistory(history)
        setSummary(summary)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load attendance'))
      .finally(() => setLoading(false))
  }, [canAccess, month, employeeFilter])

  const groupedByDay = useMemo(() => {
    const map = new Map<string, SiteAttendanceWithEmployee[]>()
    for (const v of history) {
      const day = v.checkInAt.slice(0, 10)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(v)
    }
    return Array.from(map.entries())
  }, [history])

  if (!canAccess) {
    return <EmptyState icon={Lock} message="This section is restricted to Operations management." />
  }

  if (error) return <EmptyState icon={MapPin} message={error} />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Team Attendance</h1>
        <p className="mt-1 text-sm text-ink-300">
          GPS-based daily check-in/out for field technicians, auto-linked to their current work order when they have one.
        </p>
      </div>

      <Panel title="Currently Checked In">
        {loading ? (
          <TableSkeleton rows={3} cols={2} />
        ) : current.length === 0 ? (
          <p className="text-sm text-ink-400">Nobody is currently checked in.</p>
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
                      {v.employee?.position && <span className="text-ink-500"> · {v.employee.position}</span>}
                      {v.workOrder && (
                        <>
                          <span className="text-ink-600">·</span>
                          <WorkOrderLink v={v} />
                        </>
                      )}
                      {v.workOrder?.siteLat && v.workOrder?.siteLng && (
                        <Badge tone={siteStatusTone(latest?.status ?? 'UNVERIFIED')}>
                          {latest ? latest.status.replace('_', ' ') : 'NOT YET VERIFIED'}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-ink-400">
                      Since {new Date(v.checkInAt).toLocaleString()}
                      {v.checkInNote && <span> · {v.checkInNote}</span>}
                    </div>
                  </div>
                  <a
                    href={mapLink(v.checkInLat, v.checkInLng)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-cyan-accent hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    View location
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title="Attendance Summary" icon={Users}>
        <p className="mb-4 text-sm text-ink-300">
          Per-technician totals for {formatMonth(month)}, including how often each check-in verified as on-site vs.
          outside the job site.
        </p>
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : summary.length === 0 ? (
          <p className="text-sm text-ink-400">No check-ins recorded for {formatMonth(month)}.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-ink-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-2 font-semibold">TECHNICIAN</th>
                  <th className="px-3 py-2 font-semibold">DAYS PRESENT</th>
                  <th className="px-3 py-2 font-semibold">CHECK-INS</th>
                  <th className="px-3 py-2 font-semibold">HOURS ON SITE</th>
                  <th className="px-3 py-2 font-semibold">ON-SITE VERIFIED</th>
                  <th className="px-3 py-2 font-semibold">OUTSIDE SITE</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.employee.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-2 text-ink-100">
                      {s.employee.firstName} {s.employee.lastName}
                      {s.employee.position && <span className="text-ink-500"> · {s.employee.position}</span>}
                    </td>
                    <td className="px-3 py-2 text-ink-300">{s.daysPresent}</td>
                    <td className="px-3 py-2 text-ink-300">{s.totalCheckIns}</td>
                    <td className="px-3 py-2 text-ink-300">{s.totalHoursOnSite}</td>
                    <td className="px-3 py-2 text-emerald-400">{s.onSiteCount}</td>
                    <td className="px-3 py-2">
                      {s.outsideSiteCount > 0 ? (
                        <span className="font-medium text-amber-400">{s.outsideSiteCount}</span>
                      ) : (
                        <span className="text-ink-500">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Attendance Register">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
            className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-sm font-medium text-ink-100">{formatMonth(month)}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Next month"
            className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {month !== currentMonth() && (
            <button
              type="button"
              onClick={() => setMonth(currentMonth())}
              className="text-sm text-ink-300 hover:text-ink-100"
            >
              This Month
            </button>
          )}
          <div className="ml-auto flex flex-col gap-1">
            <label className={labelClass}>TECHNICIAN</label>
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={inputClass}>
              <option value="">All technicians</option>
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
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : groupedByDay.length === 0 ? (
          <p className="text-sm text-ink-400">No check-ins recorded for {formatMonth(month)}.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {groupedByDay.map(([day, entries]) => (
              <div key={day}>
                <h3 className="mb-2 text-xs font-semibold tracking-widest text-ink-400">
                  {formatDay(day)} · {entries.length} check-in{entries.length === 1 ? '' : 's'}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-ink-800">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                        <th className="px-3 py-2 font-semibold">TECHNICIAN</th>
                        <th className="px-3 py-2 font-semibold">WORK ORDER</th>
                        <th className="px-3 py-2 font-semibold">CHECK-IN</th>
                        <th className="px-3 py-2 font-semibold">CHECK-OUT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((v) => (
                        <tr key={v.id} className="border-b border-ink-800 last:border-0">
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
                              {v.checkInNote && <span> · {v.checkInNote}</span>}
                            </a>
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
                                {v.checkOutNote && <span> · {v.checkOutNote}</span>}
                              </a>
                            ) : (
                              <span className="text-ink-500">Still checked in</span>
                            )}
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
    </div>
  )
}

export default TeamAttendancePage
