import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, ShoppingCart, Trash2, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { PurchaseOrder } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, PROCUREMENT_ROLES } from '../lib/permissions'
import { useSuppliers } from './useSuppliers'
import { useInventoryItems } from './useInventoryItems'
import LineItemsEditor, { EMPTY_LINE_ITEM, type LineItemRow } from './LineItemsEditor'
import { purchaseOrderStatusTone } from './statusTones'
import { formatMoney } from '../lib/format'
import { useT } from '../i18n'
import { useFormDraft } from '../lib/useFormDraft'
import { DraftNotice } from '../dashboard/DraftNotice'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function PurchaseOrdersPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, PROCUREMENT_ROLES)
  const { purchaseOrders: m, shared, status } = useT().erp
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
  const draftValue = { supplierId, poNumber, expectedDate, items }
  const draft = useFormDraft('purchase-order', draftValue, showCreate)

  function load(searchValue = search) {
    setLoading(true)
    api
      .listPurchaseOrders({ search: searchValue || undefined })
      .then(({ purchaseOrders }) => setPurchaseOrders(purchaseOrders))
      .catch((err) => setError(err instanceof Error ? err.message : m.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function fillDraft(d: typeof draftValue) {
    setSupplierId(d.supplierId)
    setPoNumber(d.poNumber)
    setExpectedDate(d.expectedDate)
    setItems(d.items)
  }

  function openCreate() {
    fillDraft(draft.take({ supplierId: '', poNumber: '', expectedDate: '', items: [{ ...EMPTY_LINE_ITEM }] }))
    setFormError(null)
    setShowCreate(true)
  }

  const liveTotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!supplierId) {
      setFormError(shared.selectSupplier)
      return
    }
    if (!poNumber.trim()) {
      setFormError(shared.poNumberRequired)
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
      draft.clear()
      toast.success(m.created)
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : m.createFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(po: PurchaseOrder) {
    const ok = await confirm({
      title: m.deleteTitle,
      message: m.deleteMessage(po.poNumber),
      confirmLabel: shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deletePurchaseOrder(po.id)
      toast.success(shared.deleted(po.poNumber))
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.deleteFailed)
    }
  }

  const openCount = purchaseOrders.filter((po) => po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED').length
  const totalValue = purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount), 0)

  function exportCsv() {
    downloadCsv(
      'purchase-orders',
      [
        { header: m.csv.number, accessor: (po: PurchaseOrder) => po.poNumber },
        { header: m.csv.supplier, accessor: (po: PurchaseOrder) => po.supplier.name },
        { header: m.csv.items, accessor: (po: PurchaseOrder) => po.items.length },
        { header: m.csv.total, accessor: (po: PurchaseOrder) => po.totalAmount },
        { header: m.csv.status, accessor: (po: PurchaseOrder) => status.purchaseOrder[po.status] },
      ],
      purchaseOrders,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{m.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{m.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            {m.exportRegistry}
          </button>
          {canWrite && (
            <button type="button" onClick={openCreate} disabled={suppliers.length === 0} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              {m.new}
            </button>
          )}
        </div>
      </div>

      {canWrite && suppliers.length === 0 && (
        <p className="text-sm text-ink-400">{m.needSupplier}</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label={m.statOpen} value={openCount} icon={ShoppingCart} />
        <StatCard label={m.statValue} value={formatMoney(totalValue)} icon={ShoppingCart} />
      </div>

      <Panel title={m.panel}>
        <div className="mb-4 flex flex-1 max-w-sm items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder={m.search}
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
          <EmptyState icon={ShoppingCart} message={m.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{shared.poNumber}</th>
                  <th className="px-3 py-3 font-semibold">{shared.supplier}</th>
                  <th className="px-3 py-3 font-semibold">{shared.items}</th>
                  <th className="px-3 py-3 font-semibold">{shared.totalCol}</th>
                  <th className="px-3 py-3 font-semibold">{shared.status}</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/erp/procurement/purchase-orders/${po.id}`}
                        className="font-mono font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                      >
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{po.supplier.name}</td>
                    <td className="px-3 py-3 text-ink-300">{po.items.length}</td>
                    <td className="px-3 py-3 text-ink-100">{formatMoney(po.totalAmount)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={purchaseOrderStatusTone[po.status]}>{status.purchaseOrder[po.status]}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleDelete(po)}
                          aria-label={m.deleteAria}
                          className="text-ink-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showCreate && (
        <Modal title={m.new} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {draft.restored && <DraftNotice onDiscard={() => fillDraft(draft.discard())} />}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{shared.supplier}</label>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">{shared.selectSupplier}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{shared.poNumber}</label>
                <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required className={`mt-2 ${inputClass}`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>{shared.expectedDate}</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            <LineItemsEditor items={items} onChange={setItems} showUnitCost inventoryItems={inventoryItems} />

            <div className="flex items-center justify-between rounded-md bg-ink-800 px-4 py-3">
              <span className="text-sm text-ink-300">{shared.total}</span>
              <span className="text-lg font-semibold text-cyan-accent">{formatMoney(liveTotal)}</span>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? shared.creating : m.create}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default PurchaseOrdersPage
