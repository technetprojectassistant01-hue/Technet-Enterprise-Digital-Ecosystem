import { useEffect, useState } from 'react'
import { AlertTriangle, Check, FileCheck2, FileText, Lock, RotateCcw, X } from 'lucide-react'
import * as api from '../lib/api'
import type { AttendanceValidation, AttendanceValidationStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { inputClass, labelClass, primaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, HR_ROLES } from '../lib/permissions'
import { useT } from '../i18n'

const STATUSES: AttendanceValidationStatus[] = ['PENDING', 'VALIDATED', 'REJECTED']
const statusTone = { PENDING: 'warning', VALIDATED: 'success', REJECTED: 'danger' } as const

const smallButton =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition'

/**
 * Admin/HR's attendance validation queue (Technet Workforce → Validations). An employee asks for a
 * date range to be validated from My Attendance → Export PDF; until it is, their PDF is marked
 * DRAFT. A validated range whose attendance changes afterwards shows as changed and can be
 * validated again.
 */
function AttendanceValidationPage() {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, HR_ROLES)

  const [status, setStatus] = useState<AttendanceValidationStatus | ''>('PENDING')
  const [items, setItems] = useState<AttendanceValidation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<AttendanceValidation | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  function load() {
    setLoading(true)
    setError(null)
    api
      .listAttendanceValidations()
      .then(({ validations }) => setItems(validations))
      .catch((err) => setError(err instanceof Error ? err.message : t.workforce.validations.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (canAccess) load()
  }, [canAccess]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!canAccess) return <EmptyState icon={Lock} message={t.shared.restrictedToHr} />

  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })
  const dayLabel = (day: string) => dateFormat.format(new Date(`${day}T12:00:00`))
  const periodOf = (v: AttendanceValidation) => (v.fromDate === v.toDate ? dayLabel(v.fromDate) : `${dayLabel(v.fromDate)} – ${dayLabel(v.toDate)}`)
  const personOf = (v: AttendanceValidation) => (v.employee ? `${v.employee.firstName} ${v.employee.lastName}` : '—')

  async function run(v: AttendanceValidation, action: () => Promise<unknown>, success: string) {
    setBusyId(v.id)
    try {
      await action()
      toast.success(success)
      setRejecting(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.workforce.validations.decideFailed)
    } finally {
      setBusyId(null)
    }
  }

  async function viewPdf(v: AttendanceValidation) {
    setBusyId(v.id)
    try {
      await api.downloadPdf(api.attendanceValidationPdfUrl(v.id), `attendance-${v.fromDate}-to-${v.toDate}.pdf`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myAttendance.downloadFailed)
    } finally {
      setBusyId(null)
    }
  }

  const shown = status ? items.filter((i) => i.status === status) : items
  const pendingCount = items.filter((i) => i.status === 'PENDING').length
  const validatedCount = items.filter((i) => i.status === 'VALIDATED' && !i.stale).length

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-300">{t.workforce.validations.intro}</p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label={t.workforce.validations.statPending} value={loading ? '—' : pendingCount} icon={FileText} deltaTone="warning" />
        <StatCard label={t.workforce.validations.statValidated} value={loading ? '—' : validatedCount} icon={FileCheck2} />
      </div>

      <Panel title={t.workforce.validations.panel} icon={FileCheck2}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.shared.status}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as AttendanceValidationStatus | '')} className={inputClass}>
              <option value="">{t.shared.allStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.workforce.validations.status[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : shown.length === 0 ? (
          <EmptyState icon={FileCheck2} message={status === 'PENDING' ? t.workforce.validations.emptyPending : t.workforce.validations.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.shared.employeeCol}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.validations.colPeriod}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.validations.colRequested}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((v) => {
                  const busy = busyId === v.id
                  return (
                    <tr key={v.id} className="border-b border-ink-800 align-top last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-medium text-ink-100">{personOf(v)}</div>
                        {v.employee && <div className="font-mono text-xs text-ink-400">{v.employee.employeeCode}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-100">{periodOf(v)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-300">{dateFormat.format(new Date(v.requestedAt))}</td>
                      <td className="px-3 py-3">
                        <Badge tone={statusTone[v.status]}>{t.workforce.validations.status[v.status]}</Badge>
                        {v.decidedBy && v.status !== 'PENDING' && (
                          <div className="mt-1 text-xs text-ink-400">{t.workforce.validations.decidedBy(v.decidedBy.name || v.decidedBy.email)}</div>
                        )}
                        {v.stale && (
                          <div className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {t.workforce.validations.changedSince}
                          </div>
                        )}
                        {v.note && <div className="mt-1 max-w-xs text-xs text-ink-300">{v.note}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => viewPdf(v)}
                            className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent disabled:opacity-50`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {t.workforce.validations.viewPdf}
                          </button>
                          {(v.status === 'PENDING' || v.stale) && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => run(v, () => api.validateAttendance(v.id), t.workforce.validations.validated(personOf(v)))}
                              className={`${smallButton} hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-50`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {v.stale ? t.workforce.validations.validateAgain : t.workforce.validations.validate}
                            </button>
                          )}
                          {v.status === 'PENDING' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setRejecting(v)
                                setRejectNote('')
                              }}
                              className={`${smallButton} hover:border-red-400 hover:text-red-400 disabled:opacity-50`}
                            >
                              <X className="h-3.5 w-3.5" />
                              {t.shared.reject}
                            </button>
                          )}
                          {v.status !== 'PENDING' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => run(v, () => api.reopenAttendanceValidation(v.id), t.workforce.validations.reopened)}
                              className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent disabled:opacity-50`}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {t.workforce.validations.reopen}
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
      </Panel>

      {rejecting && (
        <Modal title={t.workforce.validations.rejectTitle(personOf(rejecting))} onClose={() => setRejecting(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run(rejecting, () => api.rejectAttendanceValidation(rejecting.id, rejectNote || undefined), t.workforce.validations.rejected(personOf(rejecting)))
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label className={labelClass}>{t.workforce.validations.reason}</label>
              <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} className={`mt-2 ${inputClass}`} />
            </div>
            <button type="submit" disabled={busyId !== null} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {t.shared.reject}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default AttendanceValidationPage
