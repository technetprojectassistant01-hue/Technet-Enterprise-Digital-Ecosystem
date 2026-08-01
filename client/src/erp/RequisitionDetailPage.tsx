import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, X } from 'lucide-react'
import * as api from '../lib/api'
import type { RequisitionDetail } from '../lib/api'
import { Panel, Badge, Modal, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, dangerButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, PROCUREMENT_ROLES } from '../lib/permissions'
import { useSuppliers } from './useSuppliers'
import { requisitionStatusTone } from './statusTones'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canManage = hasRole(user?.role, PROCUREMENT_ROLES)
  const suppliers = useSuppliers()

  const [requisition, setRequisition] = useState<RequisitionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showReject, setShowReject] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)

  const [showConvert, setShowConvert] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [unitCosts, setUnitCosts] = useState<Record<string, string>>({})
  const [convertError, setConvertError] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getRequisition(id)
      .then(({ requisition }) => setRequisition(requisition))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load requisition'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function handleApprove() {
    if (!requisition) return
    const ok = await confirm({
      title: 'Approve requisition',
      message: `Approve requisition ${requisition.requisitionNumber}?`,
      confirmLabel: 'Approve',
    })
    if (!ok) return
    try {
      await api.approveRequisition(requisition.id)
      toast.success('Requisition approved')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve requisition')
    }
  }

  async function handleReject(e: FormEvent) {
    e.preventDefault()
    setRejectError(null)
    if (!rejectNote.trim()) {
      setRejectError('A reason is required')
      return
    }
    setRejecting(true)
    try {
      await api.rejectRequisition(requisition!.id, rejectNote.trim())
      toast.success('Requisition rejected')
      setShowReject(false)
      load()
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : 'Failed to reject requisition')
    } finally {
      setRejecting(false)
    }
  }

  function openConvert() {
    setSupplierId('')
    setPoNumber('')
    setExpectedDate('')
    setUnitCosts({})
    setConvertError(null)
    setShowConvert(true)
  }

  async function handleConvert(e: FormEvent) {
    e.preventDefault()
    setConvertError(null)

    if (!supplierId) {
      setConvertError('Select a supplier')
      return
    }
    if (!poNumber.trim()) {
      setConvertError('PO number is required')
      return
    }

    setConverting(true)
    try {
      await api.convertRequisitionToPO(requisition!.id, {
        supplierId,
        poNumber,
        expectedDate: expectedDate || undefined,
        items: requisition!.items.map((item) => ({
          requisitionItemId: item.id,
          unitCost: Number(unitCosts[item.id] || 0),
        })),
      })
      toast.success('Converted to purchase order')
      setShowConvert(false)
      load()
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Failed to convert requisition')
    } finally {
      setConverting(false)
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !requisition) return <EmptyState icon={X} message={error || 'Requisition not found'} />

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/erp/procurement/requisitions"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Requisitions
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-ink-100">{requisition.requisitionNumber}</h1>
            <Badge tone={requisitionStatusTone[requisition.status]}>{requisition.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {requisition.project?.name || 'No project'} · Requested by{' '}
            {requisition.requestedBy.name || requisition.requestedBy.email}
            {requisition.neededByDate && ` · Needed by ${requisition.neededByDate.slice(0, 10)}`}
          </p>
          {requisition.notes && <p className="mt-2 max-w-2xl text-sm text-ink-400">{requisition.notes}</p>}
        </div>

        <div className="flex gap-3">
          {canManage && requisition.status === 'SUBMITTED' && (
            <>
              <button type="button" onClick={handleApprove} className={primaryButtonClass}>
                <Check className="h-4 w-4" />
                Approve
              </button>
              <button type="button" onClick={() => setShowReject(true)} className={dangerButtonClass}>
                <X className="h-4 w-4" />
                Reject
              </button>
            </>
          )}
          {canManage && requisition.status === 'APPROVED' && (
            <button type="button" onClick={openConvert} className={primaryButtonClass}>
              Convert to Purchase Order
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
                <th className="px-3 py-3 font-semibold">INVENTORY ITEM</th>
                <th className="px-3 py-3 font-semibold">QUANTITY</th>
              </tr>
            </thead>
            <tbody>
              {requisition.items.map((item) => (
                <tr key={item.id} className="border-b border-ink-800 last:border-0">
                  <td className="px-3 py-3 font-medium text-ink-100">{item.description}</td>
                  <td className="px-3 py-3 text-ink-300">{item.inventoryItem?.sku || '—'}</td>
                  <td className="px-3 py-3 text-ink-300">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {requisition.purchaseOrders.length > 0 && (
        <Panel title="Purchase Orders">
          <div className="flex flex-col gap-2">
            {requisition.purchaseOrders.map((po) => (
              <Link
                key={po.id}
                to={`/dashboard/erp/procurement/purchase-orders/${po.id}`}
                className="flex items-center justify-between rounded-lg bg-ink-800 px-4 py-2.5 hover:bg-ink-700"
              >
                <span className="font-mono text-sm text-ink-100">{po.poNumber}</span>
                <span className="text-xs text-ink-400">{po.status.replace('_', ' ')}</span>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Status History">
        <div className="flex flex-col gap-3">
          {requisition.statusHistory.map((h) => (
            <div key={h.id} className="rounded-lg bg-ink-800 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-100">
                  {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `Created (${h.toStatus})`}
                </span>
                <span className="text-xs text-ink-400">{new Date(h.createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-xs text-ink-400">
                {h.changedBy.name || h.changedBy.email}
                {h.note && ` — ${h.note}`}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {showReject && (
        <Modal title="Reject Requisition" onClose={() => setShowReject(false)}>
          <form onSubmit={handleReject} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>REASON</label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                required
                rows={3}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            {rejectError && <p className="text-sm text-red-400">{rejectError}</p>}
            <button type="submit" disabled={rejecting} className={`justify-center py-2.5 ${dangerButtonClass}`}>
              {rejecting ? 'Rejecting…' : 'Reject Requisition'}
            </button>
          </form>
        </Modal>
      )}

      {showConvert && (
        <Modal title="Convert to Purchase Order" onClose={() => setShowConvert(false)}>
          <form onSubmit={handleConvert} className="flex flex-col gap-4">
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

            <div className="flex flex-col gap-3">
              <label className={labelClass}>UNIT COSTS</label>
              {requisition.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-md border border-ink-700 bg-ink-950 p-3">
                  <span className="flex-1 text-sm text-ink-200">
                    {item.description} <span className="text-ink-500">× {item.quantity}</span>
                  </span>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    placeholder="Unit cost"
                    value={unitCosts[item.id] || ''}
                    onChange={(e) => setUnitCosts({ ...unitCosts, [item.id]: e.target.value })}
                    required
                    className="w-28 rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-cyan-accent"
                  />
                </div>
              ))}
            </div>

            {convertError && <p className="text-sm text-red-400">{convertError}</p>}

            <button type="submit" disabled={converting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {converting ? 'Converting…' : 'Create Purchase Order'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default RequisitionDetailPage
