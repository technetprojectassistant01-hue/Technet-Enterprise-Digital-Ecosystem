import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileText, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { InterventionReport, ReportStatus, JobCategory, ServiceCategory } from '../lib/api'
import { WORK_TYPE_LABELS, JOB_CATEGORY_LABELS } from '../lib/api'
import { Panel, StatCard, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_SUBMIT_ROLES } from '../lib/permissions'
import { reportStatusTone } from '../erp/statusTones'
import { useCustomers } from '../erp/useCustomers'
import { enumLabel, navLabel, useT } from '../i18n'

const STATUS_FILTERS: ReportStatus[] = ['SUBMITTED', 'APPROVED', 'REJECTED']
const JOB_CATEGORIES = Object.keys(JOB_CATEGORY_LABELS) as JobCategory[]
const WORK_TYPES = Object.keys(WORK_TYPE_LABELS) as ServiceCategory[]

const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'

interface Filters {
  customerId: string
  status: ReportStatus | ''
  dueRemindersOnly: boolean
  jobCategory: JobCategory | ''
  workType: ServiceCategory | ''
  from: string
  to: string
}

const EMPTY_FILTERS: Filters = {
  customerId: '',
  status: '',
  dueRemindersOnly: false,
  jobCategory: '',
  workType: '',
  from: '',
  to: '',
}

function InterventionReportsPage() {
  const { user } = useAuth()
  const t = useT()
  const canSubmit = hasRole(user?.role, OPS_SUBMIT_ROLES)
  const customers = useCustomers()
  const [reports, setReports] = useState<InterventionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [stats, setStats] = useState({ pending: 0, due: 0 })
  const requestId = useRef(0)

  function loadStats(customerId = filters.customerId) {
    Promise.all([
      api.listInterventionReports({ customerId: customerId || undefined, status: 'SUBMITTED' }),
      api.listInterventionReports({ customerId: customerId || undefined, dueRemindersOnly: true }),
    ])
      .then(([pending, due]) => {
        setStats({ pending: pending.interventionReports.length, due: due.interventionReports.length })
      })
      .catch(() => {})
  }

  function load(f = filters) {
    const thisRequest = ++requestId.current
    setLoading(true)
    api
      .listInterventionReports({
        customerId: f.customerId || undefined,
        status: f.status || undefined,
        dueRemindersOnly: f.dueRemindersOnly || undefined,
        jobCategory: f.jobCategory || undefined,
        workType: f.workType || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
      })
      .then(({ interventionReports }) => {
        if (thisRequest !== requestId.current) return
        setReports(interventionReports)
      })
      .catch((err) => {
        if (thisRequest !== requestId.current) return
        setError(err instanceof Error ? err.message : t.ops.ir.loadFailed)
      })
      .finally(() => {
        if (thisRequest !== requestId.current) return
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
    loadStats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function updateFilters(patch: Partial<Filters>) {
    const next = { ...filters, ...patch }
    setFilters(next)
    load(next)
    if (patch.customerId !== undefined) loadStats(patch.customerId)
  }

  function clearAllFilters() {
    setFilters(EMPTY_FILTERS)
    load(EMPTY_FILTERS)
  }

  /** Quick relative-date shortcuts for the common "how many in the last N months" phone-call question. */
  function applyQuickRange(months: number) {
    const toDate = new Date()
    const fromDate = new Date()
    fromDate.setMonth(fromDate.getMonth() - months)
    updateFilters({ from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10) })
  }

  function jumpToPendingReview() {
    const next = { ...filters, status: 'SUBMITTED' as const, dueRemindersOnly: false }
    setFilters(next)
    load(next)
  }

  function jumpToRemindersDue() {
    const next = { ...filters, status: '' as const, dueRemindersOnly: true }
    setFilters(next)
    load(next)
  }

  // CSV stays in English — a data file for Excel (see WorkOrdersPage).
  function exportCsv() {
    downloadCsv(
      'intervention-reports',
      [
        { header: 'Intervention #', accessor: (r: InterventionReport) => r.interventionNumber },
        { header: 'Customer', accessor: (r: InterventionReport) => r.customer.company || r.customer.name },
        { header: 'Job Category', accessor: (r: InterventionReport) => JOB_CATEGORY_LABELS[r.jobCategory] },
        { header: 'Work Type', accessor: (r: InterventionReport) => WORK_TYPE_LABELS[r.workType] },
        { header: 'Work Order', accessor: (r: InterventionReport) => r.workOrder?.workOrderNumber },
        { header: 'Date', accessor: (r: InterventionReport) => r.date.slice(0, 10) },
        { header: 'Completed', accessor: (r: InterventionReport) => (r.workCompleted ? 'Yes' : 'No') },
        { header: 'Status', accessor: (r: InterventionReport) => r.status },
      ],
      reports,
    )
  }

  const noFilters =
    filters.status === '' &&
    !filters.dueRemindersOnly &&
    !filters.customerId &&
    !filters.jobCategory &&
    !filters.workType &&
    !filters.from &&
    !filters.to

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{navLabel(t, 'Intervention Reports')}</h1>
          <p className="mt-1 text-sm text-ink-300">{t.ops.ir.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            {t.shared.exportCsv}
          </button>
          {canSubmit && (
            <Link to="/dashboard/operations/intervention-reports/new" className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              {t.ops.ir.logNew}
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <button type="button" onClick={jumpToPendingReview} className="text-left">
          <StatCard label={t.ops.ir.pendingReview} value={stats.pending} deltaTone="warning" icon={FileText} />
        </button>
        <button type="button" onClick={jumpToRemindersDue} className="text-left">
          <StatCard
            label={t.ops.ir.remindersDue}
            value={stats.due}
            deltaTone={stats.due > 0 ? 'warning' : undefined}
            icon={FileText}
          />
        </button>
      </div>

      <Panel title={t.ops.ir.registry}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.customer}</label>
            <select
              value={filters.customerId}
              onChange={(e) => updateFilters({ customerId: e.target.value })}
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
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.jobCategory}</label>
            <select
              value={filters.jobCategory}
              onChange={(e) => updateFilters({ jobCategory: e.target.value as JobCategory | '' })}
              className={inputClass}
            >
              <option value="">{t.shared.allCategories}</option>
              {JOB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {enumLabel(t.labels.jobCategory, c)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.workType}</label>
            <select
              value={filters.workType}
              onChange={(e) => updateFilters({ workType: e.target.value as ServiceCategory | '' })}
              className={inputClass}
            >
              <option value="">{t.ops.ir.allWorkTypes}</option>
              {WORK_TYPES.map((w) => (
                <option key={w} value={w}>
                  {enumLabel(t.labels.workType, w)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.from}</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => updateFilters({ from: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.to}</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => updateFilters({ to: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.ops.ir.quickRange}</label>
            <div className="flex gap-2">
              {[3, 6, 12].map((months) => (
                <button key={months} type="button" onClick={() => applyQuickRange(months)} className={secondaryButtonClass}>
                  {t.ops.ir.months(months)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clearAllFilters}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              noFilters ? 'bg-cyan-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
            }`}
          >
            {t.shell.all}
          </button>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateFilters({ status: s })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                filters.status === s ? 'bg-cyan-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
              }`}
            >
              {enumLabel(t.labels.reportStatus, s)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => updateFilters({ dueRemindersOnly: !filters.dueRemindersOnly })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filters.dueRemindersOnly ? 'bg-amber-400 text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
            }`}
          >
            {t.ops.ir.remindersDueOnly}
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {!loading && (
          <p className="mb-3 text-sm text-ink-400">
            {t.ops.ir.found(reports.length, !!filters.customerId, !!(filters.from || filters.to))}
          </p>
        )}

        {loading ? (
          <TableSkeleton cols={8} />
        ) : reports.length === 0 ? (
          <EmptyState icon={FileText} message={t.ops.ir.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.ops.ir.colNumber}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.customer}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.jobCategory}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.workType}</th>
                  <th className="px-3 py-3 font-semibold">{t.ops.ir.colWorkOrder}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.date}</th>
                  <th className="px-3 py-3 font-semibold">{t.ops.ir.colCompleted}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const reminderDue = r.nextReminderAt && new Date(r.nextReminderAt) <= new Date()
                  return (
                    <tr key={r.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-3">
                        <Link
                          to={`/dashboard/operations/intervention-reports/${r.id}`}
                          className="font-mono font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                        >
                          {r.interventionNumber}
                        </Link>
                        {reminderDue && (
                          <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                            {t.ops.ir.reminderDue}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-ink-300">{r.customer.company || r.customer.name}</td>
                      <td className="px-3 py-3 text-ink-300">{enumLabel(t.labels.jobCategory, r.jobCategory)}</td>
                      <td className="px-3 py-3 text-ink-300">{enumLabel(t.labels.workType, r.workType)}</td>
                      <td className="px-3 py-3 text-ink-400">{r.workOrder?.workOrderNumber || '—'}</td>
                      <td className="px-3 py-3 text-ink-400">{r.date.slice(0, 10)}</td>
                      <td className="px-3 py-3 text-ink-300">{r.workCompleted ? t.shared.yes : t.shared.no}</td>
                      <td className="px-3 py-3">
                        <Badge tone={reportStatusTone[r.status]}>{enumLabel(t.labels.reportStatus, r.status)}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

export default InterventionReportsPage
