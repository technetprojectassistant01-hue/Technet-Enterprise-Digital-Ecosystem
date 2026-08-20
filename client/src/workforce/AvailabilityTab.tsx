import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, UserCheck, CalendarDays, UserX } from 'lucide-react'
import * as api from '../lib/api'
import type { AttendanceRosterRow, AttendanceStatus } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { inputClass } from './formStyles'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function shiftDate(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

/** What a row actually is today: an explicit record wins, otherwise the roster's own suggestion. */
function effectiveStatus(row: AttendanceRosterRow): AttendanceStatus {
  return row.record?.status ?? row.suggestedStatus
}

function EmployeeList({ rows, empty, detail }: { rows: AttendanceRosterRow[]; empty: string; detail?: (row: AttendanceRosterRow) => string | null }) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-ink-400">{empty}</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.employee.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-ink-100">
            {row.employee.firstName} {row.employee.lastName}
            {row.employee.department && <span className="text-ink-500"> · {row.employee.department}</span>}
          </span>
          {detail?.(row) && <span className="text-xs text-ink-400">{detail(row)}</span>}
        </li>
      ))}
    </ul>
  )
}

function AvailabilityTab() {
  const [date, setDate] = useState(today())
  const [roster, setRoster] = useState<AttendanceRosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((forDate: string) => {
    setLoading(true)
    setError(null)
    api
      .getAttendanceDay(forDate)
      .then(({ roster }) => setRoster(roster))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load availability'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(date)
  }, [date, load])

  const available = roster.filter((r) => ['PRESENT', 'LATE'].includes(effectiveStatus(r)))
  const onLeave = roster.filter((r) => effectiveStatus(r) === 'ON_LEAVE')
  const absent = roster.filter((r) => effectiveStatus(r) === 'ABSENT')
  const restOrHoliday = roster.filter((r) => ['REST_DAY', 'PUBLIC_HOLIDAY'].includes(effectiveStatus(r)))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-ink-400">
          Who's available to work today, based on HR's attendance register and approved leave — not a
          live feed. Anyone not yet recorded for today defaults to "Available." For live GPS
          location of technicians already on a job, see Operations → Field Operations.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, -1))}
          aria-label="Previous day"
          className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`max-w-[12rem] ${inputClass}`} />
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, 1))}
          aria-label="Next day"
          className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {date !== today() && (
          <button type="button" onClick={() => setDate(today())} className="text-sm text-ink-300 hover:text-ink-100">
            Today
          </button>
        )}
      </div>

      {error && <EmptyState icon={UserX} message={error} />}

      {loading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : roster.length === 0 && !error ? (
        <EmptyState icon={UserCheck} message="No employees to show for this date." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel title="Available" icon={UserCheck} badge={<Badge tone="success">{available.length}</Badge>}>
            <EmployeeList rows={available} empty="Nobody available today." />
          </Panel>

          <Panel title="On Leave" icon={CalendarDays} badge={<Badge tone="warning">{onLeave.length}</Badge>}>
            <EmployeeList rows={onLeave} empty="Nobody on leave today." detail={(r) => r.onLeaveType} />
          </Panel>

          <Panel title="Absent" icon={UserX} badge={<Badge tone="danger">{absent.length}</Badge>}>
            <EmployeeList rows={absent} empty="Nobody marked absent today." />
          </Panel>
        </div>
      )}

      {!loading && restOrHoliday.length > 0 && (
        <p className="text-xs text-ink-500">
          {restOrHoliday.length} employee{restOrHoliday.length === 1 ? '' : 's'} have a rest day or public
          holiday today and aren't shown above.
        </p>
      )}
    </div>
  )
}

export default AvailabilityTab
