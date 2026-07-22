import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileText } from 'lucide-react'
import * as api from '../lib/api'
import type { InterventionReport } from '../lib/api'
import { WORK_TYPE_LABELS } from '../lib/api'
import { Panel, StatCard, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { reportStatusTone } from '../erp/statusTones'
import { useCustomers } from '../erp/useCustomers'

function InterventionReportsPage() {
  const customers = useCustomers()
  const [reports, setReports] = useState<InterventionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerFilter, setCustomerFilter] = useState('')

  function load(customerId = customerFilter) {
    setLoading(true)
    api
      .listInterventionReports({ customerId: customerId || undefined })
      .then(({ interventionReports }) => setReports(interventionReports))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load intervention reports'))
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), []) // eslint-disable-line react-hooks/exhaustive-deps

  function changeCustomerFilter(id: string) {
    setCustomerFilter(id)
    load(id)
  }

  const pendingCount = reports.filter((r) => r.status === 'SUBMITTED').length
  const dueCount = reports.filter((r) => r.nextReminderAt && new Date(r.nextReminderAt) <= new Date()).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Link
          to="/dashboard/operations/intervention-reports/new"
          className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark"
        >
          <Plus className="h-4 w-4" />
          File Intervention Report
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="PENDING REVIEW" value={pendingCount} deltaTone="warning" />
        <StatCard label="REMINDERS DUE" value={dueCount} deltaTone={dueCount > 0 ? 'warning' : undefined} />
      </div>

      <Panel>
        <div className="mb-4 flex max-w-xs flex-col gap-1">
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
                          className="font-medium text-ink-100 hover:text-cyan-accent hover:underline"
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
