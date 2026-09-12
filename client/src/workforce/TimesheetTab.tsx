import { useCallback, useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import * as api from '../lib/api'
import type { Timesheet } from '../lib/api'
import { Panel, StatCard, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useEmployees } from '../erp/useEmployees'
import { attendanceStatusTone } from '../erp/statusTones'
import { inputClass } from './formStyles'
import { enumLabel, useT } from '../i18n'

function TimesheetTab() {
  const t = useT()
  const months = t.shared.months
  const employees = useEmployees()

  const now = new Date()
  const [employeeId, setEmployeeId] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [timesheet, setTimesheet] = useState<Timesheet | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default to the first employee once the picker has loaded.
  useEffect(() => {
    if (!employeeId && employees.length > 0) setEmployeeId(employees[0]!.id)
  }, [employees, employeeId])

  const load = useCallback(() => {
    if (!employeeId) return
    setLoading(true)
    setError(null)
    api
      .getTimesheet(employeeId, year, month)
      .then(setTimesheet)
      .catch((err) => setError(err instanceof Error ? err.message : t.workforce.timesheet.loadFailed))
      .finally(() => setLoading(false))
  }, [employeeId, year, month])

  useEffect(load, [load])

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className={`max-w-[16rem] ${inputClass}`}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName}
              </option>
            ))}
          </select>

          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className={`max-w-[10rem] ${inputClass}`}
          >
            {months.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={`max-w-[8rem] ${inputClass}`}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : !timesheet ? (
        <EmptyState icon={CalendarRange} message={t.workforce.timesheet.selectEmployee} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard label={t.workforce.timesheet.daysRecorded} value={timesheet.records.length} icon={CalendarRange} />
            <StatCard
              label={t.workforce.timesheet.hoursWorked}
              value={timesheet.totals.hours.toFixed(2)}
              icon={CalendarRange}
            />
            <StatCard
              label={t.workforce.timesheet.overtimeHours}
              value={timesheet.totals.overtime.toFixed(2)}
              icon={CalendarRange}
            />
            <StatCard
              label={t.workforce.timesheet.daysPresent}
              value={(timesheet.totals.byStatus.PRESENT ?? 0) + (timesheet.totals.byStatus.LATE ?? 0)}
              icon={CalendarRange}
            />
          </div>

          <Panel
            title={t.workforce.timesheet.panelTitle(
              `${timesheet.employee.firstName} ${timesheet.employee.lastName}`,
              `${months[timesheet.month - 1]} ${timesheet.year}`,
            )}
          >
            {timesheet.records.length === 0 ? (
              <EmptyState
                icon={CalendarRange}
                message={t.workforce.timesheet.empty}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                      <th className="px-3 py-3 font-semibold">{t.shared.date}</th>
                      <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                      <th className="px-3 py-3 font-semibold">{t.workforce.register.colIn}</th>
                      <th className="px-3 py-3 font-semibold">{t.workforce.register.colOut}</th>
                      <th className="px-3 py-3 font-semibold">{t.workforce.timesheet.colBreak}</th>
                      <th className="px-3 py-3 font-semibold">{t.workforce.timesheet.colHours}</th>
                      <th className="px-3 py-3 font-semibold">{t.workforce.timesheet.colOvertimeShort}</th>
                      <th className="px-3 py-3 font-semibold">{t.shared.noteCol}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheet.records.map((r) => (
                      <tr key={r.id} className="border-b border-ink-800 last:border-0">
                        <td className="px-3 py-3 text-ink-300">
                          {new Date(r.date).toLocaleDateString(t.shared.dateLocale, {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={attendanceStatusTone[r.status]}>{enumLabel(t.labels.attendanceStatus, r.status)}</Badge>
                        </td>
                        <td className="px-3 py-3 text-ink-300">{r.clockIn || '—'}</td>
                        <td className="px-3 py-3 text-ink-300">{r.clockOut || '—'}</td>
                        <td className="px-3 py-3 text-ink-300">
                          {r.breakMinutes ? t.workforce.timesheet.breakMinutes(r.breakMinutes) : '—'}
                        </td>
                        <td className="px-3 py-3 text-ink-100">{r.hoursWorked ?? '—'}</td>
                        <td className="px-3 py-3 text-ink-300">
                          {Number(r.overtimeHours) > 0 ? r.overtimeHours : '—'}
                        </td>
                        <td className="px-3 py-3 text-ink-400">{r.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-ink-700 text-sm font-semibold text-ink-100">
                      <td className="px-3 py-3" colSpan={5}>
                        {t.shared.total}
                      </td>
                      <td className="px-3 py-3">{timesheet.totals.hours.toFixed(2)}</td>
                      <td className="px-3 py-3">{timesheet.totals.overtime.toFixed(2)}</td>
                      <td className="px-3 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}

export default TimesheetTab
