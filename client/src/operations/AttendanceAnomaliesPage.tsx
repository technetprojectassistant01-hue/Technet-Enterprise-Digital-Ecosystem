import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Briefcase, Lock, RotateCcw, ShieldAlert } from 'lucide-react'
import * as api from '../lib/api'
import { ACTIVE_ANOMALY_TYPES } from '../lib/api'
import type { AnomalyFilters, AnomalySeverity, AnomalyStatus, AttendanceAnomaly } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, ATTENDANCE_VIEW_ROLES, OPS_MANAGE_ROLES } from '../lib/permissions'
import { mapLink } from '../lib/geolocation'
import { useToast } from '../dashboard/ToastContext'
import { useEmployees } from '../erp/useEmployees'
import { useT } from '../i18n'
import AnomalyMiniMap from './AnomalyMiniMap'
import SavePlaceDialog from './SavePlaceDialog'

const smallButton =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition disabled:cursor-not-allowed disabled:opacity-60'
const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const STATUSES: AnomalyStatus[] = ['OPEN', 'GENUINE', 'CONFIRMED_VIOLATION', 'FALSE_POSITIVE', 'DISMISSED']
const SEVERITIES = ['HIGH', 'MEDIUM', 'LOW'] as const
const FILTER_KEYS = ['status', 'type', 'severity', 'employeeId', 'siteAttendanceId', 'from', 'to'] as const

const severityTone = (s: AnomalySeverity) => (s === 'HIGH' ? 'danger' : s === 'LOW' ? 'neutral' : 'warning')
const statusTone = (s: AnomalyStatus) =>
  s === 'OPEN' ? 'warning' : s === 'CONFIRMED_VIOLATION' ? 'danger' : s === 'GENUINE' ? 'success' : 'neutral'

/**
 * The review queue for attendance anomalies (spec 2026-09-26, section 6) - both the original
 * two-strike audit anomalies and the per-visit rules in server/src/lib/anomalyRules.ts. Viewable
 * by HR (ATTENDANCE_VIEW_ROLES, same split as Team Attendance); only Operations decides. Filters
 * live in the URL, so the register's badge, the overtime warning and the validation block can all
 * link straight to the anomalies they mean.
 *
 * "Save as known place" from the spec comes with known places (section 2) - not built yet.
 */
function AttendanceAnomaliesPage() {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const canView = hasRole(user?.role, ATTENDANCE_VIEW_ROLES)
  const canDecide = hasRole(user?.role, OPS_MANAGE_ROLES)
  const employees = useEmployees()
  const [params, setParams] = useSearchParams()

  // No filters in the URL at all means the default queue: everything still open.
  const filters: AnomalyFilters = {}
  for (const key of FILTER_KEYS) {
    const value = params.get(key)
    if (value) (filters as Record<string, string>)[key] = value
  }
  if (!params.toString()) filters.status = 'OPEN'
  const filterKey = JSON.stringify(filters)

  const [anomalies, setAnomalies] = useState<AttendanceAnomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  /** "Confirm Genuine" on a visit's anomaly opens the save-as-known-place dialog (spec section 2). */
  const [savingPlaceFor, setSavingPlaceFor] = useState<AttendanceAnomaly | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    api
      .listAttendanceAnomalies(filters)
      .then(({ anomalies }) => setAnomalies(anomalies))
      .catch((err) => setError(err instanceof Error ? err.message : t.ops.anomalies.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (canView) load()
  }, [canView, filterKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!canView) return <EmptyState icon={Lock} message={t.shared.restrictedToHr} />

  function setFilter(key: (typeof FILTER_KEYS)[number], value: string) {
    const next = new URLSearchParams(params)
    // Changing any filter away from the default keeps the default status explicit, so clearing
    // "status" really shows every status rather than snapping back to OPEN.
    if (!params.toString() && key !== 'status') next.set('status', 'OPEN')
    if (value) next.set(key, value)
    else next.delete(key)
    // An empty "status=" keeps the URL non-empty, so "all statuses" isn't read as the default queue.
    if (!next.toString()) next.set('status', '')
    setParams(next, { replace: true })
  }

  async function run(id: string, action: () => Promise<unknown>, success: string) {
    setBusyId(id)
    try {
      await action()
      toast.success(success)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.anomalies.decideFailed)
    } finally {
      setBusyId(null)
    }
  }

  const decide = (a: AttendanceAnomaly, status: Exclude<AnomalyStatus, 'OPEN'>) =>
    run(a.id, () => api.decideAttendanceAnomaly(a.id, { status, note: notes[a.id]?.trim() || undefined }), t.ops.anomalies.decided)

  const severityLabel = (s: AnomalySeverity) =>
    s === 'HIGH' ? t.ops.anomalies.severityHigh : s === 'LOW' ? t.ops.anomalies.severityLow : t.ops.anomalies.severityMedium
  const when = (iso: string) =>
    new Date(iso).toLocaleString(t.shared.dateLocale, { timeZone: 'Indian/Mauritius', dateStyle: 'medium', timeStyle: 'short' })

  /** One human line for the newest finding, per type. */
  function findingLine(a: AttendanceAnomaly): string | null {
    const d = (a.details?.latest ?? {}) as Record<string, unknown>
    const num = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : null)
    switch (a.type) {
      case 'FAR_FROM_JOB':
      case 'LEFT_WORK_AREA':
      case 'CHECKIN_NEAR_HOME':
      case 'STATED_LOCATION_MISMATCH':
        return num('distanceMeters') !== null ? t.ops.anomalies.distanceMeters(num('distanceMeters')!) : null
      case 'LOW_ACCURACY':
        return num('accuracyMeters') !== null ? t.ops.anomalies.accuracyMeters(num('accuracyMeters')!) : null
      case 'TIME_MISMATCH':
        return num('gapMinutes') !== null ? `${String(d.typed ?? '')} · ${t.ops.anomalies.gapMinutes(num('gapMinutes')!)}` : null
      case 'MISSED_PING':
        return num('minutes') !== null ? t.ops.anomalies.missedPing(num('minutes')!) : null
      case 'CLOCK_SKEW':
        return num('skewMinutes') !== null ? t.ops.anomalies.skewMinutes(num('skewMinutes')!) : null
      case 'IMPOSSIBLE_TRAVEL':
        return num('distanceMeters') !== null
          ? `${t.ops.anomalies.distanceMeters(num('distanceMeters')!)} · ${t.ops.anomalies.speed(num('speedKmh'), num('minutes') ?? 0)}`
          : null
      case 'MOCK_LOCATION_SUSPECTED':
        return d.reason === 'ZERO_ACCURACY'
          ? t.ops.anomalies.reasonZeroAccuracy
          : d.reason === 'IDENTICAL_FIXES'
            ? t.ops.anomalies.reasonIdentical(num('count') ?? 5)
            : d.reason === 'JUMP_AND_BACK'
              ? t.ops.anomalies.reasonJump
              : null
      default:
        return null
    }
  }

  function auditLine(audit: NonNullable<AttendanceAnomaly['firstAudit']>) {
    const at = when(audit.scheduledAt)
    if (audit.status === 'MISSED') return <>{at} — {t.ops.anomalies.statusMissed}</>
    const distanceText = audit.distanceMeters != null ? `${audit.distanceMeters}m` : '—'
    return (
      <>
        {at} — {t.ops.anomalies.statusOutOfRadius(distanceText)}
        {audit.place && ` · ${audit.place}`}
        {audit.lat && audit.lng && (
          <>
            {' '}
            (
            <a href={mapLink(audit.lat, audit.lng)} target="_blank" rel="noreferrer" className="text-cyan-accent hover:underline">
              map
            </a>
            )
          </>
        )}
      </>
    )
  }

  const filterRow = (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className={labelClass}>{t.ops.anomalies.filterStatus}</label>
        <select value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className={inputClass}>
          <option value="">{t.ops.anomalies.allStatuses}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.ops.anomalies.statuses[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>{t.ops.anomalies.filterType}</label>
        <select value={filters.type ?? ''} onChange={(e) => setFilter('type', e.target.value)} className={inputClass}>
          <option value="">{t.ops.anomalies.allTypes}</option>
          {ACTIVE_ANOMALY_TYPES.map((type) => (
            <option key={type} value={type}>
              {t.ops.anomalies.types[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>{t.ops.anomalies.filterSeverity}</label>
        <select value={filters.severity ?? ''} onChange={(e) => setFilter('severity', e.target.value)} className={inputClass}>
          <option value="">{t.ops.anomalies.allSeverities}</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {severityLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>{t.ops.anomalies.filterEmployee}</label>
        <select value={filters.employeeId ?? ''} onChange={(e) => setFilter('employeeId', e.target.value)} className={inputClass}>
          <option value="">{t.ops.anomalies.allEmployees}</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>{t.ops.anomalies.filterFrom}</label>
        <input type="date" value={filters.from ?? ''} onChange={(e) => setFilter('from', e.target.value)} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>{t.ops.anomalies.filterTo}</label>
        <input type="date" value={filters.to ?? ''} onChange={(e) => setFilter('to', e.target.value)} className={inputClass} />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-300">{t.ops.anomalies.subtitle}</p>

      <Panel title={t.ops.anomalies.title} icon={ShieldAlert}>
        {filterRow}

        {filters.siteAttendanceId && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-300">
            {t.ops.anomalies.oneVisit}
            <button type="button" onClick={() => setFilter('siteAttendanceId', '')} className="font-semibold text-cyan-accent hover:underline">
              {t.ops.anomalies.showAll}
            </button>
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : anomalies.length === 0 ? (
          <EmptyState icon={ShieldAlert} message={filters.status === 'OPEN' && Object.keys(filters).length === 1 ? t.ops.anomalies.noOpen : t.ops.anomalies.noMatch} />
        ) : (
          <ul className="flex flex-col gap-4">
            {anomalies.map((a) => {
              const v = a.siteAttendance
              const busy = busyId === a.id
              const line = findingLine(a)
              return (
                <li key={a.id} className="rounded-xl border border-ink-800 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink-100">
                        {a.employee.firstName} {a.employee.lastName}
                      </span>
                      <span className="text-sm text-ink-300">· {t.ops.anomalies.types[a.type]}</span>
                      {a.occurrenceCount > 1 && <span className="text-xs text-ink-400">({t.ops.anomalies.occurrences(a.occurrenceCount)})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={severityTone(a.severity)}>{severityLabel(a.severity)}</Badge>
                      <Badge tone={statusTone(a.status)}>{t.ops.anomalies.statuses[a.status]}</Badge>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-ink-400">
                    {when(v?.checkInAt ?? a.createdAt)}
                    {line && <span className="font-medium text-amber-300"> · {line}</span>}
                  </div>

                  {a.firstAudit && a.secondAudit && (
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-ink-400 sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-ink-300">{t.ops.anomalies.firstCheck}</dt>
                        <dd>{auditLine(a.firstAudit)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink-300">{t.ops.anomalies.secondCheck}</dt>
                        <dd>{auditLine(a.secondAudit)}</dd>
                      </div>
                    </dl>
                  )}

                  {v && (
                    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
                      <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="font-semibold text-ink-300">{t.ops.anomalies.checkIn}</dt>
                          <dd className="mt-0.5 text-ink-400">
                            <span className="text-ink-300">{t.ops.anomalies.stated}:</span>{' '}
                            {[v.checkInSite, v.checkInNote].filter(Boolean).join(' — ') || '—'}
                            {v.checkInDeclaredTime && ` · ${v.checkInDeclaredTime}`}
                          </dd>
                          <dd className="text-ink-400">
                            <span className="text-ink-300">{t.ops.anomalies.gps}:</span>{' '}
                            <a href={mapLink(v.checkInLat, v.checkInLng)} target="_blank" rel="noreferrer" className="text-cyan-accent hover:underline">
                              {v.checkInPlace ?? `${Number(v.checkInLat).toFixed(5)}, ${Number(v.checkInLng).toFixed(5)}`}
                            </a>
                            {v.checkInAccuracyMeters !== null && ` · ${t.ops.anomalies.accuracyMeters(v.checkInAccuracyMeters)}`}
                          </dd>
                          {v.knownPlace && (
                            <dd className="text-emerald-400">
                              <span className="text-ink-300">{t.ops.anomalies.knownPlace}:</span> {v.knownPlace.name}
                            </dd>
                          )}
                        </div>
                        {v.checkOutAt && (
                          <div>
                            <dt className="font-semibold text-ink-300">{t.ops.anomalies.checkOut}</dt>
                            <dd className="mt-0.5 text-ink-400">
                              <span className="text-ink-300">{t.ops.anomalies.stated}:</span> {v.checkOutNote || '—'}
                              {v.checkOutDeclaredTime && ` · ${v.checkOutDeclaredTime}`}
                            </dd>
                            {v.checkOutLat && v.checkOutLng && (
                              <dd className="text-ink-400">
                                <span className="text-ink-300">{t.ops.anomalies.gps}:</span>{' '}
                                <a href={mapLink(v.checkOutLat, v.checkOutLng)} target="_blank" rel="noreferrer" className="text-cyan-accent hover:underline">
                                  {v.checkOutPlace ?? `${Number(v.checkOutLat).toFixed(5)}, ${Number(v.checkOutLng).toFixed(5)}`}
                                </a>
                                {v.checkOutAccuracyMeters !== null && ` · ${t.ops.anomalies.accuracyMeters(v.checkOutAccuracyMeters)}`}
                              </dd>
                            )}
                          </div>
                        )}
                        {v.workOrder && (
                          <div>
                            <dt className="font-semibold text-ink-300">{t.ops.anomalies.job}</dt>
                            <dd className="mt-0.5 flex items-center gap-1.5 text-ink-400">
                              <Briefcase className="h-3.5 w-3.5 text-cyan-accent" />
                              {v.workOrder.workOrderNumber} — {v.workOrder.title}
                            </dd>
                            {v.workOrder.siteAddress && <dd className="text-ink-400">{v.workOrder.siteAddress}</dd>}
                          </div>
                        )}
                        {v.checkInPhoto && (
                          <div>
                            <dt className="font-semibold text-ink-300">{t.ops.anomalies.photo}</dt>
                            <dd className="mt-1">
                              <a href={api.siteAttendancePhotoUrl(v.id)} target="_blank" rel="noreferrer">
                                <img
                                  src={api.siteAttendancePhotoUrl(v.id)}
                                  alt={t.ops.anomalies.photo}
                                  className="h-24 w-24 rounded-lg object-cover"
                                  loading="lazy"
                                />
                              </a>
                            </dd>
                          </div>
                        )}
                      </dl>
                      <div className="flex flex-col gap-1">
                        <AnomalyMiniMap visit={v} />
                        <span className="text-[11px] text-ink-500">{t.ops.anomalies.mapLegend}</span>
                      </div>
                    </div>
                  )}

                  {a.status !== 'OPEN' && (
                    <div className="mt-3 text-xs text-ink-400">
                      {a.resolvedBy && t.ops.anomalies.decidedBy(a.resolvedBy.name)}
                      {a.resolvedAt && ` · ${when(a.resolvedAt)}`}
                      {a.resolutionNote && <div className="mt-0.5 text-ink-300">“{a.resolutionNote}”</div>}
                    </div>
                  )}

                  {canDecide &&
                    (a.status === 'OPEN' ? (
                      <div className="mt-4 flex flex-col gap-2">
                        <input
                          value={notes[a.id] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                          placeholder={t.ops.anomalies.notePlaceholder}
                          maxLength={500}
                          className={`${inputClass} w-full sm:max-w-md`}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => (a.siteAttendance ? setSavingPlaceFor(a) : decide(a, 'GENUINE'))}
                            className={`${smallButton} border-emerald-400/50 text-emerald-400`}
                          >
                            {busy ? t.ops.anomalies.deciding : t.ops.anomalies.confirmGenuine}
                          </button>
                          <button type="button" disabled={busy} onClick={() => decide(a, 'FALSE_POSITIVE')} className={smallButton}>
                            {busy ? t.ops.anomalies.deciding : t.ops.anomalies.markFalsePositive}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => decide(a, 'CONFIRMED_VIOLATION')}
                            className={`${smallButton} border-red-400/50 text-red-400`}
                          >
                            {busy ? t.ops.anomalies.deciding : t.ops.anomalies.confirmViolation}
                          </button>
                          <button type="button" disabled={busy} onClick={() => decide(a, 'DISMISSED')} className={smallButton}>
                            {busy ? t.ops.anomalies.deciding : t.ops.anomalies.dismiss}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(a.id, () => api.reopenAttendanceAnomaly(a.id), t.ops.anomalies.reopened)}
                          className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {t.ops.anomalies.undo}
                        </button>
                      </div>
                    ))}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {savingPlaceFor && (
        <SavePlaceDialog
          anomaly={savingPlaceFor}
          note={notes[savingPlaceFor.id] ?? ''}
          onClose={() => setSavingPlaceFor(null)}
          onDone={() => {
            setSavingPlaceFor(null)
            load()
          }}
        />
      )}
    </div>
  )
}

export default AttendanceAnomaliesPage
