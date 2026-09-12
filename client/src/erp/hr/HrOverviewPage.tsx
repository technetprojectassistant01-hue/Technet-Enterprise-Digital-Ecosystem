import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, CalendarDays, BadgeCheck, ClipboardCheck, ArrowRight, Lock } from 'lucide-react'
import * as api from '../../lib/api'
import type { Certification, Employee, LeaveRequest } from '../../lib/api'
import { Panel, StatCard, Badge, EmptyState, TableSkeleton } from '../../dashboard/ui'
import { useAuth } from '../../context/AuthContext'
import { hasRole, HR_ROLES } from '../../lib/permissions'
import { leaveRequestStatusTone } from '../statusTones'
import { certificationState, certificationStateTone } from './certificationStatus'
import { enumLabel, navLabel, useT } from '../../i18n'

function formatDate(value: string | null, locale: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function HrOverviewPage() {
  const t = useT()
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, HR_ROLES)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [pending, setPending] = useState<LeaveRequest[]>([])
  const [onLeaveToday, setOnLeaveToday] = useState<LeaveRequest[]>([])
  const [expiring, setExpiring] = useState<Certification[]>([])
  const [expired, setExpired] = useState<Certification[]>([])
  const [attendance, setAttendance] = useState<{ recorded: number; headcount: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canAccess) {
      setLoading(false)
      return
    }
    // Bring ON_LEAVE flags in line with today's approved leave before reading counts.
    api
      .syncLeaveStatuses()
      .catch(() => undefined)
      .then(() =>
        Promise.all([
          api.listEmployees(),
          api.listLeaveRequests({ status: 'PENDING' }),
          api.getLeaveSummary(),
          api.listExpiringCertifications(),
          api.getAttendanceSummary(today()),
        ]),
      )
      .then((results) => {
        if (!results) return
        const [employeeResult, pendingResult, summary, certs, attendanceSummary] = results
        setEmployees(employeeResult.employees)
        setPending(pendingResult.requests)
        setOnLeaveToday(summary.onLeaveToday)
        setExpiring(certs.expiring)
        setExpired(certs.expired)
        setAttendance({ recorded: attendanceSummary.recorded, headcount: attendanceSummary.headcount })
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [canAccess])

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (!canAccess) return <EmptyState icon={Lock} message={t.shared.restrictedToHr} />

  const locale = t.shared.dateLocale
  const active = employees.filter((e) => e.employmentStatus !== 'TERMINATED').length
  const renewals = [...expired, ...expiring]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t.hr.overview.activeHeadcount}
          value={active}
          sub={t.hr.overview.recordsTotal(employees.length)}
          icon={Users}
        />
        <StatCard label={t.hr.overview.onLeaveToday} value={onLeaveToday.length} icon={CalendarDays} />
        <StatCard
          label={t.hr.overview.leaveAwaiting}
          value={pending.length}
          deltaTone="warning"
          delta={pending.length > 0 ? t.hr.overview.actionNeeded : undefined}
          icon={CalendarDays}
        />
        <StatCard
          label={t.hr.overview.certRenewals}
          value={renewals.length}
          sub={
            expired.length > 0 ? t.hr.overview.alreadyExpired(expired.length) : t.hr.overview.noneExpired
          }
          icon={BadgeCheck}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title={t.hr.overview.leaveAwaitingPanel}
          icon={CalendarDays}
          action={
            <Link
              to="/dashboard/erp/hr/leave"
              className="flex items-center gap-1 text-xs text-ink-300 hover:text-cyan-accent"
            >
              {t.hr.overview.openLeave} <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">{t.hr.overview.nothingWaiting}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {pending.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-ink-100">
                      {r.employee.firstName} {r.employee.lastName}
                    </div>
                    <div className="text-xs text-ink-400">
                      {r.leaveType.name} · {formatDate(r.startDate, locale)}
                      {r.startDate !== r.endDate ? ` → ${formatDate(r.endDate, locale)}` : ''} · {r.days}d
                    </div>
                  </div>
                  <Badge tone={leaveRequestStatusTone[r.status]}>{enumLabel(t.labels.leaveStatus, r.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={t.hr.overview.outOfOffice}
          icon={Users}
          action={
            <Link
              to="/dashboard/erp/hr/employees"
              className="flex items-center gap-1 text-xs text-ink-300 hover:text-cyan-accent"
            >
              {navLabel(t, 'Employees')} <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {onLeaveToday.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">{t.hr.overview.everyoneIn}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {onLeaveToday.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-100">
                    {r.employee.firstName} {r.employee.lastName}
                  </span>
                  <span className="text-xs text-ink-400">
                    {r.leaveType.name} · {t.hr.overview.backOn(formatDate(r.endDate, locale))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={t.hr.overview.certRenewalsPanel}
          icon={BadgeCheck}
          action={
            <Link
              to="/dashboard/erp/hr/certifications"
              className="flex items-center gap-1 text-xs text-ink-300 hover:text-cyan-accent"
            >
              {t.hr.overview.allCertifications} <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {renewals.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">{t.hr.overview.noneExpiring}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {renewals.slice(0, 6).map((c) => {
                const state = certificationState(c)
                return (
                  <li key={c.id} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-ink-100">{c.name}</div>
                      <div className="text-xs text-ink-400">
                        {c.employee.firstName} {c.employee.lastName} ·{' '}
                        {t.hr.overview.expiresOn(formatDate(c.expiryDate, locale))}
                      </div>
                    </div>
                    <Badge tone={certificationStateTone[state]}>
                      {enumLabel(t.labels.certificationState, state)}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title={t.hr.overview.attendanceToday}
          icon={ClipboardCheck}
          action={
            <Link
              to="/dashboard/workforce/attendance"
              className="flex items-center gap-1 text-xs text-ink-300 hover:text-cyan-accent"
            >
              {t.hr.overview.dailyRegisterLink} <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {!attendance || attendance.recorded === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">{t.hr.overview.attendanceNotRecorded}</p>
          ) : (
            <p className="py-6 text-center text-sm text-ink-300">
              <span className="text-2xl font-semibold text-ink-100">
                {attendance.recorded}/{attendance.headcount}
              </span>
              <br />
              {t.hr.overview.employeesRecorded}
            </p>
          )}
        </Panel>
      </div>
    </div>
  )
}

export default HrOverviewPage
