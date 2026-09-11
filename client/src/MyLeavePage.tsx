import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Ban, CalendarHeart, Lock } from 'lucide-react'
import * as api from './lib/api'
import type { LeaveType, LeaveBalance, LeaveRequest, MyLeaveRequestInput } from './lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from './dashboard/ui'
import { primaryButtonClass } from './dashboard/buttonStyles'
import { useToast } from './dashboard/ToastContext'
import { useConfirm } from './dashboard/ConfirmContext'
import { useAuth } from './context/AuthContext'
import { leaveRequestStatusTone } from './erp/statusTones'
import { useT } from './i18n'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

interface FormState {
  leaveTypeId: string
  startDate: string
  endDate: string
  halfDay: boolean
  days: string
  reason: string
}

const EMPTY_FORM: FormState = { leaveTypeId: '', startDate: '', endDate: '', halfDay: false, days: '', reason: '' }

function MyLeavePage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const t = useT()

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([api.getMyLeaveTypes(), api.getMyLeaveBalances(), api.listMyLeaveRequests()])
      .then(([types, bal, req]) => {
        setLeaveTypes(types.leaveTypes)
        setBalances(bal.balances)
        setRequests(req.requests)
      })
      .catch((err) => setError(err instanceof Error ? err.message : t.myLeave.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user?.employeeId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.employeeId])

  /** Asks the server for the working-day count whenever a full range is set - same pattern as the HR form. */
  useEffect(() => {
    if (!showForm || form.halfDay || !form.startDate || !form.endDate) return
    if (form.endDate < form.startDate) return
    let cancelled = false
    api
      .getMyLeaveWorkingDays(form.startDate, form.endDate)
      .then(({ days }) => {
        if (!cancelled) setForm((f) => ({ ...f, days: String(days) }))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [showForm, form.halfDay, form.startDate, form.endDate])

  function openForm() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.leaveTypeId) {
      setFormError(t.myLeave.selectLeaveType)
      return
    }
    if (!form.startDate || (!form.halfDay && !form.endDate)) {
      setFormError(t.myLeave.datesRequired)
      return
    }

    const input: MyLeaveRequestInput = {
      leaveTypeId: form.leaveTypeId,
      startDate: form.startDate,
      endDate: form.halfDay ? form.startDate : form.endDate,
      halfDay: form.halfDay,
      days: form.days || undefined,
      reason: form.reason || undefined,
    }

    setSubmitting(true)
    try {
      await api.createMyLeaveRequest(input)
      toast.success(t.myLeave.submitted)
      setShowForm(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.myLeave.submitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(r: LeaveRequest) {
    const ok = await confirm({
      title: t.myLeave.withdrawTitle,
      message: t.myLeave.withdrawMessage(r.leaveType.name, r.startDate.slice(0, 10), r.endDate.slice(0, 10)),
      confirmLabel: t.myLeave.withdraw,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.cancelMyLeaveRequest(r.id)
      toast.success(t.myLeave.withdrawn)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myLeave.withdrawFailed)
    }
  }

  if (!user?.employeeId) {
    return <EmptyState icon={Lock} message={t.myLeave.notLinked} />
  }

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{t.myLeave.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{t.myLeave.subtitle}</p>
        </div>
        <button type="button" onClick={openForm} className={primaryButtonClass}>
          <Plus className="h-4 w-4" />
          {t.myLeave.requestLeave}
        </button>
      </div>

      <StatCard
        label={t.myLeave.pendingRequests}
        value={pendingCount}
        deltaTone={pendingCount > 0 ? 'warning' : undefined}
        icon={CalendarHeart}
      />

      <Panel title={t.myLeave.myBalance}>
        {loading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : balances.length === 0 ? (
          <p className="text-sm text-ink-400">{t.myLeave.noBalances}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.myLeave.colLeaveType}</th>
                  <th className="px-3 py-3 font-semibold">{t.myLeave.colEntitled}</th>
                  <th className="px-3 py-3 font-semibold">{t.myLeave.colCarriedOver}</th>
                  <th className="px-3 py-3 font-semibold">{t.myLeave.colUsed}</th>
                  <th className="px-3 py-3 font-semibold">{t.myLeave.colAvailable}</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => {
                  const available = Number(b.entitledDays) + Number(b.carriedOverDays) - Number(b.usedDays)
                  return (
                    <tr key={b.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-3 text-ink-100">{b.leaveType.name}</td>
                      <td className="px-3 py-3 text-ink-300">{b.entitledDays}</td>
                      <td className="px-3 py-3 text-ink-300">{b.carriedOverDays}</td>
                      <td className="px-3 py-3 text-ink-300">{b.usedDays}</td>
                      <td className="px-3 py-3 font-medium text-ink-100">{available}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={t.myLeave.myRequests}>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : requests.length === 0 ? (
          <EmptyState icon={CalendarHeart} message={t.myLeave.noRequests} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.myLeave.colDates}</th>
                  <th className="px-3 py-3 font-semibold">{t.myLeave.colType}</th>
                  <th className="px-3 py-3 font-semibold">{t.myLeave.colDays}</th>
                  <th className="px-3 py-3 font-semibold">{t.myLeave.colReason}</th>
                  <th className="px-3 py-3 font-semibold">{t.myLeave.colStatus}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-100">
                      {r.startDate.slice(0, 10)}
                      {r.startDate.slice(0, 10) !== r.endDate.slice(0, 10) && ` – ${r.endDate.slice(0, 10)}`}
                    </td>
                    <td className="px-3 py-3 text-ink-300">{r.leaveType.name}</td>
                    <td className="px-3 py-3 text-ink-300">{r.days}</td>
                    <td className="px-3 py-3 max-w-xs truncate text-ink-300" title={r.reason || undefined}>
                      {r.reason || '—'}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={leaveRequestStatusTone[r.status]}>{t.myLeave.status[r.status]}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      {r.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => handleCancel(r)}
                          aria-label={t.myLeave.withdrawLabel}
                          className="text-ink-400 hover:text-red-400"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showForm && (
        <Modal title={t.myLeave.requestLeave} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.myLeave.colLeaveType}</label>
              <select
                value={form.leaveTypeId}
                onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              >
                <option value="">{t.myLeave.selectLeaveType}</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name}
                    {lt.paid ? '' : t.myLeave.unpaid}
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
              {t.myLeave.halfDay}
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.myLeave.startDate}</label>
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
                <label className={labelClass}>{t.myLeave.endDate}</label>
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
              <label className={labelClass}>{t.myLeave.daysCharged}</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={form.days}
                onChange={(e) => setForm({ ...form, days: e.target.value })}
                className={`mt-2 ${inputClass}`}
              />
              <p className="mt-1 text-xs text-ink-400">{t.myLeave.daysHint}</p>
            </div>

            <div>
              <label className={labelClass}>{t.myLeave.colReason}</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.myLeave.submitting : t.myLeave.submit}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default MyLeavePage
