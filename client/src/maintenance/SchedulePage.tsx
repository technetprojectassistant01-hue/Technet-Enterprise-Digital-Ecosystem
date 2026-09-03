import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, CalendarClock, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { MaintenanceSchedule, MaintenanceScheduleStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES } from '../lib/permissions'
import { useMaintenanceContracts } from './useMaintenanceContracts'
import { useAssignableEmployees } from '../erp/useEmployees'
import { useCustomers } from '../erp/useCustomers'
import { scheduleStatusTone } from './statusTones'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

interface FormState {
  contractId: string
  scheduledDate: string
  technicianIds: string[]
}

const EMPTY_FORM: FormState = { contractId: '', scheduledDate: '', technicianIds: [] }

function SchedulePage() {
  const toast = useToast()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, OPS_MANAGE_ROLES)
  const contracts = useMaintenanceContracts()
  const employees = useAssignableEmployees()
  const customers = useCustomers()
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<MaintenanceScheduleStatus | ''>('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .listMaintenanceSchedules({
        status: status || undefined,
        customerId: customerFilter || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then(({ schedules }) => setSchedules(schedules))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load schedule'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [status, customerFilter, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearFilters() {
    setStatus('')
    setCustomerFilter('')
    setFrom('')
    setTo('')
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, contractId: contracts[0]?.id || '' })
    setFormError(null)
    setShowCreate(true)
  }

  function toggleTechnician(id: string) {
    setForm((f) => ({
      ...f,
      technicianIds: f.technicianIds.includes(id) ? f.technicianIds.filter((t) => t !== id) : [...f.technicianIds, id],
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.contractId) {
      setFormError('Select a contract')
      return
    }
    if (!form.scheduledDate) {
      setFormError('A scheduled date is required')
      return
    }

    setSubmitting(true)
    try {
      await api.createMaintenanceSchedule({
        contractId: form.contractId,
        scheduledDate: form.scheduledDate,
        technicianIds: form.technicianIds,
      })
      toast.success('Visit scheduled')
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to schedule visit')
    } finally {
      setSubmitting(false)
    }
  }

  const scheduledCount = schedules.filter((s) => s.status === 'SCHEDULED').length

  function exportCsv() {
    downloadCsv(
      'maintenance-schedule',
      [
        { header: 'Date', accessor: (s: MaintenanceSchedule) => s.scheduledDate.slice(0, 10) },
        { header: 'Type', accessor: (s: MaintenanceSchedule) => (s.contract ? 'Preventive' : 'Corrective') },
        { header: 'Asset', accessor: (s: MaintenanceSchedule) => (s.contract || s.request)?.asset.assetNumber },
        {
          header: 'Technicians',
          accessor: (s: MaintenanceSchedule) => s.technicians.map((t) => `${t.employee.firstName} ${t.employee.lastName}`).join('; '),
        },
        { header: 'Status', accessor: (s: MaintenanceSchedule) => s.status },
      ],
      schedules,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Service Schedule</h1>
          <p className="mt-1 text-sm text-ink-300">Preventive and corrective visits across all contracts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {canWrite && (
            <button type="button" onClick={openCreate} disabled={contracts.length === 0} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              Schedule Visit
            </button>
          )}
        </div>
      </div>

      {canWrite && contracts.length === 0 && (
        <p className="text-sm text-ink-400">Create a contract first to schedule a preventive visit.</p>
      )}

      <StatCard label="UPCOMING VISITS" value={scheduledCount} icon={CalendarClock} />

      <Panel title="Visit Ledger">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className={labelClass}>CUSTOMER</label>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={inputClass}>
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>STATUS</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MaintenanceScheduleStatus | '')}
              className={inputClass}
            >
              <option value="">All statuses</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>FROM</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>TO</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          {(status || customerFilter || from || to) && (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-ink-400 hover:text-ink-100">
              Clear filters
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={7} />
        ) : schedules.length === 0 ? (
          <EmptyState icon={CalendarClock} message="No visits match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">DATE</th>
                  <th className="px-3 py-3 font-semibold">TYPE</th>
                  <th className="px-3 py-3 font-semibold">ASSET</th>
                  <th className="px-3 py-3 font-semibold">CUSTOMER</th>
                  <th className="px-3 py-3 font-semibold">TECHNICIANS</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => {
                  const assetRef = s.contract?.asset || s.request?.asset
                  return (
                    <tr key={s.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-3 text-ink-100">{s.scheduledDate.slice(0, 10)}</td>
                      <td className="px-3 py-3 text-ink-300">{s.contract ? 'Preventive' : 'Corrective'}</td>
                      <td className="px-3 py-3 font-mono text-ink-300">{assetRef?.assetNumber || '—'}</td>
                      <td className="px-3 py-3 text-ink-300">
                        {assetRef?.customer ? assetRef.customer.company || assetRef.customer.name : '—'}
                      </td>
                      <td className="px-3 py-3 text-ink-300">
                        {s.technicians.length === 0
                          ? '—'
                          : s.technicians.map((t) => `${t.employee.firstName} ${t.employee.lastName}`).join(', ')}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={scheduleStatusTone[s.status]}>{s.status}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/dashboard/maintenance/schedule/${s.id}`}
                          className="text-xs font-semibold text-cyan-accent hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showCreate && (
        <Modal title="Schedule Preventive Visit" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>CONTRACT</label>
              <select
                value={form.contractId}
                onChange={(e) => setForm({ ...form, contractId: e.target.value })}
                className={`mt-2 ${inputClass}`}
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contractNumber} — {c.asset.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>SCHEDULED DATE</label>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
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
                        checked={form.technicianIds.includes(emp.id)}
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

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Scheduling…' : 'Schedule Visit'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default SchedulePage
