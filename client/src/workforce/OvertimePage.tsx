import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Clock, Lock, RotateCcw, X } from 'lucide-react'
import * as api from '../lib/api'
import type { OvertimeItem, OvertimeItemStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { inputClass, labelClass, primaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, HR_ROLES } from '../lib/permissions'
import { useT } from '../i18n'

const STATUSES: OvertimeItemStatus[] = ['PENDING', 'APPROVED', 'REJECTED']
const statusTone = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const

const smallButton =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition'

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * HR's overtime queue (Technet Workforce → Overtime). Overtime is worked out on the server from
 * site attendance against the standard hours; each day stays pending until HR approves or rejects
 * it. Only approved overtime shows on the technician's own My Attendance.
 */
function OvertimePage() {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, HR_ROLES)

  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [status, setStatus] = useState<OvertimeItemStatus | ''>('PENDING')
  const [items, setItems] = useState<OvertimeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<OvertimeItem | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  function load() {
    setLoading(true)
    setError(null)
    api
      .listOvertime(monthKey(cursor))
      .then(({ items }) => setItems(items))
      .catch((err) => setError(err instanceof Error ? err.message : t.workforce.overtime.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (canAccess) load()
  }, [cursor, canAccess]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!canAccess) return <EmptyState icon={Lock} message={t.shared.restrictedToHr} />

  const span = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    return h > 0 ? t.shared.hoursMinutes(h, minutes % 60) : t.shared.minutesOnly(minutes)
  }
  const keyOf = (i: OvertimeItem) => `${i.employeeId}|${i.date}`
  const personOf = (i: OvertimeItem) => (i.employee ? `${i.employee.firstName} ${i.employee.lastName}` : '—')
  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })

  async function decide(item: OvertimeItem, approve: boolean, note?: string) {
    setBusyKey(keyOf(item))
    try {
      await api.decideOvertime({ employeeId: item.employeeId, date: item.date, approve, note })
      toast.success(approve ? t.workforce.overtime.approved(personOf(item)) : t.workforce.overtime.rejected(personOf(item)))
      setRejecting(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.workforce.overtime.decideFailed)
    } finally {
      setBusyKey(null)
    }
  }

  async function undo(item: OvertimeItem) {
    setBusyKey(keyOf(item))
    try {
      await api.undoOvertimeDecision(item.employeeId, item.date)
      toast.success(t.workforce.overtime.undone)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.workforce.overtime.decideFailed)
    } finally {
      setBusyKey(null)
    }
  }

  const shown = status ? items.filter((i) => i.status === status) : items
  const pendingCount = items.filter((i) => i.status === 'PENDING').length
  const approvedMinutes = items
    .filter((i) => i.status === 'APPROVED')
    .reduce((sum, i) => sum + (i.decision?.minutes ?? i.minutes), 0)
  const isCurrentMonth = monthKey(cursor) === monthKey(new Date())
  const monthLabel = `${t.shared.months[cursor.getMonth()]} ${cursor.getFullYear()}`

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-300">{t.workforce.overtime.intro}</p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label={t.workforce.overtime.statPending} value={loading ? '—' : pendingCount} icon={Clock} deltaTone="warning" />
        <StatCard label={t.workforce.overtime.statApproved} value={loading ? '—' : span(approvedMinutes)} icon={Check} />
      </div>

      <Panel
        title={t.workforce.overtime.panel}
        icon={Clock}
        action={
          <div className="flex items-center gap-1">
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
        }
      >
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.shared.status}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as OvertimeItemStatus | '')} className={inputClass}>
              <option value="">{t.shared.allStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.workforce.overtime.status[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Clock} message={status === 'PENDING' ? t.workforce.overtime.emptyPending : t.workforce.overtime.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.shared.employeeCol}</th>
                  <th className="px-3 py-3 font-semibold">{t.myAttendance.colDate}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.overtime.colWorked}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.overtime.colOvertime}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const busy = busyKey === keyOf(i)
                  const minutes = i.status === 'PENDING' ? i.minutes : (i.decision?.minutes ?? i.minutes)
                  return (
                    <tr key={keyOf(i)} className="border-b border-ink-800 align-top last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-medium text-ink-100">{personOf(i)}</div>
                        {i.employee && <div className="font-mono text-xs text-ink-400">{i.employee.employeeCode}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-100">{dateFormat.format(new Date(`${i.date}T12:00:00`))}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-ink-100">
                        {i.firstIn && i.lastOut ? `${i.firstIn} → ${i.lastOut}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-ink-100">{span(minutes)}</td>
                      <td className="px-3 py-3">
                        <Badge tone={statusTone[i.status]}>{t.workforce.overtime.status[i.status]}</Badge>
                        {i.decision?.note && <div className="mt-1 max-w-xs text-xs text-ink-300">{i.decision.note}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {i.status === 'PENDING' ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => decide(i, true)}
                                className={`${smallButton} hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-50`}
                              >
                                <Check className="h-3.5 w-3.5" />
                                {t.shared.approve}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setRejecting(i)
                                  setRejectNote('')
                                }}
                                className={`${smallButton} hover:border-red-400 hover:text-red-400 disabled:opacity-50`}
                              >
                                <X className="h-3.5 w-3.5" />
                                {t.shared.reject}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => undo(i)}
                              className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent disabled:opacity-50`}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {t.workforce.overtime.undo}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-400">{t.workforce.overtime.rulesNote}</p>
      </Panel>

      {rejecting && (
        <Modal title={t.workforce.overtime.rejectTitle(personOf(rejecting))} onClose={() => setRejecting(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              decide(rejecting, false, rejectNote || undefined)
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label className={labelClass}>{t.workforce.overtime.reason}</label>
              <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} className={`mt-2 ${inputClass}`} />
            </div>
            <button type="submit" disabled={busyKey !== null} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {t.shared.reject}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default OvertimePage
