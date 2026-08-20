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
        setError(err instanceof Error ? err.message : 'Failed to load intervention reports')
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
    const to = new Date()
    const from = new Date()
    from.setMonth(from.getMonth() - months)
    updateFilters({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) })
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Intervention Reports</h1>
          <p className="mt-1 text-sm text-ink-300">Incident response, resolution, and follow-up tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {canSubmit && (
            <Link to="/dashboard/operations/intervention-reports/new" className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              Log New Intervention
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <button type="button" onClick={jumpToPendingReview} className="text-left">
          <StatCard label="PENDING REVIEW" value={stats.pending} deltaTone="warning" icon={FileText} />
        </button>
        <button type="button" onClick={jumpToRemindersDue} className="text-left">
          <StatCard label="REMINDERS DUE" value={stats.due} deltaTone={stats.due > 0 ? 'warning' : undefined} icon={FileText} />
        </button>
      </div>

      <Panel title="Intervention Registry">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">CUSTOMER</label>
            <select
              value={filters.customerId}
              onChange={(e) => updateFilters({ customerId: e.target.value })}
              className={inputClass}
            >
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">JOB CATEGORY</label>
            <select
              value={filters.jobCategory}
              onChange={(e) => updateFilters({ jobCategory: e.target.value as JobCategory | '' })}
              className={inputClass}
            >
              <option value="">All categories</option>
              {JOB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {JOB_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">WORK TYPE</label>
            <select
              value={filters.workType}
              onChange={(e) => updateFilters({ workType: e.target.value as ServiceCategory | '' })}
              className={inputClass}
            >
              <option value="">All work types</option>
              {WORK_TYPES.map((w) => (
                <option key={w} value={w}>
                  {WORK_TYPE_LABELS[w]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">FROM</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => updateFilters({ from: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">TO</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => updateFilters({ to: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">QUICK RANGE</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => applyQuickRange(3)} className={secondaryButtonClass}>
                3 mo
              </button>
              <button type="button" onClick={() => applyQuickRange(6)} className={secondaryButtonClass}>
                6 mo
              </button>
              <button type="button" onClick={() => applyQuickRange(12)} className={secondaryButtonClass}>
                12 mo
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clearAllFilters}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filters.status === '' && !filters.dueRemindersOnly && !filters.customerId && !filters.jobCategory && !filters.workType && !filters.from && !filters.to
                ? 'bg-cyan-accent text-ink-950'
                : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
            }`}
          >
            All
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
              {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => updateFilters({ dueRemindersOnly: !filters.dueRemindersOnly })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filters.dueRemindersOnly ? 'bg-amber-400 text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
            }`}
          >
            Reminders due only
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {!loading && (
          <p className="mb-3 text-sm text-ink-400">
            {reports.length} intervention{reports.length === 1 ? '' : 's'} found
            {filters.customerId && ' for this customer'}
            {(filters.from || filters.to) && ' in this date range'}
          </p>
        )}

        {loading ? (
          <TableSkeleton cols={8} />
        ) : reports.length === 0 ? (
          <EmptyState icon={FileText} message="No intervention reports match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">INTERVENTION #</th>
                  <th className="px-3 py-3 font-semibold">CUSTOMER</th>
                  <th className="px-3 py-3 font-semibold">JOB CATEGORY</th>
                  <th className="px-3 py-3 font-semibold">WORK TYPE</th>
                  <th className="px-3 py-3 font-semibold">WORK ORDER</th>
                  <th className="px-3 py-3 font-semibold">DATE</th>
                  <th className="px-3 py-3 font-semibold">COMPLETED</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
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
                            REMINDER DUE
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-ink-300">{r.customer.company || r.customer.name}</td>
                      <td className="px-3 py-3 text-ink-300">{JOB_CATEGORY_LABELS[r.jobCategory]}</td>
                      <td className="px-3 py-3 text-ink-300">{WORK_TYPE_LABELS[r.workType]}</td>
                      <td className="px-3 py-3 text-ink-400">{r.workOrder?.workOrderNumber || '—'}</td>
                      <td className="px-3 py-3 text-ink-400">{r.date.slice(0, 10)}</td>
                      <td className="px-3 py-3 text-ink-300">{r.workCompleted ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-3">
                        <Badge tone={reportStatusTone[r.status]}>{r.status}</Badge>
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
