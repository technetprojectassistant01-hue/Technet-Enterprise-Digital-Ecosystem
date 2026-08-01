import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileText, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { InterventionReport, ReportStatus } from '../lib/api'
import { WORK_TYPE_LABELS } from '../lib/api'
import { Panel, StatCard, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_SUBMIT_ROLES } from '../lib/permissions'
import { reportStatusTone } from '../erp/statusTones'
import { useCustomers } from '../erp/useCustomers'

const STATUS_FILTERS: ReportStatus[] = ['SUBMITTED', 'APPROVED', 'REJECTED']

function InterventionReportsPage() {
  const { user } = useAuth()
  const canSubmit = hasRole(user?.role, OPS_SUBMIT_ROLES)
  const customers = useCustomers()
  const [reports, setReports] = useState<InterventionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerFilter, setCustomerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('')
  const [dueRemindersOnly, setDueRemindersOnly] = useState(false)
  const [stats, setStats] = useState({ pending: 0, due: 0 })
  const requestId = useRef(0)

  function loadStats(customerId = customerFilter) {
    Promise.all([
      api.listInterventionReports({ customerId: customerId || undefined, status: 'SUBMITTED' }),
      api.listInterventionReports({ customerId: customerId || undefined, dueRemindersOnly: true }),
    ])
      .then(([pending, due]) => {
        setStats({ pending: pending.interventionReports.length, due: due.interventionReports.length })
      })
      .catch(() => {})
  }

  function load(
    customerId = customerFilter,
    status = statusFilter,
    dueOnly = dueRemindersOnly,
  ) {
    const thisRequest = ++requestId.current
    setLoading(true)
    api
      .listInterventionReports({
        customerId: customerId || undefined,
        status: status || undefined,
        dueRemindersOnly: dueOnly || undefined,
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

  function changeCustomerFilter(id: string) {
    setCustomerFilter(id)
    load(id, statusFilter, dueRemindersOnly)
    loadStats(id)
  }

  function changeStatusFilter(status: ReportStatus | '') {
    setStatusFilter(status)
    load(customerFilter, status, dueRemindersOnly)
  }

  function clearAllFilters() {
    setStatusFilter('')
    setDueRemindersOnly(false)
    load(customerFilter, '', false)
  }

  function toggleDueReminders() {
    const next = !dueRemindersOnly
    setDueRemindersOnly(next)
    load(customerFilter, statusFilter, next)
  }

  function jumpToPendingReview() {
    setStatusFilter('SUBMITTED')
    setDueRemindersOnly(false)
    load(customerFilter, 'SUBMITTED', false)
  }

  function jumpToRemindersDue() {
    setStatusFilter('')
    setDueRemindersOnly(true)
    load(customerFilter, '', true)
  }

  function exportCsv() {
    downloadCsv(
      'intervention-reports',
      [
        { header: 'Intervention #', accessor: (r: InterventionReport) => r.interventionNumber },
        { header: 'Customer', accessor: (r: InterventionReport) => r.customer.company || r.customer.name },
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
            <label className="text-xs font-semibold tracking-widest text-ink-400">FILTER BY CUSTOMER</label>
            <select
              value={customerFilter}
              onChange={(e) => changeCustomerFilter(e.target.value)}
              className="rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent"
            >
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clearAllFilters}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              statusFilter === '' && !dueRemindersOnly ? 'bg-cyan-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
            }`}
          >
            All
          </button>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                statusFilter === s ? 'bg-cyan-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
              }`}
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            onClick={toggleDueReminders}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              dueRemindersOnly ? 'bg-amber-400 text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
            }`}
          >
            Reminders due only
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={7} />
        ) : reports.length === 0 ? (
          <EmptyState icon={FileText} message="No intervention reports filed yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">INTERVENTION #</th>
                  <th className="px-3 py-3 font-semibold">CUSTOMER</th>
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
