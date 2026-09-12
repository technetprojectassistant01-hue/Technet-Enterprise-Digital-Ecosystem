import { useEffect, useState, type FormEvent } from 'react'
import { Plus, AlertTriangle, CalendarPlus, Ban, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { MaintenanceRequest, MaintenanceRequestStatus, MaintenanceRequestPriority } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES } from '../lib/permissions'
import { useServiceableAssets } from './useAssets'
import { useAssignableEmployees } from '../erp/useEmployees'
import { useCustomers } from '../erp/useCustomers'
import { requestPriorityTone, requestStatusTone } from './statusTones'
import { enumLabel, useT } from '../i18n'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const PRIORITIES: MaintenanceRequestPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const REQUEST_STATUSES: MaintenanceRequestStatus[] = ['SUBMITTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED']

interface FormState {
  assetId: string
  description: string
  priority: MaintenanceRequestPriority
}

const EMPTY_FORM: FormState = { assetId: '', description: '', priority: 'MEDIUM' }

function RequestsPage() {
  const t = useT()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, OPS_MANAGE_ROLES)
  const assets = useServiceableAssets()
  const employees = useAssignableEmployees()
  const customers = useCustomers()
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<MaintenanceRequestStatus | ''>('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<MaintenanceRequestPriority | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [scheduling, setScheduling] = useState<MaintenanceRequest | null>(null)
  const [scheduledDate, setScheduledDate] = useState('')
  const [technicianIds, setTechnicianIds] = useState<string[]>([])
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .listMaintenanceRequests({
        status: status || undefined,
        customerId: customerFilter || undefined,
        priority: priorityFilter || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then(({ requests }) => setRequests(requests))
      .catch((err) => setError(err instanceof Error ? err.message : t.maint.requests.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, [status, customerFilter, priorityFilter, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearFilters() {
    setStatus('')
    setCustomerFilter('')
    setPriorityFilter('')
    setFrom('')
    setTo('')
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, assetId: assets[0]?.id || '' })
    setFormError(null)
    setShowCreate(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.assetId) {
      setFormError(t.shared.selectAsset)
      return
    }
    if (!form.description.trim()) {
      setFormError(t.maint.requests.descriptionRequired)
      return
    }

    setSubmitting(true)
    try {
      await api.createMaintenanceRequest({
        assetId: form.assetId,
        description: form.description.trim(),
        priority: form.priority,
      })
      toast.success(t.maint.requests.logged)
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.maint.requests.logFailed)
    } finally {
      setSubmitting(false)
    }
  }

  function openSchedule(r: MaintenanceRequest) {
    setScheduling(r)
    setScheduledDate('')
    setTechnicianIds([])
    setScheduleError(null)
  }

  function toggleTechnician(id: string) {
    setTechnicianIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  async function handleScheduleSubmit(e: FormEvent) {
    e.preventDefault()
    setScheduleError(null)

    if (!scheduledDate) {
      setScheduleError(t.shared.dateRequired)
      return
    }

    setScheduleSubmitting(true)
    try {
      await api.scheduleMaintenanceRequest(scheduling!.id, { scheduledDate, technicianIds })
      toast.success(t.shared.visitScheduled)
      setScheduling(null)
      load()
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : t.shared.scheduleFailed)
    } finally {
      setScheduleSubmitting(false)
    }
  }

  async function handleCancel(r: MaintenanceRequest) {
    const ok = await confirm({
      title: t.maint.requests.cancelTitle,
      message: t.maint.requests.cancelMessage(r.requestNumber),
      confirmLabel: t.maint.requests.cancelConfirm,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.cancelMaintenanceRequest(r.id)
      toast.success(t.maint.requests.cancelled)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.maint.requests.cancelFailed)
    }
  }

  const submittedCount = requests.filter((r) => r.status === 'SUBMITTED').length
  const urgentCount = requests.filter((r) => r.priority === 'URGENT' && r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length

  function exportCsv() {
    downloadCsv(
      'maintenance-requests',
      [
        { header: 'Request #', accessor: (r: MaintenanceRequest) => r.requestNumber },
        { header: 'Asset', accessor: (r: MaintenanceRequest) => r.asset.assetNumber },
        { header: 'Customer', accessor: (r: MaintenanceRequest) => r.asset.customer.company || r.asset.customer.name },
        { header: 'Description', accessor: (r: MaintenanceRequest) => r.description },
        { header: 'Priority', accessor: (r: MaintenanceRequest) => r.priority },
        { header: 'Status', accessor: (r: MaintenanceRequest) => r.status },
      ],
      requests,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{t.maint.requests.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{t.maint.requests.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            {t.shared.exportCsv}
          </button>
          {canWrite && (
            <button type="button" onClick={openCreate} disabled={assets.length === 0} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              {t.maint.requests.log}
            </button>
          )}
        </div>
      </div>

      {canWrite && assets.length === 0 && (
        <p className="text-sm text-ink-400">{t.maint.requests.assetFirst}</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label={t.maint.requests.awaitingSchedule} value={submittedCount} deltaTone="warning" icon={AlertTriangle} />
        <StatCard label={t.maint.requests.urgentOpen} value={urgentCount} deltaTone={urgentCount > 0 ? 'warning' : undefined} icon={AlertTriangle} />
      </div>

      <Panel title={t.maint.requests.queue}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className={labelClass}>{t.shared.customer}</label>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={inputClass}>
              <option value="">{t.shared.allCustomers}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.shared.status}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MaintenanceRequestStatus | '')}
              className={inputClass}
            >
              <option value="">{t.shared.allStatuses}</option>
              {REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {enumLabel(t.labels.requestStatus, s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.shared.priority}</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as MaintenanceRequestPriority | '')}
              className={inputClass}
            >
              <option value="">{t.maint.requests.allPriorities}</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {enumLabel(t.labels.priority, p)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.shared.from}</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.shared.to}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          {(status || customerFilter || priorityFilter || from || to) && (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-ink-400 hover:text-ink-100">
              {t.shared.clearFilters}
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={8} />
        ) : requests.length === 0 ? (
          <EmptyState icon={AlertTriangle} message={t.maint.requests.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.maint.requests.colNumber}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.asset}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.customer}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.description}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.priority}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-mono font-medium text-ink-100">{r.requestNumber}</td>
                    <td className="px-3 py-3 font-mono text-ink-300">{r.asset.assetNumber}</td>
                    <td className="px-3 py-3 text-ink-300">{r.asset.customer.company || r.asset.customer.name}</td>
                    <td className="px-3 py-3 max-w-xs truncate text-ink-300" title={r.description}>
                      {r.description}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={requestPriorityTone[r.priority]}>{enumLabel(t.labels.priority, r.priority)}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={requestStatusTone[r.status]}>{enumLabel(t.labels.requestStatus, r.status)}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          {r.status === 'SUBMITTED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => openSchedule(r)}
                                aria-label={t.maint.requests.scheduleVisitAria}
                                className="hover:text-cyan-accent"
                              >
                                <CalendarPlus className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancel(r)}
                                aria-label={t.maint.requests.cancelTitle}
                                className="hover:text-red-400"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showCreate && (
        <Modal title={t.maint.requests.logTitle} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.shared.asset}</label>
              <select
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                className={`mt-2 ${inputClass}`}
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.assetNumber} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t.shared.description}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                required
                placeholder={t.maint.requests.descriptionPlaceholder}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{t.shared.priority}</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as MaintenanceRequestPriority })}
                className={`mt-2 ${inputClass}`}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {enumLabel(t.labels.priority, p)}
                  </option>
                ))}
              </select>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.shared.saving : t.maint.requests.log}
            </button>
          </form>
        </Modal>
      )}

      {scheduling && (
        <Modal title={t.maint.requests.scheduleTitle(scheduling.requestNumber)} onClose={() => setScheduling(null)}>
          <form onSubmit={handleScheduleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.shared.scheduledDate}</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{t.shared.technicians}</label>
              <div className="mt-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-md border border-ink-700 bg-ink-950 p-3">
                {employees.length === 0 ? (
                  <p className="text-xs text-ink-500">{t.shared.noEmployees}</p>
                ) : (
                  employees.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 text-sm text-ink-200">
                      <input
                        type="checkbox"
                        checked={technicianIds.includes(emp.id)}
                        onChange={() => toggleTechnician(emp.id)}
                        className="accent-cyan-accent"
                      />
                      {emp.firstName} {emp.lastName}
                      {emp.position && <span className="text-xs text-ink-500">— {emp.position}</span>}
                    </label>
                  ))
                )}
              </div>
            </div>

            {scheduleError && <p className="text-sm text-red-400">{scheduleError}</p>}

            <button type="submit" disabled={scheduleSubmitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {scheduleSubmitting ? t.shared.scheduling : t.shared.scheduleVisit}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default RequestsPage
