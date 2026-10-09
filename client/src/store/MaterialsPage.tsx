import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Boxes, PackagePlus, ClipboardCheck, History, Search, TriangleAlert, PackageCheck } from 'lucide-react'
import * as api from '../lib/api'
import type { Material, MaterialMovement, MyMaterial } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, TOOL_MANAGE_ROLES } from '../lib/permissions'
import { useT } from '../i18n'
import { dayOf } from './toolTones'
import PageTitle from '../dashboard/PageTitle'

const smallButton =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition'

interface MaterialForm {
  name: string
  reference: string
  category: string
  unit: string
  quantity: string
  minStock: string
  location: string
  notes: string
}
const emptyForm: MaterialForm = { name: '', reference: '', category: '', unit: 'unit', quantity: '', minStock: '', location: '', notes: '' }

/**
 * Technet Store → Materials (2026-10-09, user request): the store's register of consumables kept by
 * quantity - separate from ERP Inventory (the user's choice) - plus "Materials I Have", what the
 * store issued to the signed-in person. Everyone sees it; Admin/Storekeeper add materials, add stock,
 * correct counts, see the history and delete never-issued ones. Stock goes down when a material
 * request is issued against a material (Material Requests → Issue).
 */
function MaterialsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const t = useT()
  const m = t.materials
  const { user } = useAuth()
  const canManage = hasRole(user?.role, TOOL_MANAGE_ROLES)

  const [materials, setMaterials] = useState<Material[]>([])
  const [mine, setMine] = useState<MyMaterial[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [busy, setBusy] = useState(false)

  const [editing, setEditing] = useState<Material | 'new' | null>(null)
  const [form, setForm] = useState<MaterialForm>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)

  const [stock, setStock] = useState<{ material: Material; type: 'IN' | 'ADJUST' } | null>(null)
  const [stockQty, setStockQty] = useState('')
  const [stockReason, setStockReason] = useState('')
  const [stockError, setStockError] = useState<string | null>(null)

  const [history, setHistory] = useState<{ material: Material; movements: MaterialMovement[] | null } | null>(null)

  function load() {
    setLoading(true)
    api
      .listMaterials()
      .then(({ materials }) => setMaterials(materials))
      .catch((err) => setError(err instanceof Error ? err.message : m.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user?.employeeId) return
    api
      .listMyMaterials()
      .then(({ items }) => setMine(items))
      .catch(() => setMine([]))
  }, [user?.employeeId])

  function openNew() {
    setEditing('new')
    setForm(emptyForm)
    setFormError(null)
  }

  function openEdit(mat: Material) {
    setEditing(mat)
    setForm({
      name: mat.name,
      reference: mat.reference ?? '',
      category: mat.category ?? '',
      unit: mat.unit,
      quantity: '',
      minStock: mat.minStock ? String(mat.minStock) : '',
      location: mat.location ?? '',
      notes: mat.notes ?? '',
    })
    setFormError(null)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setFormError(null)
    if (!form.name.trim()) return setFormError(t.materials.name)
    setBusy(true)
    try {
      const input: api.MaterialInput = {
        name: form.name.trim(),
        reference: form.reference.trim() || undefined,
        category: form.category.trim() || undefined,
        unit: form.unit.trim() || 'unit',
        minStock: form.minStock.trim() ? Number(form.minStock) : 0,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      if (editing === 'new') await api.createMaterial({ ...input, quantity: form.quantity.trim() ? Number(form.quantity) : 0 })
      else await api.updateMaterial(editing.id, input)
      toast.success(m.saved)
      setEditing(null)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : m.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  async function handleStock(e: FormEvent) {
    e.preventDefault()
    if (!stock) return
    setStockError(null)
    setBusy(true)
    try {
      await api.changeMaterialStock(stock.material.id, { type: stock.type, quantity: Number(stockQty), reason: stockReason.trim() || undefined })
      toast.success(m.stockSaved)
      setStock(null)
      load()
    } catch (err) {
      setStockError(err instanceof Error ? err.message : m.stockFailed)
    } finally {
      setBusy(false)
    }
  }

  function openHistory(mat: Material) {
    setHistory({ material: mat, movements: null })
    api
      .getMaterialMovements(mat.id)
      .then(({ movements }) => setHistory({ material: mat, movements }))
      .catch(() => setHistory({ material: mat, movements: [] }))
  }

  async function handleDelete(mat: Material) {
    const ok = await confirm({ title: m.deleteTitle, message: m.deleteMessage(mat.name), confirmLabel: t.shared.delete, tone: 'danger' })
    if (!ok) return
    try {
      await api.deleteMaterial(mat.id)
      toast.success(m.deleted)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.deleteFailed)
    }
  }

  const term = search.trim().toLowerCase()
  const shown = materials.filter((mat) => {
    if (lowOnly && !mat.lowStock) return false
    if (!term) return true
    return `${mat.materialNumber} ${mat.name} ${mat.reference ?? ''} ${mat.category ?? ''} ${mat.location ?? ''}`.toLowerCase().includes(term)
  })
  const lowCount = materials.filter((mat) => mat.lowStock).length
  const field = (key: keyof MaterialForm) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle icon={Boxes} title={t.nav.Materials} subtitle={m.subtitle} />
        {canManage && (
          <button type="button" onClick={openNew} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            {m.add}
          </button>
        )}
      </div>

      {user?.employeeId && (
        <Panel title={m.mine}>
          {mine === null ? (
            <TableSkeleton rows={2} cols={4} />
          ) : mine.length === 0 ? (
            <p className="text-sm text-ink-300">{m.mineEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                    <th className="px-3 py-2 font-semibold">{m.colName}</th>
                    <th className="px-3 py-2 font-semibold">{m.colReference}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t.materialRequests.quantity}</th>
                    <th className="px-3 py-2 font-semibold">{m.colRequest}</th>
                    <th className="px-3 py-2 font-semibold">{m.colIssued}</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((i) => (
                    <tr key={i.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-2 text-ink-100">
                        <PackageCheck className="mr-1.5 inline h-3.5 w-3.5 text-cyan-accent" />
                        {i.material?.name ?? i.description}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-300">{i.reference ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-ink-100">
                        {i.quantity} {i.material?.unit ?? ''}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-300">{i.requestNumber}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-300">{i.issuedAt ? dayOf(i.issuedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
        <StatCard label={m.statTotal} value={loading ? '—' : materials.length} icon={Boxes} />
        <StatCard label={m.statLow} value={loading ? '—' : lowCount} icon={TriangleAlert} />
        {user?.employeeId && <StatCard label={m.statMine} value={mine === null ? '—' : mine.length} icon={PackageCheck} />}
      </div>

      <Panel title={m.register}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
            <label className={labelClass}>{t.tools.search}</label>
            <div className="flex items-center gap-2 rounded-md border border-ink-600 bg-ink-950 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={m.searchPlaceholder}
                className="w-full bg-transparent text-sm text-ink-100 outline-none placeholder-ink-500"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink-300">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
              className="h-4 w-4 rounded border-ink-600 bg-ink-950 text-cyan-accent"
            />
            {m.lowOnly}
          </label>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Boxes} message={materials.length === 0 ? m.empty : m.emptyFiltered} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{m.colNumber}</th>
                  <th className="px-3 py-3 font-semibold">{m.colName}</th>
                  <th className="px-3 py-3 font-semibold">{m.colReference}</th>
                  <th className="px-3 py-3 font-semibold">{m.colCategory}</th>
                  <th className="px-3 py-3 text-right font-semibold">{m.colStock}</th>
                  <th className="px-3 py-3 text-right font-semibold">{m.colMin}</th>
                  <th className="px-3 py-3 font-semibold">{m.colLocation}</th>
                  {canManage && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {shown.map((mat) => (
                  <tr key={mat.id} className="border-b border-ink-800 align-top last:border-0">
                    <td className="px-3 py-3 font-mono font-medium text-ink-100">{mat.materialNumber}</td>
                    <td className="px-3 py-3 text-ink-100">
                      {mat.name}
                      {mat.notes && <div className="mt-0.5 text-xs text-ink-400">{mat.notes}</div>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-ink-300">{mat.reference ?? '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{mat.category ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <span className={mat.lowStock ? 'font-semibold text-amber-400' : 'text-ink-100'}>
                        {mat.quantity} {mat.unit}
                      </span>
                      {mat.lowStock && (
                        <span className="ml-2">
                          <Badge tone="warning">{m.low}</Badge>
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-ink-300">{mat.minStock ? `${mat.minStock} ${mat.unit}` : '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{mat.location ?? '—'}</td>
                    {canManage && (
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setStock({ material: mat, type: 'IN' })
                              setStockQty('')
                              setStockReason('')
                              setStockError(null)
                            }}
                            className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent`}
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                            {m.addStock}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStock({ material: mat, type: 'ADJUST' })
                              setStockQty(String(mat.quantity))
                              setStockReason('')
                              setStockError(null)
                            }}
                            className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent`}
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            {m.correctCount}
                          </button>
                          <button type="button" onClick={() => openHistory(mat)} className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent`}>
                            <History className="h-3.5 w-3.5" />
                            {m.history}
                          </button>
                          <button type="button" onClick={() => openEdit(mat)} className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent`}>
                            <Pencil className="h-3.5 w-3.5" />
                            {t.toolRequests.edit}
                          </button>
                          <button type="button" onClick={() => handleDelete(mat)} className={`${smallButton} hover:border-red-400 hover:text-red-400`}>
                            <Trash2 className="h-3.5 w-3.5" />
                            {t.shared.delete}
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
        <Modal title={editing === 'new' ? m.addTitle : m.editTitle(editing.materialNumber)} size="lg" onClose={() => setEditing(null)}>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className={labelClass}>{m.name}</span>
                <input {...field('name')} placeholder={m.namePlaceholder} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>{m.reference}</span>
                <input {...field('reference')} placeholder={m.referencePlaceholder} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>{m.category}</span>
                <input {...field('category')} placeholder={m.categoryPlaceholder} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>{m.unit}</span>
                <input {...field('unit')} placeholder={m.unitPlaceholder} className={inputClass} />
              </label>
              {editing === 'new' && (
                <label className="flex flex-col gap-1">
                  <span className={labelClass}>{m.openingStock}</span>
                  <input type="number" inputMode="decimal" min="0" step="0.01" {...field('quantity')} className={inputClass} />
                </label>
              )}
              <label className="flex flex-col gap-1">
                <span className={labelClass}>{m.minStock}</span>
                <input type="number" inputMode="decimal" min="0" step="0.01" {...field('minStock')} className={inputClass} />
                <span className="text-xs text-ink-400">{m.minStockHint}</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>{m.location}</span>
                <input {...field('location')} placeholder={m.locationPlaceholder} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className={labelClass}>{m.notes}</span>
                <input {...field('notes')} className={inputClass} />
              </label>
            </div>
            {formError && <p className="text-sm text-red-400">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={secondaryButtonClass}>
                {t.common.cancel}
              </button>
              <button type="submit" disabled={busy} className={primaryButtonClass}>
                {busy ? t.shared.saving : t.shared.saveChanges}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {stock && (
        <Modal title={stock.type === 'IN' ? m.addStockTitle(stock.material.name) : m.correctTitle(stock.material.name)} onClose={() => setStock(null)}>
          <form onSubmit={handleStock} className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">{m.currentStock(stock.material.quantity, stock.material.unit)}</p>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{stock.type === 'IN' ? m.quantityToAdd : m.countedStock}</span>
              <input
                type="number"
                inputMode="decimal"
                min={stock.type === 'IN' ? '0.01' : '0'}
                step="0.01"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className={inputClass}
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{m.reason}</span>
              <input
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
                placeholder={stock.type === 'IN' ? m.reasonInPlaceholder : m.reasonAdjustPlaceholder}
                className={inputClass}
              />
            </label>
            {stockError && <p className="text-sm text-red-400">{stockError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setStock(null)} className={secondaryButtonClass}>
                {t.common.cancel}
              </button>
              <button type="submit" disabled={busy || stockQty.trim() === ''} className={primaryButtonClass}>
                {busy ? t.shared.saving : t.shared.saveChanges}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {history && (
        <Modal title={m.historyTitle(history.material.name)} size="lg" onClose={() => setHistory(null)}>
          {history.movements === null ? (
            <TableSkeleton rows={3} cols={5} />
          ) : history.movements.length === 0 ? (
            <p className="text-sm text-ink-300">{m.historyEmpty}</p>
          ) : (
            <div className="overflow-auto rounded-lg border border-ink-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                    <th className="px-3 py-2 font-semibold">{t.shared.date}</th>
                    <th className="px-3 py-2 font-semibold">{t.shared.type}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t.materialRequests.quantity}</th>
                    <th className="px-3 py-2 text-right font-semibold">{m.balance}</th>
                    <th className="px-3 py-2 font-semibold">{m.reason.replace(/ \(.*\)$/, '')}</th>
                    <th className="px-3 py-2 font-semibold">{m.by}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.movements.map((mv) => (
                    <tr key={mv.id} className="border-b border-ink-800 last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 text-ink-300">{new Date(mv.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-ink-100">{m.movement[mv.type]}</td>
                      <td className={`px-3 py-2 text-right font-medium ${mv.type === 'OUT' || mv.quantity < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {mv.type === 'OUT' ? `−${mv.quantity}` : mv.quantity > 0 ? `+${mv.quantity}` : mv.quantity}
                      </td>
                      <td className="px-3 py-2 text-right text-ink-100">{mv.balanceAfter}</td>
                      <td className="px-3 py-2 text-ink-300">
                        {mv.request ? `${mv.request.requestNumber} · ${mv.request.employee}` : (mv.reason ?? '—')}
                      </td>
                      <td className="px-3 py-2 text-ink-300">{mv.createdBy.name ?? mv.createdBy.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

export default MaterialsPage
