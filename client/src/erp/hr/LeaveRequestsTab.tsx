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

const STATUS_FILTERS: (LeaveRequestStatus | '')[] = ['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Renders "12 Mar 2026" for a single day, or a range when the dates differ. */
function formatRange(request: LeaveRequest): string {
  const start = formatDate(request.startDate)
  const end = formatDate(request.endDate)
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
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load leave requests'))
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

    if (!form.employeeId) return setFormError('Select an employee')
    if (!form.leaveTypeId) return setFormError('Select a leave type')
    if (!form.startDate || !form.endDate) return setFormError('Start and end dates are required')
    if (form.endDate < form.startDate) return setFormError('End date cannot be before the start date')

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
      toast.success(editing ? 'Leave request updated' : 'Leave request recorded')
      closeForm()
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save leave request')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(request: LeaveRequest, override = false) {
    try {
      await api.approveLeaveRequest(request.id, { override })
      toast.success('Leave approved')
      load()
    } catch (err) {
      // The server refuses to overdraw a balance unless explicitly told to.
      if (err instanceof ApiError && err.data?.code === 'BALANCE_EXCEEDED') {
        const ok = await confirm({
          title: 'Not enough leave balance',
          message: `${err.message}`,
          confirmLabel: 'Approve anyway',
          tone: 'danger',
        })
        if (ok) await handleApprove(request, true)
        return
      }
      toast.error(err instanceof Error ? err.message : 'Failed to approve leave')
    }
  }

  async function handleReject(request: LeaveRequest) {
    const ok = await confirm({
      title: 'Reject leave request',
      message: `Reject ${request.employee.firstName} ${request.employee.lastName}'s ${request.leaveType.name} request?`,
      confirmLabel: 'Reject',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.rejectLeaveRequest(request.id)
      toast.success('Leave rejected')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject leave')
    }
  }

  async function handleCancel(request: LeaveRequest) {
    const ok = await confirm({
      title: 'Cancel approved leave',
      message: `Cancel this ${request.days}-day ${request.leaveType.name} leave? The days go back to the balance.`,
      confirmLabel: 'Cancel Leave',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.cancelLeaveRequest(request.id)
      toast.success('Leave cancelled and balance restored')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel leave')
    }
  }

  async function handleDelete(request: LeaveRequest) {
    const ok = await confirm({
      title: 'Delete leave request',
      message: 'Delete this request permanently?',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteLeaveRequest(request.id)
      toast.success('Leave request deleted')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete request')
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length
  const approvedDays = requests
    .filter((r) => r.status === 'APPROVED')
    .reduce((sum, r) => sum + Number(r.days), 0)

  const activeLeaveTypes = leaveTypes.filter((t) => t.active)

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
          Record Leave
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="REQUESTS SHOWN" value={requests.length} icon={CalendarDays} />
        <StatCard label="AWAITING APPROVAL" value={pendingCount} icon={CalendarDays} />
        <StatCard label="APPROVED DAYS" value={approvedDays.toFixed(1)} icon={CalendarDays} />
      </div>

      <Panel title="Leave Requests">
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
                {s || 'All statuses'}
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
            <option value="">All employees</option>
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
              activeLeaveTypes.length === 0
                ? 'Set up leave types first, then start recording leave.'
                : 'No leave requests match these filters.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">EMPLOYEE</th>
                  <th className="px-3 py-3 font-semibold">TYPE</th>
                  <th className="px-3 py-3 font-semibold">DATES</th>
                  <th className="px-3 py-3 font-semibold">DAYS</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
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
                      {!r.leaveType.paid && <span className="ml-1 text-xs text-ink-500">(unpaid)</span>}
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      {formatRange(r)}
                      {r.halfDay && <span className="ml-1 text-xs text-ink-500">(½ day)</span>}
                    </td>
                    <td className="px-3 py-3 text-ink-300">{r.days}</td>
                    <td className="px-3 py-3">
                      <Badge tone={leaveRequestStatusTone[r.status]}>{r.status}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        {r.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(r)}
                              aria-label="Approve request"
                              className="hover:text-emerald-400"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(r)}
                              aria-label="Reject request"
                              className="hover:text-red-400"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              aria-label="Edit request"
                              className="text-xs hover:text-ink-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(r)}
                              aria-label="Delete request"
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
                            aria-label="Cancel leave"
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
        <Modal title={editing ? 'Edit Leave Request' : 'Record Leave'} onClose={closeForm}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>EMPLOYEE</label>
              <select
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              >
                <option value="">Select an employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>LEAVE TYPE</label>
              <select
                value={form.leaveTypeId}
                onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              >
                <option value="">Select a leave type</option>
                {activeLeaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.paid ? '' : ' (unpaid)'}
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
              Half day
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>START DATE</label>
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
                <label className={labelClass}>END DATE</label>
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
              <label className={labelClass}>DAYS CHARGED</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={form.days}
                onChange={(e) => setForm({ ...form, days: e.target.value })}
                className={`mt-2 ${inputClass}`}
              />
              <p className="mt-1 text-xs text-ink-400">
                Counted from working days (Mon–Fri). Adjust it if a public holiday falls in the range.
              </p>
            </div>

            <div>
              <label className={labelClass}>REASON</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Record Leave'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default LeaveRequestsTab
