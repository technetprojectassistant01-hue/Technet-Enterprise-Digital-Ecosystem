import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileText } from 'lucide-react'
import * as api from '../lib/api'
import type { InterventionReport } from '../lib/api'
import { Panel, StatCard, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { reportStatusTone } from '../erp/statusTones'

function InterventionReportsPage() {
  const [reports, setReports] = useState<InterventionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    api
      .listInterventionReports()
      .then(({ interventionReports }) => setReports(interventionReports))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load intervention reports'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const pendingCount = reports.filter((r) => r.status === 'SUBMITTED').length
  const approvedCount = reports.filter((r) => r.status === 'APPROVED').length

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
        <StatCard label="APPROVED" value={approvedCount} />
      </div>

      <Panel>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : reports.length === 0 ? (
          <EmptyState icon={FileText} message="No intervention reports filed yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">INTERVENTION #</th>
                  <th className="px-3 py-3 font-semibold">WORK ORDER</th>
                  <th className="px-3 py-3 font-semibold">CUSTOMER</th>
                  <th className="px-3 py-3 font-semibold">DATE</th>
                  <th className="px-3 py-3 font-semibold">COMPLETED</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/operations/intervention-reports/${r.id}`}
                        className="font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                      >
                        {r.interventionNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{r.workOrder.workOrderNumber}</td>
                    <td className="px-3 py-3 text-ink-300">{r.workOrder.customer.company || r.workOrder.customer.name}</td>
                    <td className="px-3 py-3 text-ink-400">{r.date.slice(0, 10)}</td>
                    <td className="px-3 py-3 text-ink-300">{r.workCompleted ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={reportStatusTone[r.status]}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

export default InterventionReportsPage
