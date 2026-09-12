import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Check, X, Ban, Trash2, CalendarDays } from 'lucide-react'
import * as api from '../../lib/api'
import { ApiError } from '../../lib/api'
import type { LeaveRequest, LeaveRequestStatus, LeaveType } from '../../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../../dashboard/ui'
import { useToast } from '../../dashboard/ToastContext'
import { useConfirm } from '../../dashboard/ConfirmContext'
import { useEmployees } from '../useEmployees'
import { leaveRequestStatusTone } from '../statusTones'
import { inputClass, labelClass, primaryButtonClass } from './formStyles'
import { enumLabel, useT } from '../../i18n'

const STATUS_FILTERS: (LeaveRequestStatus | '')[] = ['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Renders "12 Mar 2026" for a single day, or a range when the dates differ. */
function formatRange(request: LeaveRequest, locale: string): string {
  const start = formatDate(request.startDate, locale)
  const end = formatDate(request.endDate, locale)
  return start === end ? start : `${start} → ${end}`
}

interface FormState {
  employeeId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  days: string
  halfDay: boolean
  reason: string
}

const EMPTY_FORM: FormState = {
  employeeId: '',
  leaveTypeId: '',
  startDate: '',
  endDate: '',
  days: '',
  halfDay: false,
  reason: '',
}

function LeaveRequestsTab({ leaveTypes }: { leaveTypes: LeaveType[] }) {
  const t = useT()
  const toast = useToast()
  const confirm = useConfirm()
  const employees = useEmployees()

  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState<LeaveRequestStatus | ''>('')
  const [employeeId, setEmployeeId] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LeaveRequest | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    (overrides: { status?: LeaveRequestStatus | ''; employeeId?: string } = {}) => {
      const nextStatus = overrides.status ?? status
      const nextEmployee = overrides.employeeId ?? employeeId
      setLoading(true)
      setError(null)
      api
        .listLeaveRequests({
          status: nextStatus || undefined,
          employeeId: nextEmployee || undefined,
        })
        .then(({ requests }) => setRequests(requests))
        .catch((err) => setError(err instanceof Error ? err.message : t.hr.requests.loadFailed))
        .finally(() => setLoading(false))
    },
    [status, employeeId],
  )

  useEffect(() => {
    load({ status: '', employeeId: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Asks the server for the working-day count whenever a full range is set. */
  useEffect(() => {
    if (!showForm || form.halfDay || !form.startDate || !form.endDate) return
    if (form.endDate < form.startDate) return
    let cancelled = false
    api
      .getLeaveWorkingDays(form.startDate, form.endDate)
      .then(({ days }) => {
        if (!cancelled) setForm((f) => ({ ...f, days: String(days) }))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [showForm, form.startDate, form.endDate, form.halfDay])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(request: LeaveRequest) {
    setForm({
      employeeId: request.employeeId,
      leaveTypeId: request.leaveTypeId,
      startDate: request.startDate.slice(0, 10),
      endDate: request.endDate.slice(0, 10),
      days: request.days,
      halfDay: request.halfDay,
      reason: request.reason || '',
    })
    setFormError(null)
    setEditing(request)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.employeeId) return setFormError(t.hr.requests.selectEmployee)
    if (!form.leaveTypeId) return setFormError(t.hr.requests.selectLeaveType)
    if (!form.startDate || !form.endDate) return setFormError(t.hr.requests.datesRequired)
    if (form.endDate < form.startDate) return setFormError(t.hr.requests.endBeforeStart)

    setSubmitting(true)
    try {
      const input = {
        employeeId: form.employeeId,
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.halfDay ? form.startDate : form.endDate,
        days: form.days || undefined,
        halfDay: form.halfDay,
        reason: form.reason || undefined,
      }
      if (editing) {
        await api.updateLeaveRequest(editing.id, input)
      } else {
        await api.createLeaveRequest(input)
      }
      toast.success(editing ? t.hr.requests.updated : t.hr.requests.recorded)
      closeForm()
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.hr.requests.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(request: LeaveRequest, override = false) {
    try {
      await api.approveLeaveRequest(request.id, { override })
      toast.success(t.hr.requests.approved)
      load()
    } catch (err) {
      // The server refuses to overdraw a balance unless explicitly told to.
      if (err instanceof ApiError && err.data?.code === 'BALANCE_EXCEEDED') {
        const ok = await confirm({
          title: t.hr.requests.balanceExceededTitle,
          message: `${err.message}`,
          confirmLabel: t.hr.requests.approveAnyway,
          tone: 'danger',
        })
        if (ok) await handleApprove(request, true)
        return
      }
      toast.error(err instanceof Error ? err.message : t.hr.requests.approveFailed)
    }
  }

  async function handleReject(request: LeaveRequest) {
    const ok = await confirm({
      title: t.hr.requests.rejectTitle,
      message: t.hr.requests.rejectMessage(
        `${request.employee.firstName} ${request.employee.lastName}`,
        request.leaveType.name,
      ),
      confirmLabel: t.shared.reject,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.rejectLeaveRequest(request.id)
      toast.success(t.hr.requests.rejected)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.hr.requests.rejectFailed)
    }
  }

  async function handleCancel(request: LeaveRequest) {
    const ok = await confirm({
      title: t.hr.requests.cancelTitle,
      message: t.hr.requests.cancelMessage(request.days, request.leaveType.name),
      confirmLabel: t.hr.requests.cancelConfirm,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.cancelLeaveRequest(request.id)
      toast.success(t.hr.requests.cancelled)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.hr.requests.cancelFailed)
    }
  }

  async function handleDelete(request: LeaveRequest) {
    const ok = await confirm({
      title: t.hr.requests.deleteTitle,
      message: t.hr.requests.deleteMessage,
      confirmLabel: t.shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteLeaveRequest(request.id)
      toast.success(t.hr.requests.deleted)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.hr.requests.deleteFailed)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length
  const approvedDays = requests
    .filter((r) => r.status === 'APPROVED')
    .reduce((sum, r) => sum + Number(r.days), 0)

  const locale = t.shared.dateLocale
  const activeLeaveTypes = leaveTypes.filter((type) => type.active)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          disabled={activeLeaveTypes.length === 0}
          className={primaryButtonClass}
        >
          <Plus className="h-4 w-4" />
          {t.hr.requests.record}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t.hr.requests.shown} value={requests.length} icon={CalendarDays} />
        <StatCard label={t.hr.requests.awaiting} value={pendingCount} icon={CalendarDays} />
        <StatCard label={t.hr.requests.approvedDays} value={approvedDays.toFixed(1)} icon={CalendarDays} />
      </div>

      <Panel title={t.hr.requests.panel}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => {
              const next = e.target.value as LeaveRequestStatus | ''
              setStatus(next)
              load({ status: next })
            }}
            className={`max-w-[12rem] ${inputClass}`}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s ? enumLabel(t.labels.leaveStatus, s) : t.shared.allStatuses}
              </option>
            ))}
          </select>

          <select
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value)
              load({ employeeId: e.target.value })
            }}
            className={`max-w-[16rem] ${inputClass}`}
          >
            <option value="">{t.hr.balances.allEmployees}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            message={
              activeLeaveTypes.length === 0 ? t.hr.requests.emptyNoTypes : t.hr.requests.empty
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.shared.employeeCol}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.type}</th>
                  <th className="px-3 py-3 font-semibold">{t.hr.requests.colDates}</th>
                  <th className="px-3 py-3 font-semibold">{t.hr.requests.colDays}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <div className="font-medium text-ink-100">
                        {r.employee.firstName} {r.employee.lastName}
                      </div>
                      <div className="font-mono text-xs text-ink-400">{r.employee.employeeCode}</div>
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      {r.leaveType.name}
                      {!r.leaveType.paid && (
                        <span className="ml-1 text-xs text-ink-500">{t.hr.requests.unpaid}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      {formatRange(r, locale)}
                      {r.halfDay && (
                        <span className="ml-1 text-xs text-ink-500">{t.hr.requests.halfDayMark}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-300">{r.days}</td>
                    <td className="px-3 py-3">
                      <Badge tone={leaveRequestStatusTone[r.status]}>
                        {enumLabel(t.labels.leaveStatus, r.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        {r.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(r)}
                              aria-label={t.hr.requests.approveAria}
                              className="hover:text-emerald-400"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(r)}
                              aria-label={t.hr.requests.rejectAria}
                              className="hover:text-red-400"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              aria-label={t.hr.requests.editAria}
                              className="text-xs hover:text-ink-100"
                            >
                              {t.hr.requests.editAction}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(r)}
                              aria-label={t.hr.requests.deleteAria}
                              className="hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {r.status === 'APPROVED' && (
                          <button
                            type="button"
                            onClick={() => handleCancel(r)}
                            aria-label={t.hr.requests.cancelAria}
                            className="hover:text-red-400"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showForm && (
        <Modal title={editing ? t.hr.requests.edit : t.hr.requests.record} onClose={closeForm}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.shared.employeeCol}</label>
              <select
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              >
                <option value="">{t.hr.requests.selectEmployee}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>{t.hr.requests.leaveType}</label>
              <select
                value={form.leaveTypeId}
                onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              >
                <option value="">{t.hr.requests.selectLeaveType}</option>
                {activeLeaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                    {type.paid ? '' : t.hr.requests.unpaidSuffix}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-300">
              <input
                type="checkbox"
                checked={form.halfDay}
                onChange={(e) =>
                  setForm({
                    ...form,
                    halfDay: e.target.checked,
                    days: e.target.checked ? '0.5' : form.days,
                    endDate: e.target.checked ? form.startDate : form.endDate,
                  })
                }
                className="h-4 w-4 rounded border-ink-600 bg-ink-950"
              />
              {t.hr.requests.halfDay}
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.shared.startDate}</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      startDate: e.target.value,
                      endDate: form.halfDay ? e.target.value : form.endDate,
                    })
                  }
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{t.hr.requests.endDate}</label>
                <input
                  type="date"
                  value={form.halfDay ? form.startDate : form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  disabled={form.halfDay}
                  required
                  className={`mt-2 ${inputClass} disabled:opacity-60`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>{t.hr.requests.daysCharged}</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={form.days}
                onChange={(e) => setForm({ ...form, days: e.target.value })}
                className={`mt-2 ${inputClass}`}
              />
              <p className="mt-1 text-xs text-ink-400">{t.hr.requests.daysNote}</p>
            </div>

            <div>
              <label className={labelClass}>{t.hr.requests.reason}</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.shared.saving : editing ? t.shared.saveChanges : t.hr.requests.record}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default LeaveRequestsTab
