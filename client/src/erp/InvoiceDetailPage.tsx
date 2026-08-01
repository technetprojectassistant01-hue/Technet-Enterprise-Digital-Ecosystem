import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, X, Trash2, CheckCircle2 } from 'lucide-react'
import * as api from '../lib/api'
import type { Invoice, InvoiceStatus } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass, dangerButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, FINANCE_ROLES } from '../lib/permissions'
import { invoiceStatusTone } from './statusTones'
import { formatMoney } from '../lib/format'

const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'

const STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']

function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, FINANCE_ROLES)

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextStatus, setNextStatus] = useState<InvoiceStatus>('DRAFT')
  const [updating, setUpdating] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getInvoice(id)
      .then(({ invoice }) => {
        setInvoice(invoice)
        setNextStatus(invoice.status)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load invoice'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function handleUpdateStatus() {
    if (!invoice) return
    setUpdating(true)
    try {
      await api.updateInvoice(invoice.id, { status: nextStatus })
      toast.success('Status updated')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  async function markPaid() {
    if (!invoice) return
    try {
      await api.updateInvoice(invoice.id, { status: 'PAID' })
      toast.success('Invoice marked paid')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update invoice')
    }
  }

  async function handleDelete() {
    if (!invoice) return
    const ok = await confirm({
      title: 'Delete invoice',
      message: `Delete invoice ${invoice.invoiceNumber}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteInvoice(invoice.id)
      toast.success('Invoice deleted')
      window.location.href = '/dashboard/erp/finance/invoices'
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete invoice')
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !invoice) return <EmptyState icon={X} message={error || 'Invoice not found'} />

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/erp/finance/invoices"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Invoices
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-ink-100">{invoice.invoiceNumber}</h1>
            <Badge tone={invoiceStatusTone[invoice.status]}>{invoice.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {invoice.customer.company || invoice.customer.name}
            {invoice.dueDate && ` · Due ${invoice.dueDate.slice(0, 10)}`}
          </p>
        </div>

        <div className="flex gap-3">
          {canWrite && invoice.status !== 'PAID' && (
            <button type="button" onClick={markPaid} className={secondaryButtonClass}>
              <CheckCircle2 className="h-4 w-4" />
              Mark Paid
            </button>
          )}
          <a href={api.invoicePdfUrl(invoice.id)} target="_blank" rel="noreferrer" className={primaryButtonClass}>
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
              {invoice.items.map((item) => (
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
            <span>{formatMoney(invoice.subtotal)}</span>
          </div>
          <div className="flex w-56 justify-between text-ink-300">
            <span>VAT ({Number(invoice.vatRate)}%)</span>
            <span>{formatMoney(invoice.vatAmount)}</span>
          </div>
          <div className="flex w-56 justify-between border-t border-ink-700 pt-1 font-semibold text-cyan-accent">
            <span>Total</span>
            <span>{formatMoney(invoice.total)}</span>
          </div>
        </div>
      </Panel>

      {canWrite && (
        <Panel title="Status">
          <div className="flex items-center gap-3">
            <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as InvoiceStatus)} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={updating || nextStatus === invoice.status}
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

export default InvoiceDetailPage
