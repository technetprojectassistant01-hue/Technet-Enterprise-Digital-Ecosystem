import { useEffect, useState } from 'react'
import { CalendarClock, MapPin } from 'lucide-react'
import * as api from '../lib/api'
import type { PortalWorkOrder } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { workOrderStatusTone } from '../erp/statusTones'

function PortalWorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<PortalWorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .portalListWorkOrders()
      .then(({ workOrders }) => setWorkOrders(workOrders))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load jobs'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <TableSkeleton rows={5} cols={3} />
  if (error) return <EmptyState icon={CalendarClock} message={error} />

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Jobs</h1>
        <p className="mt-1 text-sm text-ink-300">Status of work scheduled or in progress for you.</p>
      </div>
      {workOrders.length === 0 ? (
        <Panel>
          <EmptyState icon={CalendarClock} message="No jobs on file yet." />
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {workOrders.map((wo) => (
            <Panel key={wo.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-ink-500">{wo.workOrderNumber}</span>
                    <Badge tone={workOrderStatusTone[wo.status]}>{wo.status.replace('_', ' ')}</Badge>
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-ink-100">{wo.title}</h2>
                  {wo.description && <p className="mt-1 text-sm text-ink-300">{wo.description}</p>}
                  {wo.siteAddress && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {wo.siteAddress}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-ink-400">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {new Date(wo.scheduledDate).toLocaleDateString()}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}

export default PortalWorkOrdersPage
