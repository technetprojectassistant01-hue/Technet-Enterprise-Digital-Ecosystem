import { useEffect, useState } from 'react'
import { Lock, MapPin, ChevronDown, ChevronUp, BellRing } from 'lucide-react'
import * as api from '../lib/api'
import type { SiteTrackingEntry } from '../lib/api'
import { Panel, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES } from '../lib/permissions'
import { mapLink } from '../lib/geolocation'
import { locationMismatchLabel, statedTimeSuffix, totalTransportCost } from '../lib/siteAttendance'
import { formatMoney } from '../lib/format'
import { useToast } from '../dashboard/ToastContext'
import { enumLabel, getT, useT } from '../i18n'

function formatDuration(startIso: string, endIso?: string): string {
  const ms = new Date(endIso ?? new Date().toISOString()).getTime() - new Date(startIso).getTime()
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const t = getT()
  if (hours === 0) return t.shared.minutesOnly(minutes)
  return t.shared.hoursMinutes(hours, minutes)
}

/**
 * Historical exits, from before site attendance stopped linking to a work order (CLAUDE.md §7a).
 * No new SiteVerification rows are written now, so this renders for old sessions only and is
 * empty for anything recent.
 */
function ExitEvents({ entry }: { entry: SiteTrackingEntry }) {
  const t = useT()
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
        {t.ops.field.leftSite(exits.length)}
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
                  {enumLabel(t.labels.exitReason, v.exitReason)}
                  {v.exitReasonNote && <span> ({v.exitReasonNote})</span>}
                </>
              ) : (
                <span className="text-ink-500">{t.ops.field.noReasonYet}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RequestCheck({ entry }: { entry: SiteTrackingEntry }) {
  const t = useT()
  const toast = useToast()
  const [requesting, setRequesting] = useState(false)
  const [requested, setRequested] = useState(false)

  async function handleRequestVerification() {
    setRequesting(true)
    try {
      await api.requestLocationVerification(entry.id)
      setRequested(true)
      toast.success(t.ops.field.askedToOpen(entry.employee.firstName))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.field.requestFailed)
    } finally {
      setRequesting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleRequestVerification}
      disabled={requesting || requested}
      title={t.ops.field.requestHint}
      className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-cyan-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      <BellRing className="h-3.5 w-3.5" />
      {requested ? t.ops.field.requested : t.ops.field.requestCheck}
    </button>
  )
}

function FieldOperationsPage() {
  const t = useT()
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
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : t.ops.field.loadFailed))
      .finally(() => setLoading(false))
  }, [canAccess])

  if (!canAccess) {
    return <EmptyState icon={Lock} message={t.shared.restrictedToOps} />
  }

  if (error) return <EmptyState icon={MapPin} message={error} />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">{t.ops.field.title}</h1>
        <p className="mt-1 text-sm text-ink-300">{t.ops.field.subtitle}</p>
      </div>

      <Panel title={t.ops.field.inTheField}>
        {loading ? (
          <TableSkeleton rows={3} cols={3} />
        ) : current.length === 0 ? (
          <p className="text-sm text-ink-400">{t.shared.nobodyCheckedIn}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {current.map((entry) => {
              const flag = locationMismatchLabel(entry.checkInLocationMatch, entry.checkInLocationDistanceMeters)
              const transport = totalTransportCost(entry)
              return (
                <div key={entry.id} className="rounded-lg bg-ink-800 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-ink-100">
                        {entry.employee.firstName} {entry.employee.lastName}
                        {entry.employee.position && <span className="text-ink-500"> · {entry.employee.position}</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-400">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <a
                          href={mapLink(entry.checkInLat, entry.checkInLng)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-accent hover:underline"
                        >
                          {entry.checkInNote || t.ops.field.locationNotGiven}
                        </a>
                      </div>
                      {flag && <div className="mt-0.5 text-[11px] font-medium text-amber-400">⚠ {flag}</div>}
                      <div className="mt-1 text-xs text-ink-500">
                        {t.ops.field.onSiteFor(formatDuration(entry.checkInAt))}
                        {t.ops.field.checkedInAt(new Date(entry.checkInAt).toLocaleTimeString())}
                        {statedTimeSuffix(entry.checkInDeclaredTime, entry.checkInAt)}
                        {transport > 0 && <span>{t.ops.field.transport(formatMoney(transport))}</span>}
                      </div>
                    </div>
                    <RequestCheck entry={entry} />
                  </div>
                  <ExitEvents entry={entry} />
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title={t.ops.field.recentlyCompleted}>
        {loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : recentlyCompleted.length === 0 ? (
          <p className="text-sm text-ink-400">{t.ops.field.noCompleted}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.shared.technicianCol}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.location}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.durationCol}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.transportCol}</th>
                </tr>
              </thead>
              <tbody>
                {recentlyCompleted.map((entry) => {
                  const transport = totalTransportCost(entry)
                  return (
                    <tr key={entry.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-3 text-ink-100">
                        {entry.employee.firstName} {entry.employee.lastName}
                      </td>
                      <td className="px-3 py-3 text-ink-300">{entry.checkInNote || '—'}</td>
                      <td className="px-3 py-3 text-ink-400">
                        {entry.checkOutAt ? formatDuration(entry.checkInAt, entry.checkOutAt) : '—'}
                      </td>
                      <td className="px-3 py-3 text-ink-400">
                        {transport > 0 ? formatMoney(transport) : '—'}
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
