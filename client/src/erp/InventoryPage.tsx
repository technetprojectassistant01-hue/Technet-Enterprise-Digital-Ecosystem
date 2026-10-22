import { useEffect, useState, type FormEvent } from 'react'
import { Search, Plus, Pencil, Trash2, ArrowUpDown, PackageSearch, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { InventoryItem, MovementType } from '../lib/api'
import { Panel, StatCard, Modal, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, PROCUREMENT_ROLES } from '../lib/permissions'
import { formatMoney } from '../lib/format'
import { useT } from '../i18n'
import { useFormDraft } from '../lib/useFormDraft'
import { DraftNotice } from '../dashboard/DraftNotice'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

interface ItemFormState {
  sku: string
  name: string
  category: string
  unitOfMeasure: string
  quantity: string
  minStockLevel: string
  unitCost: string
  location: string
}

const EMPTY_FORM: ItemFormState = {
  sku: '',
  name: '',
  category: '',
  unitOfMeasure: 'unit',
  quantity: '0',
  minStockLevel: '0',
  unitCost: '',
  location: '',
}

function toFormState(item: InventoryItem): ItemFormState {
  return {
    sku: item.sku,
    name: item.name,
    category: item.category || '',
    unitOfMeasure: item.unitOfMeasure,
    quantity: String(item.quantity),
    minStockLevel: String(item.minStockLevel),
    unitCost: item.unitCost ?? '',
    location: item.location || '',
  }
}

function InventoryPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, PROCUREMENT_ROLES)
  const t = useT()
  const { inventory: m, shared } = t.erp
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM)
  const draft = useFormDraft('inventory-item', form, showCreate && !editingItem)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null)
  const [adjustType, setAdjustType] = useState<MovementType>('IN')
  const [adjustQuantity, setAdjustQuantity] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState(false)

  function loadItems(searchValue = search) {
    setLoading(true)
    api
      .listInventory({ search: searchValue || undefined })
      .then(({ items }) => setItems(items))
      .catch((err) => setError(err instanceof Error ? err.message : m.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadItems('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    loadItems(search)
  }

  function openCreate() {
    setForm(draft.take(EMPTY_FORM))
    setFormError(null)
    setEditingItem(null)
    setShowCreate(true)
  }

  function openEdit(item: InventoryItem) {
    setForm(toFormState(item))
    setFormError(null)
    setEditingItem(item)
    setShowCreate(false)
  }

  function closeForm() {
    setShowCreate(false)
    setEditingItem(null)
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.sku.trim() || !form.name.trim()) {
      setFormError(m.skuNameRequired)
      return
    }

    setSubmitting(true)
    try {
      if (editingItem) {
        await api.updateInventoryItem(editingItem.id, {
          sku: form.sku,
          name: form.name,
          category: form.category || undefined,
          unitOfMeasure: form.unitOfMeasure || undefined,
          minStockLevel: Number(form.minStockLevel) || 0,
          unitCost: form.unitCost === '' ? null : Number(form.unitCost),
          location: form.location || undefined,
        })
      } else {
        await api.createInventoryItem({
          sku: form.sku,
          name: form.name,
          category: form.category || undefined,
          unitOfMeasure: form.unitOfMeasure || undefined,
          quantity: Number(form.quantity) || 0,
          minStockLevel: Number(form.minStockLevel) || 0,
          unitCost: form.unitCost === '' ? null : Number(form.unitCost),
          location: form.location || undefined,
        })
      }
      if (!editingItem) draft.clear()
      toast.success(editingItem ? m.updated : m.created)
      closeForm()
      loadItems()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : m.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(item: InventoryItem) {
    const ok = await confirm({
      title: m.deleteTitle,
      message: m.deleteMessage(item.name, item.sku),
      confirmLabel: shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteInventoryItem(item.id)
      toast.success(shared.deleted(item.name))
      loadItems()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.deleteFailed)
    }
  }

  function openAdjust(item: InventoryItem) {
    setAdjustingItem(item)
    setAdjustType('IN')
    setAdjustQuantity('')
    setAdjustReason('')
    setAdjustError(null)
  }

  async function handleAdjustSubmit(e: FormEvent) {
    e.preventDefault()
    setAdjustError(null)

    const quantity = Number(adjustQuantity)
    if (!quantity || quantity <= 0) {
      setAdjustError(m.quantityPositive)
      return
    }

    setAdjusting(true)
    try {
      await api.adjustStock(adjustingItem!.id, {
        type: adjustType,
        quantity,
        reason: adjustReason || undefined,
      })
      toast.success(m.adjusted(adjustingItem!.name))
      setAdjustingItem(null)
      loadItems()
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : m.adjustFailed)
    } finally {
      setAdjusting(false)
    }
  }

  const lowStockCount = items.filter((i) => i.quantity <= i.minStockLevel).length
  const totalValue = items.reduce((sum, i) => sum + i.quantity * Number(i.unitCost || 0), 0)

  function exportCsv() {
    downloadCsv(
      'inventory',
      [
        { header: m.csv.sku, accessor: (i: InventoryItem) => i.sku },
        { header: m.csv.name, accessor: (i: InventoryItem) => i.name },
        { header: m.csv.category, accessor: (i: InventoryItem) => i.category },
        { header: m.csv.quantity, accessor: (i: InventoryItem) => i.quantity },
        { header: m.csv.minStock, accessor: (i: InventoryItem) => i.minStockLevel },
        { header: m.csv.unitCost, accessor: (i: InventoryItem) => i.unitCost },
        { header: m.csv.location, accessor: (i: InventoryItem) => i.location },
      ],
      items,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{m.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{m.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            {m.exportCsv}
          </button>
          {canWrite && (
            <button type="button" onClick={openCreate} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              {m.add}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard label={m.statTotal} value={items.length} icon={PackageSearch} />
        <StatCard
          label={m.statLow}
          value={lowStockCount}
          delta={lowStockCount > 0 ? m.needsAttention : undefined}
          deltaTone="warning"
          icon={PackageSearch}
        />
        <StatCard label={m.statValue} value={formatMoney(totalValue)} icon={PackageSearch} />
      </div>

      <Panel title={m.panel}>
        <form onSubmit={handleSearchSubmit} className="mb-4 flex items-center gap-2">
          <div className="flex flex-1 max-w-sm items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder={m.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
            />
          </div>
          <button type="submit" className={secondaryButtonClass}>
            {m.searchButton}
          </button>
        </form>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={7} />
        ) : items.length === 0 ? (
          <EmptyState icon={PackageSearch} message={m.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{m.sku}</th>
                  <th className="px-3 py-3 font-semibold">{shared.name}</th>
                  <th className="px-3 py-3 font-semibold">{m.category}</th>
                  <th className="px-3 py-3 font-semibold">{t.erp.lineItems.qty}</th>
                  <th className="px-3 py-3 font-semibold">{m.min}</th>
                  <th className="px-3 py-3 font-semibold">{shared.unitCost}</th>
                  <th className="px-3 py-3 font-semibold">{m.location}</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const low = item.quantity <= item.minStockLevel
                  return (
                    <tr key={item.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-3 font-mono text-ink-300">{item.sku}</td>
                      <td className="px-3 py-3 font-medium text-ink-100">{item.name}</td>
                      <td className="px-3 py-3 text-ink-300">{item.category || '—'}</td>
                      <td className={`px-3 py-3 font-semibold ${low ? 'text-red-400' : 'text-ink-100'}`}>
                        {item.quantity} {item.unitOfMeasure}
                      </td>
                      <td className="px-3 py-3 text-ink-400">{item.minStockLevel}</td>
                      <td className="px-3 py-3 text-ink-300">
                        {item.unitCost ? formatMoney(item.unitCost) : '—'}
                      </td>
                      <td className="px-3 py-3 text-ink-300">{item.location || '—'}</td>
                      {canWrite && (
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-3 text-ink-400">
                            <button
                              type="button"
                              onClick={() => openAdjust(item)}
                              aria-label={m.adjustAria}
                              className="hover:text-cyan-accent"
                            >
                              <ArrowUpDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              aria-label={m.editAria}
                              className="hover:text-ink-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              aria-label={m.deleteAria}
                              className="hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {(showCreate || editingItem) && (
        <Modal title={editingItem ? m.edit : m.add} onClose={closeForm}>
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
            {!editingItem && draft.restored && <DraftNotice onDiscard={() => setForm(draft.discard())} />}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{m.sku}</label>
                <input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{shared.name}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{m.category}</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{m.unitOfMeasure}</label>
                <input
                  value={form.unitOfMeasure}
                  onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              {!editingItem && (
                <div>
                  <label className={labelClass}>{m.initialQuantity}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className={`mt-2 ${inputClass}`}
                  />
                </div>
              )}
              <div>
                <label className={labelClass}>{m.minStock}</label>
                <input
                  type="number"
                  min={0}
                  value={form.minStockLevel}
                  onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{shared.unitCost}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.unitCost}
                  onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{m.location}</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            {editingItem && (
              <p className="text-xs text-ink-400">
                {m.quantityNote}
              </p>
            )}

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? shared.saving : editingItem ? shared.saveChanges : m.create}
            </button>
          </form>
        </Modal>
      )}

      {adjustingItem && (
        <Modal title={m.adjustTitle(adjustingItem.name)} onClose={() => setAdjustingItem(null)}>
          <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              {m.currentQuantity} <span className="font-semibold text-ink-100">{adjustingItem.quantity}</span>{' '}
              {adjustingItem.unitOfMeasure}
            </p>

            <div>
              <label className={labelClass}>{m.type}</label>
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as MovementType)}
                className={`mt-2 ${inputClass}`}
              >
                <option value="IN">{m.stockIn}</option>
                <option value="OUT">{m.stockOut}</option>
                <option value="ADJUSTMENT">{m.adjustment}</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>{shared.quantity}</label>
              <input
                type="number"
                min={1}
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(e.target.value)}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>

            <div>
              <label className={labelClass}>{m.reasonOptional}</label>
              <input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {adjustError && <p className="text-sm text-red-400">{adjustError}</p>}

            <button type="submit" disabled={adjusting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {adjusting ? shared.saving : m.apply}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default InventoryPage
