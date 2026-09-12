import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, UserCheck, CalendarDays, UserX } from 'lucide-react'
import * as api from '../lib/api'
import type { AttendanceRosterRow, AttendanceStatus } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { inputClass } from './formStyles'
import { useT } from '../i18n'

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
  const t = useT()
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
      .catch((err) => setError(err instanceof Error ? err.message : t.workforce.availability.loadFailed))
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
        <p className="text-sm text-ink-400">{t.workforce.availability.note}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, -1))}
          aria-label={t.shared.previousDay}
          className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`max-w-[12rem] ${inputClass}`} />
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, 1))}
          aria-label={t.shared.nextDay}
          className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {date !== today() && (
          <button type="button" onClick={() => setDate(today())} className="text-sm text-ink-300 hover:text-ink-100">
            {t.shared.today}
          </button>
        )}
      </div>

      {error && <EmptyState icon={UserX} message={error} />}

      {loading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : roster.length === 0 && !error ? (
        <EmptyState icon={UserCheck} message={t.workforce.availability.noEmployees} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel
            title={t.workforce.availability.available}
            icon={UserCheck}
            badge={<Badge tone="success">{available.length}</Badge>}
          >
            <EmployeeList rows={available} empty={t.workforce.availability.nobodyAvailable} />
          </Panel>

          <Panel
            title={t.workforce.availability.onLeave}
            icon={CalendarDays}
            badge={<Badge tone="warning">{onLeave.length}</Badge>}
          >
            <EmployeeList
              rows={onLeave}
              empty={t.workforce.availability.nobodyOnLeave}
              detail={(r) => r.onLeaveType}
            />
          </Panel>

          <Panel
            title={t.workforce.availability.absent}
            icon={UserX}
            badge={<Badge tone="danger">{absent.length}</Badge>}
          >
            <EmployeeList rows={absent} empty={t.workforce.availability.nobodyAbsent} />
          </Panel>
        </div>
      )}

      {!loading && restOrHoliday.length > 0 && (
        <p className="text-xs text-ink-500">{t.workforce.availability.restOrHoliday(restOrHoliday.length)}</p>
      )}
    </div>
  )
}

export default AvailabilityTab
