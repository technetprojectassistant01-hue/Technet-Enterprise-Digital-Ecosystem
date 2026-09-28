import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Map as MapIcon } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as api from '../lib/api'
import type { LiveShift, LiveStatus } from '../lib/api'
import { Panel, Badge, EmptyState } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, ATTENDANCE_VIEW_ROLES } from '../lib/permissions'
import { useT } from '../i18n'

const REFRESH_MS = 15_000
const COLOR: Record<LiveStatus, string> = { GREEN: '#10b981', AMBER: '#f59e0b', RED: '#ef4444' }
const TONE = { GREEN: 'success', AMBER: 'warning', RED: 'danger' } as const
/** Roughly the middle of Mauritius - where the map opens before anyone is on it. */
const MAURITIUS: L.LatLngTuple = [-20.25, 57.55]

/**
 * Live Map (spec 2026-09-26, section 7): every technician on shift now, drawn as their check-in
 * point (hollow) and latest reading (filled), joined by a line, coloured green/amber/red by the
 * server (lib/liveMap.ts), with the on-shift list beside it. Polls every 15 s while the tab is
 * visible. Leaflet + OpenStreetMap, free, same as the anomaly mini map.
 *
 * "Live" only as far as the data is: positions move when a technician's app sends a reading, which
 * happens only while their app is open on screen (lib/useShiftPings.ts). The page says so.
 */
function LiveMapPage() {
  const t = useT()
  const { user } = useAuth()
  const canView = hasRole(user?.role, ATTENDANCE_VIEW_ROLES)

  const [shifts, setShifts] = useState<LiveShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const mapBox = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef(false)

  // Poll while the page is visible; a hidden tab doesn't need to hit the server every 15 s.
  useEffect(() => {
    if (!canView) return
    let cancelled = false
    const load = () => {
      if (document.visibilityState !== 'visible') return
      api
        .getLiveShifts()
        .then(({ shifts }) => {
          if (cancelled) return
          setShifts(shifts)
          setUpdatedAt(new Date())
          setError(null)
        })
        .catch((err) => !cancelled && setError(err instanceof Error ? err.message : t.ops.liveMap.loadFailed))
        .finally(() => !cancelled && setLoading(false))
    }
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    document.addEventListener('visibilitychange', load)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
    }
  }, [canView]) // eslint-disable-line react-hooks/exhaustive-deps

  // Create the map once.
  useEffect(() => {
    if (!canView || !mapBox.current || map.current) return
    const m = L.map(mapBox.current).setView(MAURITIUS, 10)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(m)
    map.current = m
    layer.current = L.layerGroup().addTo(m)
    return () => {
      m.remove()
      map.current = null
      layer.current = null
    }
  }, [canView])

  // Redraw on every refresh. Fit the view only the first time, so a manager's own panning and
  // zooming isn't undone every 15 seconds.
  useEffect(() => {
    const m = map.current
    const group = layer.current
    if (!m || !group) return
    group.clearLayers()
    const points: L.LatLngTuple[] = []
    for (const s of shifts) {
      const color = COLOR[s.status]
      const name = `${s.employee.firstName} ${s.employee.lastName}`
      const checkIn: L.LatLngTuple = [s.checkIn.lat, s.checkIn.lng]
      points.push(checkIn)
      L.circleMarker(checkIn, { radius: 7, color, weight: 3, fillColor: '#0b1220', fillOpacity: 1 })
        .bindTooltip(`${name} · ${t.ops.liveMap.since(new Date(s.checkIn.at).toLocaleTimeString())}`)
        .addTo(group)
      if (s.latest) {
        const latest: L.LatLngTuple = [s.latest.lat, s.latest.lng]
        points.push(latest)
        L.polyline([checkIn, latest], { color, weight: 3, opacity: 0.8 }).addTo(group)
        L.circleMarker(latest, { radius: 8, color: '#0b1220', weight: 2, fillColor: color, fillOpacity: 1 })
          .bindTooltip(`${name} · ${t.ops.liveMap.lastSeen(s.minutesSinceLastFix)}`, { permanent: selected === s.id })
          .addTo(group)
      }
    }
    if (!fitted.current && points.length) {
      m.fitBounds(points, { padding: [32, 32], maxZoom: 15 })
      fitted.current = true
    }
  }, [shifts, selected, t])

  if (!canView) return <EmptyState icon={Lock} message={t.shared.restrictedToHr} />

  function focus(s: LiveShift) {
    setSelected(s.id)
    const target: L.LatLngTuple = s.latest ? [s.latest.lat, s.latest.lng] : [s.checkIn.lat, s.checkIn.lng]
    map.current?.setView(target, 16)
  }

  const distance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-300">{t.ops.liveMap.subtitle}</p>

      <Panel
        title={t.ops.liveMap.title}
        icon={MapIcon}
        badge={!loading ? <Badge tone="accent">{t.ops.liveMap.onShift(shifts.length)}</Badge> : undefined}
        action={updatedAt ? <span className="text-xs text-ink-400">{t.ops.liveMap.updated(updatedAt.toLocaleTimeString())}</span> : undefined}
      >
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-2">
            {/* Kept mounted even while loading so the Leaflet map is created once. */}
            <div ref={mapBox} className="h-[28rem] w-full overflow-hidden rounded-xl border border-ink-800" />
            <p className="text-[11px] text-ink-500">{t.ops.liveMap.legend}</p>
            <p className="text-[11px] text-ink-500">{t.ops.liveMap.backgroundNote}</p>
          </div>

          <div className="flex flex-col gap-2">
            {!loading && shifts.length === 0 ? (
              <EmptyState icon={MapIcon} message={t.ops.liveMap.none} />
            ) : (
              <ul className="flex max-h-[30rem] flex-col gap-2 overflow-y-auto">
                {shifts.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => focus(s)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition hover:bg-ink-800 ${
                        selected === s.id ? 'border-cyan-accent' : 'border-ink-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink-100">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR[s.status] }} />
                          {s.employee.firstName} {s.employee.lastName}
                        </span>
                        <Badge tone={TONE[s.status]}>{t.ops.liveMap.status[s.status]}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-ink-400">
                        {t.ops.liveMap.since(new Date(s.checkIn.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
                        {s.knownPlace
                          ? ` · ✓ ${s.knownPlace.name}`
                          : (s.checkIn.site || s.checkIn.place) && ` · ${s.checkIn.site ?? s.checkIn.place}`}
                      </div>
                      <div className="text-xs text-ink-400">
                        {s.latest ? t.ops.liveMap.lastSeen(s.minutesSinceLastFix) : t.ops.liveMap.notSeenSinceCheckIn}
                        {s.distanceFromCheckInMeters !== null && ` · ${distance(s.distanceFromCheckInMeters)}`}
                      </div>
                      {s.workOrder && (
                        <div className="truncate text-xs text-ink-400">
                          {s.workOrder.workOrderNumber} — {s.workOrder.title}
                        </div>
                      )}
                    </button>
                    {s.openAnomalies > 0 && (
                      <Link
                        to={`/dashboard/operations/anomalies?siteAttendanceId=${s.id}`}
                        className="mt-1 block px-3 text-xs font-medium text-amber-400 hover:underline"
                      >
                        ⚠ {t.ops.liveMap.openAnomalies(s.openAnomalies)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Panel>
    </div>
  )
}

export default LiveMapPage
