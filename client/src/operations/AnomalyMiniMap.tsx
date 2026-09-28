import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { AnomalyVisit } from '../lib/api'

/**
 * A small Leaflet + OpenStreetMap map for one anomaly's visit: check-in, answered compliance
 * checks, 15-minute shift pings, check-out, joined by a line in time order, plus the job site when
 * the visit is linked to one. Free, no API key - the same reasoning as Nominatim (CLAUDE.md §7b).
 * OpenStreetMap's tile policy asks for attribution and light use; a handful of review cards is.
 *
 * Plain circle markers rather than Leaflet's default pin images, which a bundler doesn't resolve
 * without extra configuration.
 */
function AnomalyMiniMap({ visit }: { visit: AnomalyVisit }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return
    const map = L.map(container.current, { scrollWheelZoom: false, attributionControl: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    const point = (lat: string | null, lng: string | null): L.LatLngTuple | null =>
      lat !== null && lng !== null ? [Number(lat), Number(lng)] : null

    const path: L.LatLngTuple[] = []
    const add = (at: L.LatLngTuple | null, color: string, label: string) => {
      if (!at) return
      path.push(at)
      L.circleMarker(at, { radius: 7, color: '#0b1220', weight: 2, fillColor: color, fillOpacity: 1 }).bindTooltip(label).addTo(map)
    }

    add(point(visit.checkInLat, visit.checkInLng), '#22d3ee', `Check-in ${new Date(visit.checkInAt).toLocaleTimeString()}`)
    // Compliance checks (amber) and 15-minute shift pings (violet), merged in time order so the
    // dashed line follows the shift as it happened.
    const during = [
      ...visit.audits.map((a) => ({ at: a.respondedAt, lat: a.lat, lng: a.lng, color: '#f59e0b', label: 'Compliance check' })),
      ...(visit.pings ?? []).map((p) => ({ at: p.createdAt, lat: p.lat, lng: p.lng, color: '#a78bfa', label: 'Location ping' })),
    ].sort((a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime())
    for (const d of during) {
      add(point(d.lat, d.lng), d.color, `${d.label} ${d.at ? new Date(d.at).toLocaleTimeString() : ''}`)
    }
    if (visit.checkOutAt) add(point(visit.checkOutLat, visit.checkOutLng), '#94a3b8', `Check-out ${new Date(visit.checkOutAt).toLocaleTimeString()}`)
    if (path.length > 1) L.polyline(path, { color: '#64748b', weight: 2, dashArray: '4 4' }).addTo(map)

    const job = visit.workOrder ? point(visit.workOrder.siteLat, visit.workOrder.siteLng) : null
    const bounds = [...path]
    if (job) {
      // 500 m ring: the far-from-job threshold, so a reviewer sees at a glance how far outside it was.
      L.circle(job, { radius: 500, color: '#10b981', weight: 2, fillOpacity: 0.08 }).bindTooltip(visit.workOrder!.workOrderNumber).addTo(map)
      bounds.push(job)
    }

    if (bounds.length === 1) map.setView(bounds[0], 16)
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 })

    return () => {
      map.remove()
    }
  }, [visit])

  return <div ref={container} className="h-48 w-full overflow-hidden rounded-lg border border-ink-800" />
}

export default AnomalyMiniMap
