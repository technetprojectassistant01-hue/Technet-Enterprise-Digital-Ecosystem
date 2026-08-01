import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, X, Trash2 } from 'lucide-react'
import * as api from '../lib/api'
import type { Quotation, QuotationStatus } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, dangerButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, SALES_ROLES } from '../lib/permissions'
import { quotationStatusTone } from './statusTones'
import { formatMoney } from '../lib/format'

const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'

const STATUSES: QuotationStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']

function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, SALES_ROLES)

  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextStatus, setNextStatus] = useState<QuotationStatus>('DRAFT')
  const [updating, setUpdating] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getQuotation(id)
      .then(({ quotation }) => {
        setQuotation(quotation)
        setNextStatus(quotation.status)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load quotation'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function handleUpdateStatus() {
    if (!quotation) return
    setUpdating(true)
    try {
      await api.updateQuotation(quotation.id, { status: nextStatus })
      toast.success('Status updated')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDelete() {
    if (!quotation) return
    const ok = await confirm({
      title: 'Delete quotation',
      message: `Delete quotation "${quotation.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteQuotation(quotation.id)
      toast.success('Quotation deleted')
      window.location.href = '/dashboard/erp/finance/quotations'
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete quotation')
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !quotation) return <EmptyState icon={X} message={error || 'Quotation not found'} />

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/erp/finance/quotations"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Quotations
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-ink-100">{quotation.quotationNumber}</h1>
            <Badge tone={quotationStatusTone[quotation.status]}>{quotation.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {quotation.title} · {quotation.customer.company || quotation.customer.name}
            {quotation.expiresAt && ` · Expires ${quotation.expiresAt.slice(0, 10)}`}
          </p>
        </div>

        <div className="flex gap-3">
          <a href={api.quotationPdfUrl(quotation.id)} target="_blank" rel="noreferrer" className={primaryButtonClass}>
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          {canWrite && (
            <button type="button" onClick={handleDelete} className={dangerButtonClass}>
              <Trash2 className="h-4 w-4" />
              Delete
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
                <th className="px-3 py-3 font-semibold">QTY</th>
                <th className="px-3 py-3 font-semibold">UNIT PRICE</th>
                <th className="px-3 py-3 font-semibold">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item) => (
                <tr key={item.id} className="border-b border-ink-800 last:border-0">
                  <td className="px-3 py-3 font-medium text-ink-100">{item.description}</td>
                  <td className="px-3 py-3 text-ink-300">{item.quantity}</td>
                  <td className="px-3 py-3 text-ink-300">{formatMoney(item.unitPrice)}</td>
                  <td className="px-3 py-3 text-ink-100">{formatMoney(Number(item.unitPrice) * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-col items-end gap-1 text-sm">
          <div className="flex w-56 justify-between text-ink-300">
            <span>Subtotal</span>
            <span>{formatMoney(quotation.subtotal)}</span>
          </div>
          <div className="flex w-56 justify-between text-ink-300">
            <span>VAT ({Number(quotation.vatRate)}%)</span>
            <span>{formatMoney(quotation.vatAmount)}</span>
          </div>
          <div className="flex w-56 justify-between border-t border-ink-700 pt-1 font-semibold text-cyan-accent">
            <span>Total</span>
            <span>{formatMoney(quotation.total)}</span>
          </div>
        </div>
      </Panel>

      {canWrite && (
        <Panel title="Status">
          <div className="flex items-center gap-3">
            <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as QuotationStatus)} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={updating || nextStatus === quotation.status}
              className={primaryButtonClass}
            >
              {updating ? 'Updating…' : 'Update Status'}
            </button>
          </div>
        </Panel>
      )}
    </div>
  )
}

export default QuotationDetailPage
