import { useEffect, useRef, useState } from 'react'
import { Lock, MapPin, Pencil, Trash2 } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as api from '../lib/api'
import type { CustomerSummary, KnownPlace } from '../lib/api'
import { Panel, EmptyState, Modal, TableSkeleton } from '../dashboard/ui'
import { inputClass, labelClass, primaryButtonClass } from '../dashboard/buttonStyles'
import { useAuth } from '../context/AuthContext'
import { hasRole, ATTENDANCE_VIEW_ROLES, OPS_MANAGE_ROLES } from '../lib/permissions'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useT } from '../i18n'

const MAURITIUS: L.LatLngTuple = [-20.25, 57.55]
const smallButton =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition disabled:cursor-not-allowed disabled:opacity-60'

/**
 * Known Places (spec 2026-09-26, section 2): list, rename, merge duplicates, adjust radius and
 * delete, with a Leaflet + OpenStreetMap map of every place and its radius. Places are *created*
 * from the Attendance Anomalies page ("Confirm Genuine" -> save as known place), from a real
 * confirmed check-in, never typed in here - there is no fixed list of sites to set up.
 * Viewable by ATTENDANCE_VIEW_ROLES; changed by OPS_MANAGE_ROLES (server enforces both).
 */
function KnownPlacesPage() {
  const t = useT()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canView = hasRole(user?.role, ATTENDANCE_VIEW_ROLES)
  const canEdit = hasRole(user?.role, OPS_MANAGE_ROLES)

  const [places, setPlaces] = useState<KnownPlace[]>([])
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<KnownPlace | null>(null)
  const [form, setForm] = useState({ name: '', customerId: '', radius: '250' })
  const [busy, setBusy] = useState(false)

  const mapBox = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  function load() {
    setLoading(true)
    api
      .listKnownPlaces()
      .then(({ places }) => {
        setPlaces(places)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : t.ops.knownPlaces.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!canView) return
    load()
    if (canEdit) api.listCustomers().then(({ customers }) => setCustomers(customers)).catch(() => setCustomers([]))
  }, [canView]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canView || !mapBox.current || map.current) return
    const m = L.map(mapBox.current).setView(MAURITIUS, 10)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m)
    map.current = m
    layer.current = L.layerGroup().addTo(m)
    return () => {
      m.remove()
      map.current = null
      layer.current = null
    }
  }, [canView])

  useEffect(() => {
    const m = map.current
    const group = layer.current
    if (!m || !group) return
    group.clearLayers()
    const bounds: L.LatLngTuple[] = []
    for (const p of places) {
      const at: L.LatLngTuple = [Number(p.lat), Number(p.lng)]
      bounds.push(at)
      L.circle(at, { radius: p.radiusMeters, color: '#22d3ee', weight: 2, fillOpacity: 0.12 }).bindTooltip(p.name).addTo(group)
      L.circleMarker(at, { radius: 5, color: '#0b1220', weight: 2, fillColor: '#22d3ee', fillOpacity: 1 }).addTo(group)
    }
    if (bounds.length) m.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 })
  }, [places])

  if (!canView) return <EmptyState icon={Lock} message={t.shared.restrictedToHr} />

  function focus(p: KnownPlace) {
    map.current?.setView([Number(p.lat), Number(p.lng)], 16)
  }

  function openEdit(p: KnownPlace) {
    setEditing(p)
    setForm({ name: p.name, customerId: p.customerId ?? '', radius: String(p.radiusMeters) })
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await action()
      toast.success(success)
      load()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.knownPlaces.actionFailed)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    if (!editing || !form.name.trim()) return
    const ok = await run(
      () => api.updateKnownPlace(editing.id, { name: form.name.trim(), customerId: form.customerId || null, radiusMeters: Number(form.radius) }),
      t.ops.knownPlaces.saved,
    )
    if (ok) setEditing(null)
  }

  async function merge(from: KnownPlace, intoId: string) {
    const into = places.find((p) => p.id === intoId)
    if (!into) return
    const ok = await confirm({ title: t.ops.knownPlaces.mergeTitle, message: t.ops.knownPlaces.mergeMessage(from.name, into.name), confirmLabel: t.ops.knownPlaces.merge })
    if (ok) await run(() => api.mergeKnownPlace(from.id, into.id), t.ops.knownPlaces.merged)
  }

  async function remove(p: KnownPlace) {
    const ok = await confirm({
      title: t.ops.knownPlaces.deleteTitle,
      message: t.ops.knownPlaces.deleteMessage(p.name, p._count.visits),
      confirmLabel: t.ops.knownPlaces.delete,
      tone: 'danger',
    })
    if (ok) await run(() => api.deleteKnownPlace(p.id), t.ops.knownPlaces.deleted)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-300">{t.ops.knownPlaces.subtitle}</p>

      <Panel title={t.ops.knownPlaces.title} icon={MapPin}>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        <div ref={mapBox} className="mb-4 h-72 w-full overflow-hidden rounded-xl border border-ink-800" />

        {loading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : places.length === 0 ? (
          <EmptyState icon={MapPin} message={t.ops.knownPlaces.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-2 font-semibold">{t.ops.knownPlaces.colName}</th>
                  <th className="px-3 py-2 font-semibold">{t.ops.knownPlaces.colClient}</th>
                  <th className="px-3 py-2 font-semibold">{t.ops.knownPlaces.colRadius}</th>
                  <th className="px-3 py-2 font-semibold">{t.ops.knownPlaces.colConfirmed}</th>
                  <th className="px-3 py-2 font-semibold">{t.ops.knownPlaces.colVisits}</th>
                  {canEdit && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {places.map((p) => (
                  <tr key={p.id} className="border-b border-ink-800 align-top last:border-0">
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => focus(p)} className="text-left font-medium text-cyan-accent hover:underline">
                        {p.name}
                      </button>
                      {p.address && <div className="max-w-xs text-xs text-ink-400">{p.address}</div>}
                    </td>
                    <td className="px-3 py-2 text-ink-300">{p.customer ? p.customer.company || p.customer.name : <span className="text-ink-500">{t.ops.knownPlaces.noClient}</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-300">{t.ops.knownPlaces.radiusMeters(p.radiusMeters)}</td>
                    <td className="px-3 py-2 text-ink-300">{p.timesConfirmed}</td>
                    <td className="px-3 py-2 text-ink-300">{p._count.visits}</td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" disabled={busy} onClick={() => openEdit(p)} className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent`}>
                            <Pencil className="h-3.5 w-3.5" />
                            {t.ops.knownPlaces.edit}
                          </button>
                          {places.length > 1 && (
                            <select
                              value=""
                              disabled={busy}
                              onChange={(e) => e.target.value && merge(p, e.target.value)}
                              className="rounded-md border border-ink-600 bg-ink-950 px-2 py-1.5 text-xs text-ink-200"
                            >
                              <option value="">{t.ops.knownPlaces.mergeInto}</option>
                              {places
                                .filter((o) => o.id !== p.id)
                                .map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.name}
                                  </option>
                                ))}
                            </select>
                          )}
                          <button type="button" disabled={busy} onClick={() => remove(p)} className={`${smallButton} hover:border-red-400 hover:text-red-400`}>
                            <Trash2 className="h-3.5 w-3.5" />
                            {t.ops.knownPlaces.delete}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && (
        <Modal title={editing.name} onClose={() => setEditing(null)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>{t.ops.knownPlaces.fieldName}</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={120} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>{t.ops.knownPlaces.fieldClient}</label>
              <select value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))} className={inputClass}>
                <option value="">{t.ops.knownPlaces.noClient}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company || c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>{t.ops.knownPlaces.fieldRadius}</label>
              <input
                type="number"
                inputMode="numeric"
                min={50}
                max={2000}
                value={form.radius}
                onChange={(e) => setForm((f) => ({ ...f, radius: e.target.value }))}
                className={inputClass}
              />
              <p className="text-xs text-ink-400">{t.ops.knownPlaces.radiusHint}</p>
            </div>
            <button type="button" disabled={busy || !form.name.trim()} onClick={saveEdit} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {t.ops.knownPlaces.save}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default KnownPlacesPage
