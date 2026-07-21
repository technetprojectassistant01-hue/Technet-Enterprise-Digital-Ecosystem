import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import * as api from '../lib/api'
import type { PurchaseOrder } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useSuppliers } from './useSuppliers'
import { useInventoryItems } from './useInventoryItems'
import LineItemsEditor, { EMPTY_LINE_ITEM, type LineItemRow } from './LineItemsEditor'
import { purchaseOrderStatusTone } from './statusTones'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function PurchaseOrdersPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const suppliers = useSuppliers()
  const inventoryItems = useInventoryItems()
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [items, setItems] = useState<LineItemRow[]>([{ ...EMPTY_LINE_ITEM }])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load(searchValue = search) {
    setLoading(true)
    api
      .listPurchaseOrders({ search: searchValue || undefined })
      .then(({ purchaseOrders }) => setPurchaseOrders(purchaseOrders))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load purchase orders'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setSupplierId('')
    setPoNumber('')
    setExpectedDate('')
    setItems([{ ...EMPTY_LINE_ITEM }])
    setFormError(null)
    setShowCreate(true)
  }

  const liveTotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!supplierId) {
      setFormError('Select a supplier')
      return
    }
    if (!poNumber.trim()) {
      setFormError('PO number is required')
      return
    }

    setSubmitting(true)
    try {
      await api.createPurchaseOrder({
        supplierId,
        poNumber,
        expectedDate: expectedDate || undefined,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
          inventoryItemId: item.inventoryItemId || undefined,
        })),
      })
      toast.success('Purchase order created')
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create purchase order')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(po: PurchaseOrder) {
    const ok = await confirm({
      title: 'Delete purchase order',
      message: `Delete purchase order ${po.poNumber}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deletePurchaseOrder(po.id)
      toast.success(`Deleted ${po.poNumber}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete purchase order')
    }
  }

  const openCount = purchaseOrders.filter((po) => po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED').length
  const totalValue = purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          disabled={suppliers.length === 0}
          className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New Purchase Order
        </button>
      </div>

      {suppliers.length === 0 && (
        <p className="text-sm text-ink-400">Add a supplier first before creating purchase orders.</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="OPEN ORDERS" value={openCount} />
        <StatCard label="TOTAL VALUE" value={`$${totalValue.toLocaleString()}`} />
      </div>

      <Panel>
        <div className="mb-4 flex flex-1 max-w-sm items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search by PO number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(search)}
            className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : purchaseOrders.length === 0 ? (
          <EmptyState icon={ShoppingCart} message="No purchase orders yet. Create your first order to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">PO NUMBER</th>
                  <th className="px-3 py-3 font-semibold">SUPPLIER</th>
                  <th className="px-3 py-3 font-semibold">ITEMS</th>
                  <th className="px-3 py-3 font-semibold">TOTAL</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/erp/procurement/purchase-orders/${po.id}`}
                        className="font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                      >
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{po.supplier.name}</td>
                    <td className="px-3 py-3 text-ink-300">{po.items.length}</td>
                    <td className="px-3 py-3 text-ink-100">${Number(po.totalAmount).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <Badge tone={purchaseOrderStatusTone[po.status]}>{po.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(po)}
                        aria-label="Delete purchase order"
                        className="text-ink-400 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showCreate && (
        <Modal title="New Purchase Order" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>SUPPLIER</label>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">Select a supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>PO NUMBER</label>
                <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required className={`mt-2 ${inputClass}`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>EXPECTED DATE</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            <LineItemsEditor items={items} onChange={setItems} showUnitCost inventoryItems={inventoryItems} />

            <div className="flex items-center justify-between rounded-md bg-ink-800 px-4 py-3">
              <span className="text-sm text-ink-300">Total</span>
              <span className="text-lg font-semibold text-cyan-accent">${liveTotal.toLocaleString()}</span>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Creating…' : 'Create Purchase Order'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default PurchaseOrdersPage
