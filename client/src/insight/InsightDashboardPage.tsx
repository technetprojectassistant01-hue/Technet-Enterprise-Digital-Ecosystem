import { useEffect, useState } from 'react'
import { Banknote, FolderKanban, CalendarClock, Receipt, Wrench, Box, MapPinned } from 'lucide-react'
import * as api from '../lib/api'
import type { InsightSummary } from '../lib/api'
import { Panel, StatCard, TableSkeleton } from '../dashboard/ui'
import { formatMoney } from '../lib/format'

function InsightDashboardPage() {
  const [summary, setSummary] = useState<InsightSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    api
      .getInsightSummary()
      .then(({ summary }) => setSummary(summary))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard data'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Technet Insight</h1>
        <p className="mt-1 text-sm text-ink-300">
          Cross-module executive summary, drawn from Finance, Projects, Operations, Maintenance, and
          Inventory. Read-only - it reflects a snapshot on load, not a live feed.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <Panel>
          <TableSkeleton rows={2} cols={4} />
        </Panel>
      ) : summary ? (
        <>
          <p className="text-xs text-ink-400">
            As of {new Date(summary.generatedAt).toLocaleString()}
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Monthly Revenue"
              value={formatMoney(summary.monthlyRevenue)}
              icon={Banknote}
              sub="Paid invoices this month"
            />
            <StatCard label="Active Projects" value={summary.activeProjects} icon={FolderKanban} />
            <StatCard
              label="Active Work Orders"
              value={summary.activeWorkOrders}
              icon={CalendarClock}
              sub="Scheduled + in progress"
            />
            <StatCard
              label="Overdue Invoices"
              value={summary.overdueInvoices.count}
              icon={Receipt}
              delta={summary.overdueInvoices.count > 0 ? 'Attention' : undefined}
              deltaTone="warning"
              sub={formatMoney(summary.overdueInvoices.total)}
            />
            <StatCard
              label="Open Maintenance Requests"
              value={summary.openMaintenanceRequests}
              icon={Wrench}
            />
            <StatCard
              label="Low Stock Items"
              value={summary.lowStockItems}
              icon={Box}
              delta={summary.lowStockItems > 0 ? 'Attention' : undefined}
              deltaTone="warning"
            />
            <StatCard
              label="Technicians On Site"
              value={summary.techniciansOnSite}
              icon={MapPinned}
              sub="Currently checked in"
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

export default InsightDashboardPage
