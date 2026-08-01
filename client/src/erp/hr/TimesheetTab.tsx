import { useCallback, useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import * as api from '../../lib/api'
import type { Timesheet } from '../../lib/api'
import { Panel, StatCard, Badge, EmptyState, TableSkeleton } from '../../dashboard/ui'
import { useEmployees } from '../useEmployees'
import { attendanceStatusTone } from '../statusTones'
import { inputClass } from './formStyles'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function TimesheetTab() {
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
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load timesheet'))
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
            {MONTHS.map((label, index) => (
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
        <EmptyState icon={CalendarRange} message="Select an employee to view their timesheet." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard label="DAYS RECORDED" value={timesheet.records.length} icon={CalendarRange} />
            <StatCard label="HOURS WORKED" value={timesheet.totals.hours.toFixed(2)} icon={CalendarRange} />
            <StatCard label="OVERTIME HOURS" value={timesheet.totals.overtime.toFixed(2)} icon={CalendarRange} />
            <StatCard
              label="DAYS PRESENT"
              value={(timesheet.totals.byStatus.PRESENT ?? 0) + (timesheet.totals.byStatus.LATE ?? 0)}
              icon={CalendarRange}
            />
          </div>

          <Panel
            title={`${timesheet.employee.firstName} ${timesheet.employee.lastName} — ${
              MONTHS[timesheet.month - 1]
            } ${timesheet.year}`}
          >
            {timesheet.records.length === 0 ? (
              <EmptyState
                icon={CalendarRange}
                message="No attendance recorded for this month yet. Use the Daily Register to record it."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                      <th className="px-3 py-3 font-semibold">DATE</th>
                      <th className="px-3 py-3 font-semibold">STATUS</th>
                      <th className="px-3 py-3 font-semibold">IN</th>
                      <th className="px-3 py-3 font-semibold">OUT</th>
                      <th className="px-3 py-3 font-semibold">BREAK</th>
                      <th className="px-3 py-3 font-semibold">HOURS</th>
                      <th className="px-3 py-3 font-semibold">OT</th>
                      <th className="px-3 py-3 font-semibold">NOTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheet.records.map((r) => (
                      <tr key={r.id} className="border-b border-ink-800 last:border-0">
                        <td className="px-3 py-3 text-ink-300">
                          {new Date(r.date).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={attendanceStatusTone[r.status]}>{r.status.replace('_', ' ')}</Badge>
                        </td>
                        <td className="px-3 py-3 text-ink-300">{r.clockIn || '—'}</td>
                        <td className="px-3 py-3 text-ink-300">{r.clockOut || '—'}</td>
                        <td className="px-3 py-3 text-ink-300">
                          {r.breakMinutes ? `${r.breakMinutes}m` : '—'}
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
                        Total
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
