import { useEffect, useState } from 'react'
import { ShieldAlert, Lock } from 'lucide-react'
import * as api from '../lib/api'
import type { AttendanceAnomaly, AnomalyStatus } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, ATTENDANCE_VIEW_ROLES, OPS_MANAGE_ROLES } from '../lib/permissions'
import { mapLink } from '../lib/geolocation'
import { useToast } from '../dashboard/ToastContext'
import { useT } from '../i18n'

const smallButton =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition disabled:cursor-not-allowed disabled:opacity-60'

/**
 * The manager review queue for two-consecutive-strike GPS audit anomalies (see
 * server/src/lib/attendanceAudit.ts). Viewable by HR too (ATTENDANCE_VIEW_ROLES, same split as
 * Team Attendance) but only Operations decides one.
 */
function AttendanceAnomaliesPage() {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const canView = hasRole(user?.role, ATTENDANCE_VIEW_ROLES)
  const canDecide = hasRole(user?.role, OPS_MANAGE_ROLES)

  const [anomalies, setAnomalies] = useState<AttendanceAnomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    api
      .listAttendanceAnomalies('OPEN')
      .then(({ anomalies }) => setAnomalies(anomalies))
      .catch((err) => setError(err instanceof Error ? err.message : t.ops.anomalies.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (canView) load()
  }, [canView]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!canView) return <EmptyState icon={Lock} message={t.shared.restrictedToHr} />

  async function decide(id: string, status: Exclude<AnomalyStatus, 'OPEN'>) {
    setBusyId(id)
    try {
      await api.decideAttendanceAnomaly(id, { status })
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.anomalies.decideFailed)
    } finally {
      setBusyId(null)
    }
  }

  function checkLabel(audit: AttendanceAnomaly['firstAudit']) {
    const when = new Date(audit.scheduledAt).toLocaleString()
    if (audit.status === 'MISSED') {
      return <>{when} — {t.ops.anomalies.statusMissed}</>
    }
    const distanceText = audit.distanceMeters != null ? `${audit.distanceMeters}m` : '—'
    return (
      <>
        {when} — {t.ops.anomalies.statusOutOfRadius(distanceText)}
        {audit.place && ` · ${audit.place}`}
        {audit.lat && audit.lng && (
          <>
            {' '}
            (
            <a
              href={mapLink(audit.lat, audit.lng)}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-accent hover:underline"
              title={`${audit.lat}, ${audit.lng}`}
            >
              map
            </a>
            )
          </>
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-300">{t.ops.anomalies.subtitle}</p>

      <Panel title={t.ops.anomalies.title} icon={ShieldAlert}>
        {loading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : anomalies.length === 0 ? (
          <EmptyState icon={ShieldAlert} message={t.ops.anomalies.noOpen} />
        ) : (
          <ul className="flex flex-col gap-4">
            {anomalies.map((a) => (
              <li key={a.id} className="rounded-xl border border-ink-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-100">
                    {a.employee.firstName} {a.employee.lastName}
                  </span>
                  <Badge tone={a.severity === 'HIGH' ? 'danger' : 'warning'}>
                    {a.severity === 'HIGH' ? t.ops.anomalies.severityHigh : t.ops.anomalies.severityStandard}
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-ink-400 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-ink-300">{t.ops.anomalies.firstCheck}</dt>
                    <dd>{checkLabel(a.firstAudit)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink-300">{t.ops.anomalies.secondCheck}</dt>
                    <dd>{checkLabel(a.secondAudit)}</dd>
                  </div>
                </dl>
                {canDecide && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => decide(a.id, 'FALSE_POSITIVE')}
                      className={smallButton}
                    >
                      {busyId === a.id ? t.ops.anomalies.deciding : t.ops.anomalies.markFalsePositive}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => decide(a.id, 'CONFIRMED_VIOLATION')}
                      className={`${smallButton} border-red-400/50 text-red-400`}
                    >
                      {busyId === a.id ? t.ops.anomalies.deciding : t.ops.anomalies.confirmViolation}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => decide(a.id, 'DISMISSED')}
                      className={smallButton}
                    >
                      {busyId === a.id ? t.ops.anomalies.deciding : t.ops.anomalies.dismiss}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

export default AttendanceAnomaliesPage
