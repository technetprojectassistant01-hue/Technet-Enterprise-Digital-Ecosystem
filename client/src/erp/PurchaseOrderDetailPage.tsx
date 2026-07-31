import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, X, PackageCheck } from 'lucide-react'
import * as api from '../lib/api'
import type { PurchaseOrderDetail } from '../lib/api'
import { Panel, Badge, Modal, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, PROCUREMENT_ROLES } from '../lib/permissions'
import { purchaseOrderStatusTone } from './statusTones'
import { formatMoney } from '../lib/format'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function receivedFor(item: { goodsReceiptItems?: { quantityReceived: number }[] }) {
  return (item.goodsReceiptItems || []).reduce((sum, gri) => sum + gri.quantityReceived, 0)
}

function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, PROCUREMENT_ROLES)

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState(false)

  const [showReceive, setShowReceive] = useState(false)
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({})
  const [receiveNotes, setReceiveNotes] = useState('')
  const [receiveError, setReceiveError] = useState<string | null>(null)
  const [receiving, setReceiving] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getPurchaseOrder(id)
      .then(({ purchaseOrder }) => setPo(purchaseOrder))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load purchase order'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function handleSend() {
    setActioning(true)
    try {
      await api.sendPurchaseOrder(po!.id)
      toast.success('Purchase order sent')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send purchase order')
    } finally {
      setActioning(false)
    }
  }

  async function handleCancel() {
    const ok = await confirm({
      title: 'Cancel purchase order',
      message: `Cancel ${po!.poNumber}? This is a terminal state.`,
      confirmLabel: 'Cancel Order',
      tone: 'danger',
    })
    if (!ok) return
    setActioning(true)
    try {
      await api.cancelPurchaseOrder(po!.id)
      toast.success('Purchase order cancelled')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel purchase order')
    } finally {
      setActioning(false)
    }
  }

  async function handleClose() {
    setActioning(true)
    try {
      await api.closePurchaseOrder(po!.id)
      toast.success('Purchase order closed')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to close purchase order')
    } finally {
      setActioning(false)
    }
  }

  function openReceive() {
    const defaults: Record<string, string> = {}
    for (const item of po!.items) {
      const remaining = item.quantity - receivedFor(item)
      if (remaining > 0) defaults[item.id] = String(remaining)
    }
    setReceiveQuantities(defaults)
    setReceiveNotes('')
    setReceiveError(null)
    setShowReceive(true)
  }

  async function handleReceiveSubmit(e: FormEvent) {
    e.preventDefault()
    setReceiveError(null)

    const items = Object.entries(receiveQuantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([purchaseOrderItemId, qty]) => ({ purchaseOrderItemId, quantityReceived: Number(qty) }));

    if (items.length === 0) {
      setReceiveError('Enter at least one received quantity')
      return
    }

    setReceiving(true)
    try {
      await api.receivePurchaseOrder(po!.id, { items, notes: receiveNotes || undefined })
      toast.success('Receipt recorded')
      setShowReceive(false)
      load()
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : 'Failed to record receipt')
    } finally {
      setReceiving(false)
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !po) return <EmptyState icon={X} message={error || 'Purchase order not found'} />

  const canReceive = po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED'

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/erp/procurement/purchase-orders"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Purchase Orders
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink-100">{po.poNumber}</h1>
            <Badge tone={purchaseOrderStatusTone[po.status]}>{po.status.replace('_', ' ')}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {po.supplier.name}
            {po.requisition && (
              <>
                {' · from '}
                <Link
                  to={`/dashboard/erp/procurement/requisitions/${po.requisition.id}`}
                  className="text-cyan-accent hover:underline"
                >
                  {po.requisition.requisitionNumber}
                </Link>
              </>
            )}
            {po.expectedDate && ` · Expected ${po.expectedDate.slice(0, 10)}`}
          </p>
        </div>

        <div className="flex gap-3">
          {canWrite && po.status === 'DRAFT' && (
            <button
              type="button"
              onClick={handleSend}
              disabled={actioning}
              className="rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:opacity-70"
            >
              Send to Supplier
            </button>
          )}
          {canWrite && canReceive && (
            <button
              type="button"
              onClick={openReceive}
              className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark"
            >
              <PackageCheck className="h-4 w-4" />
              Record Receipt
            </button>
          )}
          {canWrite && po.status === 'FULLY_RECEIVED' && (
            <button
              type="button"
              onClick={handleClose}
              disabled={actioning}
              className="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-200 hover:bg-ink-800 disabled:opacity-70"
            >
              Close Order
            </button>
          )}
          {canWrite && (po.status === 'DRAFT' || po.status === 'SENT') && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={actioning}
              className="rounded-md border border-red-400/50 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 disabled:opacity-70"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <Panel title="Line Items">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                <th className="px-3 py-3 font-semibold">DESCRIPTION</th>
                <th className="px-3 py-3 font-semibold">UNIT COST</th>
                <th className="px-3 py-3 font-semibold">ORDERED</th>
                <th className="px-3 py-3 font-semibold">RECEIVED</th>
                <th className="px-3 py-3 font-semibold">REMAINING</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item) => {
                const received = receivedFor(item)
                return (
                  <tr key={item.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-medium text-ink-100">{item.description}</td>
                    <td className="px-3 py-3 text-ink-300">{formatMoney(item.unitCost)}</td>
                    <td className="px-3 py-3 text-ink-300">{item.quantity}</td>
                    <td className="px-3 py-3 text-cyan-accent">{received}</td>
                    <td className="px-3 py-3 text-ink-400">{item.quantity - received}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="px-3 pt-3 text-right text-sm font-semibold text-ink-100">
                  Total: {formatMoney(po.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <Panel title="Goods Receipts">
        {po.goodsReceipts.length === 0 ? (
          <p className="text-sm text-ink-400">No receipts recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {po.goodsReceipts.map((gr) => (
              <div key={gr.id} className="rounded-lg bg-ink-800 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-100">
                    {gr.items.reduce((s, i) => s + i.quantityReceived, 0)} units received
                  </span>
                  <span className="text-xs text-ink-400">{new Date(gr.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-xs text-ink-400">
                  {gr.receivedBy.name || gr.receivedBy.email}
                  {gr.notes && ` — ${gr.notes}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {showReceive && (
        <Modal title="Record Receipt" onClose={() => setShowReceive(false)}>
          <form onSubmit={handleReceiveSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {po.items.map((item) => {
                const remaining = item.quantity - receivedFor(item)
                if (remaining <= 0) return null
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-md border border-ink-700 bg-ink-950 p-3">
                    <span className="flex-1 text-sm text-ink-200">
                      {item.description} <span className="text-ink-500">(remaining {remaining})</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      value={receiveQuantities[item.id] ?? ''}
                      onChange={(e) => setReceiveQuantities({ ...receiveQuantities, [item.id]: e.target.value })}
                      className="w-24 rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-cyan-accent"
                    />
                  </div>
                )
              })}
            </div>
            <div>
              <label className={labelClass}>NOTES</label>
              <input value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} className={`mt-2 ${inputClass}`} />
            </div>

            {receiveError && <p className="text-sm text-red-400">{receiveError}</p>}

            <button
              type="submit"
              disabled={receiving}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {receiving ? 'Recording…' : 'Record Receipt'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default PurchaseOrderDetailPage
