import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Wrench, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { WorkOrder, JobCategory } from '../lib/api'
import { JOB_CATEGORY_LABELS } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useReloadOnReconnect } from '../lib/useOnline'
import { useCustomers } from '../erp/useCustomers'
import { useProjects } from '../erp/useProjects'
import { useAssignableEmployees, useEmployees } from '../erp/useEmployees'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES } from '../lib/permissions'
import { workOrderStatusTone } from '../erp/statusTones'
import { enumLabel, useT } from '../i18n'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const JOB_CATEGORIES = Object.keys(JOB_CATEGORY_LABELS) as JobCategory[]

function WorkOrdersPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const t = useT()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, OPS_MANAGE_ROLES)
  const customers = useCustomers()
  const projects = useProjects()
  // Two different lists on purpose: the filter above the table has to offer technicians who have
  // since left, or their past work orders become unsearchable, while the assignment checkboxes
  // below must not - you can't send somebody who no longer works here to next week's job.
  const employees = useEmployees()
  const assignableEmployees = useAssignableEmployees()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filterCustomerId, setFilterCustomerId] = useState('')
  const [filterTechnicianId, setFilterTechnicianId] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [workOrderNumber, setWorkOrderNumber] = useState('')
  const [title, setTitle] = useState('')
  const [jobCategory, setJobCategory] = useState<JobCategory>('SERVICING')
  const [description, setDescription] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [siteQuery, setSiteQuery] = useState('')
  const [technicianIds, setTechnicianIds] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .listWorkOrders({
        from: from || undefined,
        to: to || undefined,
        customerId: filterCustomerId || undefined,
        technicianId: filterTechnicianId || undefined,
      })
      .then(({ workOrders }) => {
        setWorkOrders(workOrders)
        setError(null)
      })
      .catch((err) =>
        setError(
          navigator.onLine
            ? err instanceof Error
              ? err.message
              : t.ops.wo.loadFailed
            : t.shared.offlineNotSynced,
        ),
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [from, to, filterCustomerId, filterTechnicianId]) // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnReconnect(load)

  function clearFilters() {
    setFrom('')
    setTo('')
    setFilterCustomerId('')
    setFilterTechnicianId('')
  }

  function openCreate() {
    setCustomerId(customers[0]?.id || '')
    setProjectId('')
    setWorkOrderNumber('')
    setTitle('')
    setJobCategory('SERVICING')
    setDescription('')
    setScheduledDate('')
    setSiteQuery('')
    setTechnicianIds([])
    setFormError(null)
    setShowCreate(true)
  }

  function toggleTechnician(id: string) {
    setTechnicianIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!customerId) {
      setFormError(t.shared.selectCustomer)
      return
    }
    if (!workOrderNumber.trim()) {
      setFormError(t.ops.wo.numberRequired)
      return
    }
    if (!title.trim()) {
      setFormError(t.ops.wo.titleRequired)
      return
    }
    if (!scheduledDate) {
      setFormError(t.ops.wo.dateRequired)
      return
    }

    setSubmitting(true)
    try {
      await api.createWorkOrder({
        customerId,
        projectId: projectId || undefined,
        workOrderNumber,
        title,
        jobCategory,
        description: description || undefined,
        scheduledDate,
        technicianIds,
        siteQuery: siteQuery || undefined,
      })
      toast.success(t.ops.wo.created)
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.ops.wo.createFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(wo: WorkOrder) {
    const ok = await confirm({
      title: t.ops.wo.deleteTitle,
      message: t.ops.wo.deleteMessage(wo.workOrderNumber),
      confirmLabel: t.shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteWorkOrder(wo.id)
      toast.success(t.shared.deleted(wo.workOrderNumber))
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.wo.deleteFailed)
    }
  }

  const scheduledCount = workOrders.filter((w) => w.status === 'SCHEDULED').length
  const inProgressCount = workOrders.filter((w) => w.status === 'IN_PROGRESS').length

  // CSV headers and values stay in English: it's a data file for Excel, and a column named the
  // same way whoever exported it keeps reports and formulas working.
  function exportCsv() {
    downloadCsv(
      'work-orders',
      [
        { header: 'Work Order #', accessor: (w: WorkOrder) => w.workOrderNumber },
        { header: 'Title', accessor: (w: WorkOrder) => w.title },
        { header: 'Customer', accessor: (w: WorkOrder) => w.customer.company || w.customer.name },
        { header: 'Category', accessor: (w: WorkOrder) => JOB_CATEGORY_LABELS[w.jobCategory] },
        { header: 'Scheduled', accessor: (w: WorkOrder) => w.scheduledDate.slice(0, 10) },
        {
          header: 'Technicians',
          accessor: (w: WorkOrder) => w.technicians.map((x) => `${x.employee.firstName} ${x.employee.lastName}`).join('; '),
        },
        { header: 'Status', accessor: (w: WorkOrder) => w.status },
      ],
      workOrders,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{t.ops.wo.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{t.ops.wo.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            {t.shared.exportCsv}
          </button>
          {canWrite && (
            <button type="button" onClick={openCreate} disabled={customers.length === 0} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              {t.ops.wo.createNew}
            </button>
          )}
        </div>
      </div>

      {canWrite && customers.length === 0 && <p className="text-sm text-ink-400">{t.ops.wo.addCustomerFirst}</p>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label={t.labels.workOrderStatus.SCHEDULED} value={scheduledCount} icon={Wrench} />
        <StatCard label={t.labels.workOrderStatus.IN_PROGRESS} value={inProgressCount} deltaTone="warning" icon={Wrench} />
      </div>

      <Panel title={t.ops.wo.ledger}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.customer}</label>
            <select
              value={filterCustomerId}
              onChange={(e) => setFilterCustomerId(e.target.value)}
              className={inputClass}
            >
              <option value="">{t.shared.allCustomers}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.ops.wo.technician}</label>
            <select
              value={filterTechnicianId}
              onChange={(e) => setFilterTechnicianId(e.target.value)}
              className={inputClass}
            >
              <option value="">{t.ops.wo.allTechnicians}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.from}</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.to}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          {(from || to || filterCustomerId || filterTechnicianId) && (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-ink-400 hover:text-ink-100">
              {t.shared.clearFilters}
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : workOrders.length === 0 ? (
          <EmptyState icon={Wrench} message={t.ops.wo.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.ops.wo.colNumber}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.customer}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.category}</th>
                  <th className="px-3 py-3 font-semibold">{t.ops.wo.colScheduled}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.technicians}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => (
                  <tr key={wo.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/operations/work-orders/${wo.id}`}
                        className="font-mono font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                      >
                        {wo.workOrderNumber}
                      </Link>
                      <div className="text-xs text-ink-400">{wo.title}</div>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{wo.customer.company || wo.customer.name}</td>
                    <td className="px-3 py-3 text-ink-300">{enumLabel(t.labels.jobCategory, wo.jobCategory)}</td>
                    <td className="px-3 py-3 text-ink-400">{wo.scheduledDate.slice(0, 10)}</td>
                    <td className="px-3 py-3 text-ink-300">
                      {wo.technicians.length === 0
                        ? '—'
                        : wo.technicians.map((x) => `${x.employee.firstName} ${x.employee.lastName}`).join(', ')}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={workOrderStatusTone[wo.status]}>{enumLabel(t.labels.workOrderStatus, wo.status)}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          <button
                            type="button"
                            onClick={() => handleDelete(wo)}
                            aria-label={t.ops.wo.deleteTitle}
                            className="hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
        <Modal title={t.ops.wo.newTitle} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.shared.customer}</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">{t.shared.selectCustomer}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.ops.wo.project}</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.ops.wo.number}</label>
                <input
                  value={workOrderNumber}
                  onChange={(e) => setWorkOrderNumber(e.target.value)}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{t.shared.jobCategory}</label>
                <select
                  value={jobCategory}
                  onChange={(e) => setJobCategory(e.target.value as JobCategory)}
                  className={`mt-2 ${inputClass}`}
                >
                  {JOB_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {enumLabel(t.labels.jobCategory, c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>{t.shared.title}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required className={`mt-2 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>{t.ops.wo.descriptionOptional}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>
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
              <label className={labelClass}>{t.ops.wo.siteAddress}</label>
              <input
                value={siteQuery}
                onChange={(e) => setSiteQuery(e.target.value)}
                placeholder={t.ops.wo.sitePlaceholder}
                className={`mt-2 ${inputClass}`}
              />
              <p className="mt-1 text-xs text-ink-500">{t.ops.wo.siteHint}</p>
            </div>

            <div>
              <label className={labelClass}>{t.shared.technicians}</label>
              <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-ink-700 bg-ink-950 p-3 max-h-40 overflow-y-auto">
                {assignableEmployees.length === 0 ? (
                  <p className="text-xs text-ink-500">{t.shared.noEmployees}</p>
                ) : (
                  assignableEmployees.map((emp) => (
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

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.ops.wo.creating : t.ops.wo.create}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default WorkOrdersPage
