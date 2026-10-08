import { useEffect, useState } from 'react'
import { UserX } from 'lucide-react'
import * as api from '../lib/api'
import type { AbsenceEntry } from '../lib/api'
import { Panel, Badge, EmptyState, Modal, TableSkeleton } from './ui'
import { inputClass, labelClass, primaryButtonClass } from './buttonStyles'
import { useAuth } from '../context/AuthContext'
import { hasRole, HR_ROLES } from '../lib/permissions'
import { useToast } from './ToastContext'
import { useT } from '../i18n'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Absences for the month on the staff register (2026-10-01): technicians with no check-in on a
 * working day are Absent until they check in - worked out on the server (lib/absences.ts), never
 * typed in. HR (and Admin) can excuse a day with a note, or undo that. No pay effect.
 */
function AbsencesPanel({ month }: { month: Date }) {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const canExcuse = hasRole(user?.role, HR_ROLES)
  const [absences, setAbsences] = useState<AbsenceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [excusing, setExcusing] = useState<AbsenceEntry | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  // Filters over the month's list (client-side - the month is already loaded).
  const [staffFilter, setStaffFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'ABSENT' | 'EXCUSED'>('')
  const [dayFilter, setDayFilter] = useState('')

  const from = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-01`
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const to = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`
  const now = new Date()
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  // A filtered day from another month means nothing once the month changes.
  useEffect(() => setDayFilter(''), [from])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .listAbsences(from, to)
      .then(({ absences }) => !cancelled && setAbsences(absences))
      .catch(() => !cancelled && setAbsences([]))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [from, to, reloadKey])

  const name = (a: AbsenceEntry) => (a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : '—')
  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })
  const dayLabel = (d: string) => dateFormat.format(new Date(`${d}T12:00:00`))
  const absentToday = absences.filter((a) => a.date === today && a.status === 'ABSENT').length
  const staffOptions = [...new Map(absences.map((a) => [a.employeeId, name(a)])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const dayOptions = [...new Set(absences.map((a) => a.date))].sort().reverse()
  const filtering = !!(staffFilter || statusFilter || dayFilter)
  const rows = absences
    .filter((a) => (!staffFilter || a.employeeId === staffFilter) && (!statusFilter || a.status === statusFilter) && (!dayFilter || a.date === dayFilter))
    .sort((a, b) => (a.date === b.date ? name(a).localeCompare(name(b)) : b.date.localeCompare(a.date)))
  const selectClass = `${inputClass} py-1.5 text-sm`

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    try {
      await action()
      toast.success(message)
      setExcusing(null)
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.staffAttendance.excuseFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Panel
        title={t.staffAttendance.absencesTitle}
        icon={UserX}
        badge={absentToday > 0 ? <Badge tone="danger">{t.staffAttendance.absentToday(absentToday)}</Badge> : undefined}
      >
        <p className="mb-3 text-xs text-ink-400">{t.staffAttendance.absencesHint}</p>
        {!loading && absences.length > 0 && (
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <select
              aria-label={t.staffAttendance.colStaff}
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className={`${selectClass} w-full sm:w-auto`}
            >
              <option value="">{t.ops.team.allTechnicians}</option>
              {staffOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label={t.shared.status}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | 'ABSENT' | 'EXCUSED')}
              className={`${selectClass} w-full sm:w-auto`}
            >
              <option value="">{t.shared.allStatuses}</option>
              <option value="ABSENT">{t.staffAttendance.absent}</option>
              <option value="EXCUSED">{t.staffAttendance.excused}</option>
            </select>
            <select
              aria-label={t.staffAttendance.colDate}
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className={`${selectClass} w-full sm:w-auto`}
            >
              <option value="">{t.staffAttendance.anyDay}</option>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
            {filtering && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStaffFilter('')
                    setStatusFilter('')
                    setDayFilter('')
                  }}
                  className="text-xs font-semibold text-ink-400 hover:text-cyan-accent"
                >
                  {t.shared.clearFilters}
                </button>
                <span className="text-xs text-ink-400">{t.staffAttendance.absencesShown(rows.length, absences.length)}</span>
              </>
            )}
          </div>
        )}
        {loading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={UserX} message={filtering ? t.staffAttendance.noMatchingAbsences : t.staffAttendance.noAbsences} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-2 font-semibold">{t.staffAttendance.colDate}</th>
                  <th className="px-3 py-2 font-semibold">{t.staffAttendance.colStaff}</th>
                  <th className="px-3 py-2 font-semibold">{t.shared.status}</th>
                  {canExcuse && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={`${a.employeeId}|${a.date}`} className="border-b border-ink-800 align-top last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-ink-100">{dayLabel(a.date)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-100">{name(a)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={a.status === 'ABSENT' ? 'danger' : 'neutral'}>
                        {a.status === 'ABSENT' ? t.staffAttendance.absent : t.staffAttendance.excused}
                      </Badge>
                      {a.note && <div className="mt-1 max-w-xs text-xs text-ink-300">{a.note}</div>}
                    </td>
                    {canExcuse && (
                      <td className="px-3 py-2 text-right">
                        {a.status === 'ABSENT' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setExcusing(a)
                              setNote('')
                            }}
                            className="rounded-md border border-ink-600 px-2.5 py-1 text-xs font-semibold text-ink-200 transition hover:border-cyan-accent hover:text-cyan-accent disabled:opacity-50"
                          >
                            {t.staffAttendance.excuse}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(() => api.unexcuseAbsence(a.employeeId, a.date), t.staffAttendance.excuseRemoved)}
                            className="text-xs text-ink-400 hover:text-cyan-accent disabled:opacity-50"
                          >
                            {t.staffAttendance.undoExcuse}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {excusing && (
        <Modal title={t.staffAttendance.excuseTitle(name(excusing), dayLabel(excusing.date))} onClose={() => setExcusing(null)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!note.trim()) return
              void run(
                () => api.excuseAbsence({ employeeId: excusing.employeeId, date: excusing.date, note: note.trim() }),
                t.staffAttendance.excuseSaved,
              )
            }}
          >
            <div className="flex flex-col gap-1">
              <label className={labelClass}>{t.staffAttendance.excuseNote}</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.staffAttendance.excusePlaceholder}
                maxLength={300}
                autoFocus
                className={inputClass}
              />
            </div>
            <button type="submit" disabled={busy || !note.trim()} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {t.staffAttendance.excuse}
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}

export default AbsencesPanel
