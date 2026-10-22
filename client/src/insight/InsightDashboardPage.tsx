import { useEffect, useState } from 'react'
import { FolderKanban, CalendarClock, Wrench, Box, MapPinned } from 'lucide-react'
import * as api from '../lib/api'
import type { InsightSummary } from '../lib/api'
import { Panel, StatCard, TableSkeleton } from '../dashboard/ui'
import { useT } from '../i18n'

function InsightDashboardPage() {
  const t = useT()
  const s = t.system.insight
  const [summary, setSummary] = useState<InsightSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    api
      .getInsightSummary()
      .then(({ summary }) => setSummary(summary))
      .catch((err) => setError(err instanceof Error ? err.message : s.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">{s.title}</h1>
        <p className="mt-1 text-sm text-ink-300">{s.subtitle}</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <Panel>
          <TableSkeleton rows={2} cols={4} />
        </Panel>
      ) : summary ? (
        <>
          <p className="text-xs text-ink-400">
            {s.asOf(new Date(summary.generatedAt).toLocaleString(t.shared.dateLocale))}
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={s.activeProjects} value={summary.activeProjects} icon={FolderKanban} />
            <StatCard
              label={s.activeWorkOrders}
              value={summary.activeWorkOrders}
              icon={CalendarClock}
              sub={s.activeWorkOrdersSub}
            />
            <StatCard
              label={s.pendingToolRequests}
              value={summary.pendingToolRequests}
              icon={Wrench}
            />
            <StatCard
              label={s.lowStock}
              value={summary.lowStockItems}
              icon={Box}
              delta={summary.lowStockItems > 0 ? s.attention : undefined}
              deltaTone="warning"
            />
            <StatCard
              label={s.onSite}
              value={summary.techniciansOnSite}
              icon={MapPinned}
              sub={s.onSiteSub}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

export default InsightDashboardPage
