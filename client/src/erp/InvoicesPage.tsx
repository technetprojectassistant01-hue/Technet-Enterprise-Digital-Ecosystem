import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, CheckCircle2, Receipt } from 'lucide-react'
import * as api from '../lib/api'
import type { Invoice, InvoiceStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useCustomers } from './useCustomers'
import { useProjects } from './useProjects'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { invoiceStatusTone as statusTone } from './statusTones'
import { formatMoney } from '../lib/format'
import SalesLineItemsEditor, { EMPTY_SALES_LINE_ITEM, type SalesLineItemRow } from './SalesLineItemsEditor'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']

function InvoicesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const customers = useCustomers()
  const projects = useProjects()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [status, setStatus] = useState<InvoiceStatus>('DRAFT')
  const [vatRate, setVatRate] = useState('15')
  const [dueDate, setDueDate] = useState('')
  const [poReference, setPoReference] = useState('')
  const [terms, setTerms] = useState('Due on receipt')
  const [items, setItems] = useState<SalesLineItemRow[]>([{ ...EMPTY_SALES_LINE_ITEM }])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .listInvoices()
      .then(({ invoices }) => setInvoices(invoices))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load invoices'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setCustomerId(customers[0]?.id || '')
    setProjectId('')
    setInvoiceNumber('')
    setStatus('DRAFT')
    setVatRate('15')
    setDueDate('')
    setPoReference('')
    setTerms('Due on receipt')
    setItems([{ ...EMPTY_SALES_LINE_ITEM }])
    setFormError(null)
    setShowCreate(true)
  }

  const liveSubtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
  const liveVatAmount = liveSubtotal * ((Number(vatRate) || 0) / 100)
  const liveTotal = liveSubtotal + liveVatAmount

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!customerId) {
      setFormError('Select a customer')
      return
    }
    if (!invoiceNumber.trim()) {
      setFormError('Invoice number is required')
      return
    }

    setSubmitting(true)
    try {
      await api.createInvoice({
        customerId,
        projectId: projectId || null,
        invoiceNumber,
        status,
        vatRate: Number(vatRate) || 0,
        dueDate: dueDate || undefined,
        poReference: poReference || undefined,
        terms: terms || undefined,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      })
      toast.success('Invoice created')
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(inv: Invoice) {
    const ok = await confirm({
      title: 'Delete invoice',
      message: `Delete invoice ${inv.invoiceNumber}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteInvoice(inv.id)
      toast.success(`Deleted invoice ${inv.invoiceNumber}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete invoice')
    }
  }

  async function markPaid(inv: Invoice) {
    try {
      await api.updateInvoice(inv.id, { status: 'PAID' })
      toast.success(`Invoice ${inv.invoiceNumber} marked paid`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update invoice')
    }
  }

  const totalOutstanding = invoices
    .filter((i) => i.status === 'SENT' || i.status === 'OVERDUE')
    .reduce((sum, i) => sum + Number(i.total), 0)
  const totalPaid = invoices.filter((i) => i.status === 'PAID').reduce((sum, i) => sum + Number(i.total), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          disabled={customers.length === 0}
          className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New Invoice
        </button>
      </div>

      {customers.length === 0 && (
        <p className="text-sm text-ink-400">Add a customer first before creating invoices.</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="TOTAL PAID" value={formatMoney(totalPaid)} />
        <StatCard label="OUTSTANDING" value={formatMoney(totalOutstanding)} deltaTone="warning" />
      </div>

      <Panel>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={7} />
        ) : invoices.length === 0 ? (
          <EmptyState icon={Receipt} message="No invoices yet. Create your first invoice to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">INVOICE #</th>
                  <th className="px-3 py-3 font-semibold">CUSTOMER</th>
                  <th className="px-3 py-3 font-semibold">PROJECT</th>
                  <th className="px-3 py-3 font-semibold">TOTAL</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  <th className="px-3 py-3 font-semibold">DUE</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/erp/finance/invoices/${inv.id}`}
                        className="font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{inv.customer.company || inv.customer.name}</td>
                    <td className="px-3 py-3 text-ink-300">
                      {projects.find((p) => p.id === inv.projectId)?.name || '—'}
                    </td>
                    <td className="px-3 py-3 text-ink-100">{formatMoney(inv.total)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone[inv.status]}>{inv.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-ink-400">{inv.dueDate ? inv.dueDate.slice(0, 10) : '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        {inv.status !== 'PAID' && (
                          <button type="button" onClick={() => markPaid(inv)} aria-label="Mark paid" className="hover:text-cyan-accent">
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        <button type="button" onClick={() => handleDelete(inv)} aria-label="Delete invoice" className="hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showCreate && (
        <Modal title="New Invoice" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CUSTOMER</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>PROJECT (OPTIONAL)</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>INVOICE NUMBER</label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>P.O. NUMBER (OPTIONAL)</label>
                <input value={poReference} onChange={(e) => setPoReference(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>TERMS</label>
                <input value={terms} onChange={(e) => setTerms(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>STATUS</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                  className={`mt-2 ${inputClass}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>VAT %</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>DUE DATE</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
            </div>

            <SalesLineItemsEditor items={items} onChange={setItems} />

            <div className="flex flex-col gap-1 rounded-md bg-ink-800 px-4 py-3 text-sm">
              <div className="flex items-center justify-between text-ink-300">
                <span>Subtotal</span>
                <span>{formatMoney(liveSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-ink-300">
                <span>VAT ({vatRate || 0}%)</span>
                <span>{formatMoney(liveVatAmount)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-cyan-accent">
                <span>Total</span>
                <span>{formatMoney(liveTotal)}</span>
              </div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Creating…' : 'Create Invoice'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default InvoicesPage
