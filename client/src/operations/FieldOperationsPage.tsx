import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import * as api from '../lib/api'
import type { SiteTrackingEntry } from '../lib/api'
import { SITE_EXIT_REASON_LABELS } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES } from '../lib/permissions'
import { mapLink } from '../lib/geolocation'

function siteStatusTone(status: 'ON_SITE' | 'OUTSIDE_SITE' | 'UNVERIFIED' | 'NO_SITE') {
  if (status === 'ON_SITE') return 'success' as const
  if (status === 'OUTSIDE_SITE') return 'warning' as const
  return 'neutral' as const
}

function siteStatusLabel(entry: SiteTrackingEntry): string {
  if (!entry.workOrder.siteLat || !entry.workOrder.siteLng) return 'NO SITE SET'
  const latest = entry.verifications[0]
  if (!latest) return 'NOT YET VERIFIED'
  return latest.status.replace('_', ' ')
}

function siteStatus(entry: SiteTrackingEntry): 'ON_SITE' | 'OUTSIDE_SITE' | 'UNVERIFIED' | 'NO_SITE' {
  if (!entry.workOrder.siteLat || !entry.workOrder.siteLng) return 'NO_SITE'
  const latest = entry.verifications[0]
  if (!latest) return 'UNVERIFIED'
  return latest.status
}

function formatDuration(startIso: string, endIso?: string): string {
  const ms = new Date(endIso ?? new Date().toISOString()).getTime() - new Date(startIso).getTime()
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

function ExitEvents({ entry }: { entry: SiteTrackingEntry }) {
  const [open, setOpen] = useState(false)
  const exits = entry.verifications.filter((v) => v.status === 'OUTSIDE_SITE')
  if (exits.length === 0) return null

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:underline"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {exits.length} time{exits.length === 1 ? '' : 's'} left the site
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1.5 border-l border-ink-700 pl-3">
          {exits.map((v) => (
            <li key={v.id} className="text-xs text-ink-400">
              <a href={mapLink(v.lat, v.lng)} target="_blank" rel="noreferrer" className="text-cyan-accent hover:underline">
                {new Date(v.checkedAt).toLocaleString()}
              </a>
              {' — '}
              {v.exitReason ? (
                <>
                  {SITE_EXIT_REASON_LABELS[v.exitReason]}
                  {v.exitReasonNote && <span> ({v.exitReasonNote})</span>}
                </>
              ) : (
                <span className="text-ink-500">no reason given yet</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FieldOperationsPage() {
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, OPS_MANAGE_ROLES)

  const [current, setCurrent] = useState<SiteTrackingEntry[]>([])
  const [recentlyCompleted, setRecentlyCompleted] = useState<SiteTrackingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canAccess) return
    api
      .getSiteTracking()
      .then(({ current, recentlyCompleted }) => {
        setCurrent(current)
        setRecentlyCompleted(recentlyCompleted)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load field operations'))
      .finally(() => setLoading(false))
  }, [canAccess])

  if (!canAccess) {
    return <EmptyState icon={Lock} message="This section is restricted to Operations management." />
  }

  if (error) return <EmptyState icon={MapPin} message={error} />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Field Operations</h1>
        <p className="mt-1 text-sm text-ink-300">
          Where technicians are right now, whether they're still at the assigned site, and any time they've left.
        </p>
      </div>

      <Panel title="Technicians In The Field">
        {loading ? (
          <TableSkeleton rows={3} cols={3} />
        ) : current.length === 0 ? (
          <p className="text-sm text-ink-400">Nobody is currently checked in to a work order.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {current.map((entry) => {
              const latest = entry.verifications[0]
              const lat = latest?.lat ?? entry.checkInLat
              const lng = latest?.lng ?? entry.checkInLng
              return (
                <div key={entry.id} className="rounded-lg bg-ink-800 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-ink-100">
                        {entry.employee.firstName} {entry.employee.lastName}
                        {entry.employee.position && <span className="text-ink-500"> · {entry.employee.position}</span>}
                      </div>
                      <div className="mt-1 text-xs text-ink-400">
                        <Link
                          to={`/dashboard/operations/work-orders/${entry.workOrder.id}`}
                          className="text-cyan-accent hover:underline"
                        >
                          {entry.workOrder.workOrderNumber}
                        </Link>
                        {' — '}
                        {entry.workOrder.title} ·{' '}
                        {entry.workOrder.customer.company || entry.workOrder.customer.name}
                      </div>
                      <div className="mt-1 text-xs text-ink-500">
                        On site for {formatDuration(entry.checkInAt)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge tone={siteStatusTone(siteStatus(entry))}>{siteStatusLabel(entry)}</Badge>
                      <a
                        href={mapLink(lat, lng)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-cyan-accent hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {latest ? `Verified ${new Date(latest.checkedAt).toLocaleTimeString()}` : 'Check-in location'}
                      </a>
                    </div>
                  </div>
                  <ExitEvents entry={entry} />
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title="Recently Completed">
        {loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : recentlyCompleted.length === 0 ? (
          <p className="text-sm text-ink-400">No completed sessions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">TECHNICIAN</th>
                  <th className="px-3 py-3 font-semibold">WORK ORDER</th>
                  <th className="px-3 py-3 font-semibold">DURATION</th>
                  <th className="px-3 py-3 font-semibold">EXITS</th>
                </tr>
              </thead>
              <tbody>
                {recentlyCompleted.map((entry) => {
                  const exits = entry.verifications.filter((v) => v.status === 'OUTSIDE_SITE').length
                  return (
                    <tr key={entry.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-3 text-ink-100">
                        {entry.employee.firstName} {entry.employee.lastName}
                      </td>
                      <td className="px-3 py-3 text-ink-300">
                        <Link
                          to={`/dashboard/operations/work-orders/${entry.workOrder.id}`}
                          className="text-cyan-accent hover:underline"
                        >
                          {entry.workOrder.workOrderNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-ink-400">
                        {entry.checkOutAt ? formatDuration(entry.checkInAt, entry.checkOutAt) : '—'}
                      </td>
                      <td className="px-3 py-3 text-ink-400">
                        {exits > 0 ? <span className="text-amber-400">{exits}</span> : '—'}
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

export default FieldOperationsPage
