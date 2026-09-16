import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, MapPin, Phone, Users } from 'lucide-react'
import * as api from '../lib/api'
import type { MyDayWorkOrder } from '../lib/api'
import { Panel, Badge, TableSkeleton } from './ui'
import { mapLink } from '../lib/geolocation'
import { ATTENDANCE_CHANGED_EVENT } from '../lib/siteAttendance'
import { useOnline } from '../lib/useOnline'
import { enumLabel, useT } from '../i18n'

const OPEN_TONE: Record<string, 'accent' | 'warning' | 'success' | 'neutral'> = {
  SCHEDULED: 'neutral',
  IN_PROGRESS: 'accent',
  WAITING_FOR_PARTS: 'warning',
  REOPENED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}

/**
 * "My Jobs Today", directly under the check-in card: the work orders an admin scheduled for this
 * technician. The full Work Orders list shows everybody's and is a manager's tool; this is the
 * one thing a technician needs when they arrive — where to go, for whom, and who is with them.
 *
 * Refreshes on ATTENDANCE_CHANGED_EVENT so checking in brings the day's work with it, and on
 * reconnect, since the jobs are cached for offline reading (CLAUDE.md §14).
 */
function MyJobsToday() {
  const t = useT()
  const online = useOnline()
  const [today, setToday] = useState<MyDayWorkOrder[] | null>(null)
  const [carriedOver, setCarriedOver] = useState<MyDayWorkOrder[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    function load() {
      api
        .getMyDayWorkOrders()
        .then((res) => {
          if (cancelled) return
          setToday(res.today)
          setCarriedOver(res.carriedOver)
          setError(null)
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : t.myJobs.loadFailed)
        })
    }
    load()
    window.addEventListener(ATTENDANCE_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(ATTENDANCE_CHANGED_EVENT, load)
    }
  }, [online]) // eslint-disable-line react-hooks/exhaustive-deps

  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })

  function jobCard(job: MyDayWorkOrder, stale: boolean) {
    const others = job.technicians.filter((a) => a.employee).map((a) => `${a.employee.firstName} ${a.employee.lastName}`)
    const site = job.siteAddress || job.customer.address
    return (
      <li key={job.id} className="rounded-xl border border-ink-800 bg-ink-950 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-ink-400">{job.workOrderNumber}</span>
              <Badge tone={OPEN_TONE[job.status] ?? 'neutral'}>{enumLabel(t.labels.workOrderStatus, job.status)}</Badge>
              {stale && <Badge tone="warning">{t.myJobs.carriedOver}</Badge>}
            </div>
            <h3 className="mt-1 text-base font-semibold text-ink-100">{job.title}</h3>
            <p className="text-sm text-ink-300">{job.customer.company || job.customer.name}</p>
          </div>
          <Link
            to={`/dashboard/operations/work-orders/${job.id}`}
            className="shrink-0 rounded-md border border-ink-600 px-3 py-1.5 text-xs font-semibold text-ink-200 transition hover:border-cyan-accent hover:text-cyan-accent"
          >
            {t.myJobs.viewJob}
          </Link>
        </div>

        {job.description && <p className="mt-2 whitespace-pre-line text-sm text-ink-300">{job.description}</p>}

        <div className="mt-3 flex flex-col gap-1.5 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            {site ? (
              <span className="text-ink-200">
                {site}
                {job.siteLat && job.siteLng && (
                  <>
                    {' · '}
                    <a
                      href={mapLink(job.siteLat, job.siteLng)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-accent hover:underline"
                    >
                      {t.myJobs.openMap}
                    </a>
                  </>
                )}
              </span>
            ) : (
              <span className="text-ink-400">{t.myJobs.noSite}</span>
            )}
          </div>

          {job.customer.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-ink-400" />
              {/* Tap-to-call, the same treatment the Help Center gives the support line. */}
              <a href={`tel:${job.customer.phone.replace(/\s+/g, '')}`} className="text-cyan-accent hover:underline">
                {job.customer.phone}
              </a>
            </div>
          )}

          {others.length > 1 && (
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <span className="text-ink-300">
                {t.myJobs.withYou}: {others.join(', ')}
              </span>
            </div>
          )}

          {stale && (
            <p className="text-xs text-ink-400">{t.myJobs.scheduledFor(dateFormat.format(new Date(job.scheduledDate)))}</p>
          )}
        </div>
      </li>
    )
  }

  const total = (today?.length ?? 0) + carriedOver.length

  return (
    <Panel
      title={t.myJobs.title}
      icon={ClipboardList}
      action={total > 0 ? <span className="text-xs text-ink-400">{t.myJobs.count(total)}</span> : undefined}
    >
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!error && today === null && <TableSkeleton rows={2} cols={3} />}
      {!error && today !== null && total === 0 && (
        <div className="py-2">
          <p className="text-sm text-ink-300">{t.myJobs.empty}</p>
          <p className="mt-1 text-xs text-ink-400">{t.myJobs.emptyHint}</p>
        </div>
      )}
      {!error && today !== null && total > 0 && (
        <ul className="flex flex-col gap-3">
          {today.map((job) => jobCard(job, false))}
          {carriedOver.map((job) => jobCard(job, true))}
        </ul>
      )}
    </Panel>
  )
}

export default MyJobsToday
