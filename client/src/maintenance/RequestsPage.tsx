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
import { useAssets } from './useAssets'
import { useEmployees } from '../erp/useEmployees'
import { requestPriorityTone, requestStatusTone } from './statusTones'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const PRIORITIES: MaintenanceRequestPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const STATUS_FILTERS: (MaintenanceRequestStatus | '')[] = ['', 'SUBMITTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED']

interface FormState {
  assetId: string
  description: string
  priority: MaintenanceRequestPriority
}

const EMPTY_FORM: FormState = { assetId: '', description: '', priority: 'MEDIUM' }

function RequestsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, OPS_MANAGE_ROLES)
  const assets = useAssets()
  const employees = useEmployees()
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<MaintenanceRequestStatus | ''>('')

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [scheduling, setScheduling] = useState<MaintenanceRequest | null>(null)
  const [scheduledDate, setScheduledDate] = useState('')
  const [technicianIds, setTechnicianIds] = useState<string[]>([])
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)

  function load(statusValue = status) {
    setLoading(true)
    api
      .listMaintenanceRequests({ status: statusValue || undefined })
      .then(({ requests }) => setRequests(requests))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load requests'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setForm({ ...EMPTY_FORM, assetId: assets[0]?.id || '' })
    setFormError(null)
    setShowCreate(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.assetId) {
      setFormError('Select an asset')
      return
    }
    if (!form.description.trim()) {
      setFormError('Description is required')
      return
    }

    setSubmitting(true)
    try {
      await api.createMaintenanceRequest({
        assetId: form.assetId,
        description: form.description.trim(),
        priority: form.priority,
      })
      toast.success('Request logged')
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to log request')
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
      setScheduleError('A scheduled date is required')
      return
    }

    setScheduleSubmitting(true)
    try {
      await api.scheduleMaintenanceRequest(scheduling!.id, { scheduledDate, technicianIds })
      toast.success('Visit scheduled')
      setScheduling(null)
      load()
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Failed to schedule visit')
    } finally {
      setScheduleSubmitting(false)
    }
  }

  async function handleCancel(r: MaintenanceRequest) {
    const ok = await confirm({
      title: 'Cancel request',
      message: `Cancel request ${r.requestNumber}?`,
      confirmLabel: 'Cancel Request',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.cancelMaintenanceRequest(r.id)
      toast.success('Request cancelled')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel request')
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
          <h1 className="text-2xl font-bold text-ink-100">Maintenance Requests</h1>
          <p className="mt-1 text-sm text-ink-300">Corrective maintenance intake — log an issue, then schedule a visit.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {canWrite && (
            <button type="button" onClick={openCreate} disabled={assets.length === 0} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              Log Request
            </button>
          )}
        </div>
      </div>

      {canWrite && assets.length === 0 && (
        <p className="text-sm text-ink-400">Register an asset first before logging requests.</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="AWAITING SCHEDULE" value={submittedCount} deltaTone="warning" icon={AlertTriangle} />
        <StatCard label="URGENT OPEN" value={urgentCount} deltaTone={urgentCount > 0 ? 'warning' : undefined} icon={AlertTriangle} />
      </div>

      <Panel title="Request Queue">
        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s)
                load(s)
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                status === s ? 'bg-cyan-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={7} />
        ) : requests.length === 0 ? (
          <EmptyState icon={AlertTriangle} message="No maintenance requests match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">REQUEST #</th>
                  <th className="px-3 py-3 font-semibold">ASSET</th>
                  <th className="px-3 py-3 font-semibold">DESCRIPTION</th>
                  <th className="px-3 py-3 font-semibold">PRIORITY</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-mono font-medium text-ink-100">{r.requestNumber}</td>
                    <td className="px-3 py-3 font-mono text-ink-300">{r.asset.assetNumber}</td>
                    <td className="px-3 py-3 max-w-xs truncate text-ink-300" title={r.description}>
                      {r.description}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={requestPriorityTone[r.priority]}>{r.priority}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={requestStatusTone[r.status]}>{r.status}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          {r.status === 'SUBMITTED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => openSchedule(r)}
                                aria-label="Schedule visit"
                                className="hover:text-cyan-accent"
                              >
                                <CalendarPlus className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancel(r)}
                                aria-label="Cancel request"
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
        <Modal title="Log Maintenance Request" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>ASSET</label>
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
              <label className={labelClass}>DESCRIPTION</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                required
                placeholder="What's wrong with the equipment..."
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>PRIORITY</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as MaintenanceRequestPriority })}
                className={`mt-2 ${inputClass}`}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Saving…' : 'Log Request'}
            </button>
          </form>
        </Modal>
      )}

      {scheduling && (
        <Modal title={`Schedule Visit — ${scheduling.requestNumber}`} onClose={() => setScheduling(null)}>
          <form onSubmit={handleScheduleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>SCHEDULED DATE</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>TECHNICIANS</label>
              <div className="mt-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-md border border-ink-700 bg-ink-950 p-3">
                {employees.length === 0 ? (
                  <p className="text-xs text-ink-500">No employees yet.</p>
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
              {scheduleSubmitting ? 'Scheduling…' : 'Schedule Visit'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default RequestsPage
