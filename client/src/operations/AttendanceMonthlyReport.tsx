import { useState } from 'react'
import type { AttendanceDailyRow, AttendanceMonthlyRow } from '../lib/api'
import { Modal, TableSkeleton } from '../dashboard/ui'
import { formatMoney } from '../lib/format'
import { useT } from '../i18n'

/** Our own per-person figures, kept beside the AiFace columns (transport, GPS and time flags). */
export interface MonthlyReportExtras {
  transport: number
  locationFlags: number
  timeFlags: number
}

const hrs = (minutes: number) => (minutes / 60).toFixed(1)

function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/**
 * Team Attendance's Attendance Summary, laid out like the office AiFace attendance machine's
 * Monthly Report (management, 2026-10-08): one row per person - Should / Actual / Absence / Late /
 * Leave Early / Holiday / Leave / Overtime - with the app's own transport and flag counts kept at
 * the end. Clicking a name opens that person's Daily Report, as clicking a name does in AiFace.
 * Figures come from GET /api/site-attendance/report/summary, the same as the PDF and Excel.
 */
function AttendanceMonthlyReport({
  rows,
  extras,
  periodLabel,
  loading,
}: {
  rows: AttendanceMonthlyRow[]
  extras: Map<string, MonthlyReportExtras>
  periodLabel: string
  loading: boolean
}) {
  const t = useT()
  const a = t.ops.team.aiface
  const [open, setOpen] = useState<AttendanceMonthlyRow | null>(null)

  if (loading) return <TableSkeleton rows={4} cols={8} />
  if (rows.length === 0) return <p className="text-sm text-ink-400">{t.ops.team.noCheckIns(periodLabel)}</p>

  const headers = [
    a.staffCode,
    a.name,
    a.department,
    a.shouldDays,
    a.actualDays,
    a.actualHrs,
    a.absenceDays,
    a.absenceHrs,
    a.lateTimes,
    a.lateMins,
    a.earlyTimes,
    a.earlyMins,
    a.holidayDays,
    a.leaveDays,
    a.leaveHrs,
    a.overtimeHrs,
    a.overtimeApprovedHrs,
    a.transport,
    t.ops.team.locationFlags,
    t.ops.team.timeFlags,
  ]
  const warn = (n: number) => (n > 0 ? <span className="font-medium text-amber-400">{n}</span> : <span className="text-ink-400">0</span>)

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-ink-800">
        <table className="w-full text-center text-sm">
          <thead>
            <tr className="border-b border-ink-800 text-[11px] text-ink-400">
              {headers.map((h, i) => (
                <th key={h} className={`px-2 py-2 font-semibold ${i < 3 ? 'text-left' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const daily = r.shouldDays !== null
              const x = extras.get(r.employeeId)
              const absent = r.noCheckInDays?.length ?? 0
              return (
                <tr key={r.employeeId} className="border-b border-ink-800 text-ink-300 last:border-0">
                  <td className="px-2 py-2 text-left font-mono text-xs text-ink-400">{r.code ?? '—'}</td>
                  <td className="px-2 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => setOpen(r)}
                      className="font-medium text-cyan-accent hover:underline"
                    >
                      {r.name}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-left">{r.department ?? '—'}</td>
                  <td className="px-2 py-2">{daily ? r.shouldDays : '—'}</td>
                  <td className="px-2 py-2">{r.daysCheckedIn}</td>
                  <td className="px-2 py-2">{hrs(r.minutesRecorded)}</td>
                  <td className="px-2 py-2">{daily ? <span className={absent ? 'font-medium text-red-400' : ''}>{absent}</span> : '—'}</td>
                  <td className="px-2 py-2">{daily ? hrs(r.absenceMinutes) : '—'}</td>
                  <td className="px-2 py-2">{r.lateDays}</td>
                  <td className="px-2 py-2">{r.lateMinutes}</td>
                  <td className="px-2 py-2">{r.earlyTimes}</td>
                  <td className="px-2 py-2">{r.earlyMinutes}</td>
                  <td className="px-2 py-2">{daily ? r.holidayDays : '—'}</td>
                  <td className="px-2 py-2">{daily ? r.leaveDays : '—'}</td>
                  <td className="px-2 py-2">{daily ? hrs(r.leaveMinutes) : '—'}</td>
                  <td className="px-2 py-2">{hrs(r.overtimeMinutes)}</td>
                  <td className="px-2 py-2">{hrs(r.approvedOvertimeMinutes)}</td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {x && x.transport > 0 ? formatMoney(x.transport) : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-2 py-2">{warn(x?.locationFlags ?? 0)}</td>
                  <td className="px-2 py-2">{warn(x?.timeFlags ?? 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title={a.dailyTitle(open.name, periodLabel)} size="lg" onClose={() => setOpen(null)}>
          <DailyReport rows={open.daily} />
        </Modal>
      )}
    </>
  )
}

/** One person's AiFace-style Daily Report: every day of the period with its In/Out pairs. */
function DailyReport({ rows }: { rows: AttendanceDailyRow[] }) {
  const t = useT()
  const a = t.ops.team.aiface
  const pair = (r: AttendanceDailyRow, i: number) => {
    const p = r.punches[i]
    if (!p) return ''
    const out = p.out === null ? a.notOut : p.outNextDay ? `${p.out} (${a.nextDay})` : p.out
    return `${p.in} / ${out}`
  }
  const tone: Record<AttendanceDailyRow['status'], string> = {
    PRESENT: 'text-ink-300',
    ABSENT: 'font-medium text-red-400',
    LEAVE: 'text-cyan-accent',
    HOLIDAY: 'text-cyan-accent',
    EXCUSED: 'text-ink-300',
    REST: 'text-ink-500',
  }
  return (
    <div className="overflow-auto rounded-lg border border-ink-800">
      <table className="w-full text-center text-xs">
        <thead className="sticky top-0 bg-ink-900">
          <tr className="border-b border-ink-800 text-[11px] text-ink-400">
            <th className="px-2 py-2 text-left font-semibold">{a.date}</th>
            <th className="px-2 py-2 font-semibold">{a.shift}</th>
            <th className="px-2 py-2 font-semibold">{a.inOut(1)}</th>
            <th className="px-2 py-2 font-semibold">{a.inOut(2)}</th>
            <th className="px-2 py-2 font-semibold">{a.inOut(3)}</th>
            <th className="px-2 py-2 font-semibold">{a.actualHrs}</th>
            <th className="px-2 py-2 font-semibold">{a.lateInMins}</th>
            <th className="px-2 py-2 font-semibold">{a.earlyOutMins}</th>
            <th className="px-2 py-2 font-semibold">{a.status}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day} className={`border-b border-ink-800 last:border-0 ${r.status === 'REST' ? 'bg-ink-950/40' : ''}`}>
              <td className="whitespace-nowrap px-2 py-1.5 text-left text-ink-200">{dayLabel(r.day)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-ink-400">{r.shift ?? '—'}</td>
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-ink-200">{pair(r, 0)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-ink-200">{pair(r, 1)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-ink-200">
                {pair(r, 2)}
                {r.punches.length > 3 && <span className="text-ink-400"> {a.more(r.punches.length - 3)}</span>}
              </td>
              <td className="px-2 py-1.5 text-ink-300">{r.punches.length ? hrs(r.minutes) : ''}</td>
              <td className="px-2 py-1.5 font-medium text-amber-400">{r.lateMinutes || ''}</td>
              <td className="px-2 py-1.5 font-medium text-amber-400">{r.earlyMinutes || ''}</td>
              <td className={`whitespace-nowrap px-2 py-1.5 ${tone[r.status]}`}>{a.statuses[r.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AttendanceMonthlyReport
