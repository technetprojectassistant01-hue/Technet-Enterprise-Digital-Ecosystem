import { useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import * as api from '../lib/api'
import type { AttendanceRecordInput, AttendanceRosterRow, AttendanceStatus } from '../lib/api'
import { Panel, StatCard, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { inputClass, primaryButtonClass } from './formStyles'

const STATUSES: AttendanceStatus[] = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'ON_LEAVE',
  'PUBLIC_HOLIDAY',
  'REST_DAY',
]

/** Statuses that carry no clock times or hours. */
const NON_WORKING: AttendanceStatus[] = ['ABSENT', 'ON_LEAVE', 'PUBLIC_HOLIDAY', 'REST_DAY']

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function shiftDate(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

interface RowState {
  status: AttendanceStatus
  clockIn: string
  clockOut: string
  breakMinutes: string
  note: string
}

function rowFrom(entry: AttendanceRosterRow): RowState {
  return {
    status: entry.record?.status ?? entry.suggestedStatus,
    clockIn: entry.record?.clockIn ?? '',
    clockOut: entry.record?.clockOut ?? '',
    breakMinutes: entry.record ? String(entry.record.breakMinutes) : '0',
    note: entry.record?.note ?? '',
  }
}

function DailyRegisterTab() {
  const toast = useToast()

  const [date, setDate] = useState(today())
  const [roster, setRoster] = useState<AttendanceRosterRow[]>([])
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((forDate: string) => {
    setLoading(true)
    setError(null)
    api
      .getAttendanceDay(forDate)
      .then(({ roster }) => {
        setRoster(roster)
        setRows(Object.fromEntries(roster.map((entry) => [entry.employee.id, rowFrom(entry)])))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the register'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(date)
  }, [date, load])

  function updateRow(employeeId: string, patch: Partial<RowState>) {
    setRows((current) => ({ ...current, [employeeId]: { ...current[employeeId]!, ...patch } }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const records: AttendanceRecordInput[] = roster.map((entry) => {
        const row = rows[entry.employee.id]!
        const nonWorking = NON_WORKING.includes(row.status)
        return {
          employeeId: entry.employee.id,
          status: row.status,
          clockIn: nonWorking ? null : row.clockIn || null,
          clockOut: nonWorking ? null : row.clockOut || null,
          breakMinutes: nonWorking ? 0 : Number(row.breakMinutes || 0),
          note: row.note || null,
        }
      })

      const { saved } = await api.saveAttendanceDay(date, records)
      toast.success(`Saved attendance for ${saved} employee${saved === 1 ? '' : 's'}`)
      load(date)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const presentCount = Object.values(rows).filter(
    (r) => r.status === 'PRESENT' || r.status === 'LATE',
  ).length
  const absentCount = Object.values(rows).filter((r) => r.status === 'ABSENT').length
  const onLeaveCount = Object.values(rows).filter((r) => r.status === 'ON_LEAVE').length

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="HEADCOUNT" value={roster.length} icon={ClipboardCheck} />
        <StatCard label="PRESENT" value={presentCount} icon={ClipboardCheck} />
        <StatCard label="ON LEAVE" value={onLeaveCount} icon={ClipboardCheck} />
        <StatCard label="ABSENT" value={absentCount} icon={ClipboardCheck} />
      </div>

      <Panel title="Daily Register">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, -1))}
            aria-label="Previous day"
            className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`max-w-[12rem] ${inputClass}`}
          />

          <button
            type="button"
            onClick={() => setDate(shiftDate(date, 1))}
            aria-label="Next day"
            className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setDate(today())}
            className="text-sm text-ink-300 hover:text-ink-100"
          >
            Today
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || roster.length === 0}
            className={`ml-auto ${primaryButtonClass}`}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Register'}
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : roster.length === 0 ? (
          <EmptyState icon={ClipboardCheck} message="No employees to record attendance for." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-2 py-3 font-semibold">EMPLOYEE</th>
                  <th className="px-2 py-3 font-semibold">STATUS</th>
                  <th className="px-2 py-3 font-semibold">IN</th>
                  <th className="px-2 py-3 font-semibold">OUT</th>
                  <th className="px-2 py-3 font-semibold">BREAK (MIN)</th>
                  <th className="px-2 py-3 font-semibold">NOTE</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((entry) => {
                  const row = rows[entry.employee.id]!
                  const nonWorking = NON_WORKING.includes(row.status)
                  return (
                    <tr key={entry.employee.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-2 py-2">
                        <div className="font-medium text-ink-100">
                          {entry.employee.firstName} {entry.employee.lastName}
                        </div>
                        <div className="font-mono text-xs text-ink-400">
                          {entry.employee.employeeCode}
                          {entry.onLeaveType && (
                            <span className="ml-2 text-cyan-accent">{entry.onLeaveType}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={row.status}
                          onChange={(e) =>
                            updateRow(entry.employee.id, { status: e.target.value as AttendanceStatus })
                          }
                          className={`min-w-[9rem] ${inputClass}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="time"
                          value={row.clockIn}
                          disabled={nonWorking}
                          onChange={(e) => updateRow(entry.employee.id, { clockIn: e.target.value })}
                          className={`min-w-[7rem] ${inputClass} disabled:opacity-40`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="time"
                          value={row.clockOut}
                          disabled={nonWorking}
                          onChange={(e) => updateRow(entry.employee.id, { clockOut: e.target.value })}
                          className={`min-w-[7rem] ${inputClass} disabled:opacity-40`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="5"
                          value={row.breakMinutes}
                          disabled={nonWorking}
                          onChange={(e) => updateRow(entry.employee.id, { breakMinutes: e.target.value })}
                          className={`min-w-[5rem] ${inputClass} disabled:opacity-40`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={row.note}
                          onChange={(e) => updateRow(entry.employee.id, { note: e.target.value })}
                          className={`min-w-[10rem] ${inputClass}`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-ink-400">
          Hours and overtime are calculated on save from the clock times, minus the break. Anything over 8
          hours counts as overtime. Employees with approved leave are pre-marked.
        </p>
      </Panel>
    </div>
  )
}

export default DailyRegisterTab
