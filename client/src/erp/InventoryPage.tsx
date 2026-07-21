import { useEffect, useState, type FormEvent } from 'react'
import { Search, Plus, Pencil, Trash2, ArrowUpDown } from 'lucide-react'
import * as api from '../lib/api'
import type { InventoryItem, MovementType } from '../lib/api'
import { Panel, StatCard, Modal } from '../dashboard/ui'

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
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM)
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
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load inventory'))
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
    setForm(EMPTY_FORM)
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
      setFormError('SKU and name are required')
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
      closeForm()
      loadItems()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save item')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(item: InventoryItem) {
    if (!confirm(`Delete "${item.name}" (${item.sku})? This cannot be undone.`)) return
    try {
      await api.deleteInventoryItem(item.id)
      loadItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item')
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
      setAdjustError('Quantity must be a positive number')
      return
    }

    setAdjusting(true)
    try {
      await api.adjustStock(adjustingItem!.id, {
        type: adjustType,
        quantity,
        reason: adjustReason || undefined,
      })
      setAdjustingItem(null)
      loadItems()
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Failed to adjust stock')
    } finally {
      setAdjusting(false)
    }
  }

  const lowStockCount = items.filter((i) => i.quantity <= i.minStockLevel).length
  const totalValue = items.reduce((sum, i) => sum + i.quantity * Number(i.unitCost || 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Inventory</h1>
          <p className="mt-1 text-sm text-ink-300">Stock items, levels, and adjustments.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard label="TOTAL ITEMS" value={items.length} />
        <StatCard
          label="LOW STOCK"
          value={lowStockCount}
          delta={lowStockCount > 0 ? 'Needs attention' : undefined}
          deltaTone="warning"
        />
        <StatCard
          label="STOCK VALUE"
          value={`$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
      </div>

      <Panel>
        <form onSubmit={handleSearchSubmit} className="mb-4 flex items-center gap-2">
          <div className="flex flex-1 max-w-sm items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-ink-700 px-3 py-2 text-sm text-ink-200 hover:bg-ink-800"
          >
            Search
          </button>
        </form>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-sm text-ink-400">Loading inventory…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-400">No inventory items yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">SKU</th>
                  <th className="px-3 py-3 font-semibold">NAME</th>
                  <th className="px-3 py-3 font-semibold">CATEGORY</th>
                  <th className="px-3 py-3 font-semibold">QTY</th>
                  <th className="px-3 py-3 font-semibold">MIN</th>
                  <th className="px-3 py-3 font-semibold">UNIT COST</th>
                  <th className="px-3 py-3 font-semibold">LOCATION</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const low = item.quantity <= item.minStockLevel
                  return (
                    <tr key={item.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-3 text-ink-300">{item.sku}</td>
                      <td className="px-3 py-3 font-medium text-ink-100">{item.name}</td>
                      <td className="px-3 py-3 text-ink-300">{item.category || '—'}</td>
                      <td className={`px-3 py-3 font-semibold ${low ? 'text-red-400' : 'text-ink-100'}`}>
                        {item.quantity} {item.unitOfMeasure}
                      </td>
                      <td className="px-3 py-3 text-ink-400">{item.minStockLevel}</td>
                      <td className="px-3 py-3 text-ink-300">
                        {item.unitCost ? `$${Number(item.unitCost).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-ink-300">{item.location || '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          <button
                            type="button"
                            onClick={() => openAdjust(item)}
                            aria-label="Adjust stock"
                            className="hover:text-cyan-accent"
                          >
                            <ArrowUpDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            aria-label="Edit item"
                            className="hover:text-ink-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            aria-label="Delete item"
                            className="hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {(showCreate || editingItem) && (
        <Modal title={editingItem ? 'Edit Item' : 'Add Item'} onClose={closeForm}>
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>SKU</label>
                <input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>NAME</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>CATEGORY</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>UNIT OF MEASURE</label>
                <input
                  value={form.unitOfMeasure}
                  onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              {!editingItem && (
                <div>
                  <label className={labelClass}>INITIAL QUANTITY</label>
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
                <label className={labelClass}>MIN STOCK LEVEL</label>
                <input
                  type="number"
                  min={0}
                  value={form.minStockLevel}
                  onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>UNIT COST</label>
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
                <label className={labelClass}>LOCATION</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            {editingItem && (
              <p className="text-xs text-ink-400">
                Quantity is changed via stock adjustments, not this form.
              </p>
            )}

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Saving…' : editingItem ? 'Save Changes' : 'Create Item'}
            </button>
          </form>
        </Modal>
      )}

      {adjustingItem && (
        <Modal title={`Adjust Stock — ${adjustingItem.name}`} onClose={() => setAdjustingItem(null)}>
          <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              Current quantity: <span className="font-semibold text-ink-100">{adjustingItem.quantity}</span>{' '}
              {adjustingItem.unitOfMeasure}
            </p>

            <div>
              <label className={labelClass}>TYPE</label>
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as MovementType)}
                className={`mt-2 ${inputClass}`}
              >
                <option value="IN">Stock In (+)</option>
                <option value="OUT">Stock Out (-)</option>
                <option value="ADJUSTMENT">Adjustment (+)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>QUANTITY</label>
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
              <label className={labelClass}>REASON (OPTIONAL)</label>
              <input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {adjustError && <p className="text-sm text-red-400">{adjustError}</p>}

            <button
              type="submit"
              disabled={adjusting}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {adjusting ? 'Saving…' : 'Apply Adjustment'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default InventoryPage
