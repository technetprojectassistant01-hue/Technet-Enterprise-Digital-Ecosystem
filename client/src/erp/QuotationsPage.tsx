import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, FileSignature, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { Quotation, PaymentTermsTemplate, QuotationAvailability } from '../lib/api'
import { PAYMENT_TERMS_OPTIONS } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useCustomers } from './useCustomers'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, SALES_ROLES, QUOTE_REQUEST_VIEW_ROLES } from '../lib/permissions'
import { quotationStatusTone as statusTone } from './statusTones'
import { formatMoney } from '../lib/format'
import SalesLineItemsEditor, { EMPTY_SALES_LINE_ITEM, type SalesLineItemRow } from './SalesLineItemsEditor'
import QuoteRequestsTab from './QuoteRequestsTab'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function QuotationsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, SALES_ROLES)
  const canViewRequests = hasRole(user?.role, QUOTE_REQUEST_VIEW_ROLES)
  const customers = useCustomers()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [vatRate, setVatRate] = useState('15')
  const [expiresAt, setExpiresAt] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermsTemplate>('FULL_ON_CONFIRMATION')
  const [includesOrder, setIncludesOrder] = useState(false)
  const [availabilityStatus, setAvailabilityStatus] = useState<QuotationAvailability>('IN_STOCK')
  const [orderDays, setOrderDays] = useState('')
  const [items, setItems] = useState<SalesLineItemRow[]>([{ ...EMPTY_SALES_LINE_ITEM }])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [view, setView] = useState<'quotations' | 'requests'>('quotations')

  function load() {
    setLoading(true)
    api
      .listQuotations()
      .then(({ quotations }) => setQuotations(quotations))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load quotations'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setCustomerId(customers[0]?.id || '')
    setTitle('')
    setVatRate('15')
    setExpiresAt('')
    setPaymentTerms('FULL_ON_CONFIRMATION')
    setIncludesOrder(false)
    setAvailabilityStatus('IN_STOCK')
    setOrderDays('')
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
    if (!title.trim()) {
      setFormError('Title is required')
      return
    }
    if (includesOrder && availabilityStatus === 'ORDER_PENDING' && (!orderDays.trim() || Number(orderDays) <= 0)) {
      setFormError('Enter how many days until the order is received')
      return
    }

    setSubmitting(true)
    try {
      await api.createQuotation({
        customerId,
        title,
        vatRate: Number(vatRate) || 0,
        expiresAt: expiresAt || undefined,
        paymentTerms,
        availabilityStatus: includesOrder ? availabilityStatus : null,
        orderDays: includesOrder && availabilityStatus === 'ORDER_PENDING' ? Number(orderDays) : null,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      })
      toast.success('Quotation created')
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create quotation')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(q: Quotation) {
    const ok = await confirm({
      title: 'Delete quotation',
      message: `Delete quotation "${q.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteQuotation(q.id)
      toast.success('Quotation deleted')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete quotation')
    }
  }

  const activeCount = quotations.filter((q) => q.status === 'DRAFT' || q.status === 'SENT').length
  const acceptedCount = quotations.filter((q) => q.status === 'ACCEPTED').length

  function exportCsv() {
    downloadCsv(
      'quotations',
      [
        { header: 'Quotation #', accessor: (q: Quotation) => q.quotationNumber },
        { header: 'Title', accessor: (q: Quotation) => q.title },
        { header: 'Customer', accessor: (q: Quotation) => q.customer.company || q.customer.name },
        { header: 'Total', accessor: (q: Quotation) => q.total },
        { header: 'Status', accessor: (q: Quotation) => q.status },
      ],
      quotations,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Quotations</h1>
          <p className="mt-1 text-sm text-ink-300">Draft, send, and track the sales pipeline.</p>
        </div>
        {view === 'quotations' && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={openCreate}
                disabled={customers.length === 0}
                className={primaryButtonClass}
              >
                <Plus className="h-4 w-4" />
                New Quotation
              </button>
            )}
          </div>
        )}
      </div>

      {canViewRequests && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView('quotations')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === 'quotations' ? 'bg-cyan-accent/10 text-cyan-accent' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
            }`}
          >
            Quotations
          </button>
          <button
            type="button"
            onClick={() => setView('requests')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === 'requests' ? 'bg-cyan-accent/10 text-cyan-accent' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
            }`}
          >
            Quote Requests
          </button>
        </div>
      )}

      {view === 'requests' ? (
        <QuoteRequestsTab />
      ) : (
        <>
      {canWrite && customers.length === 0 && (
        <p className="text-sm text-ink-400">Add a customer first before creating quotations.</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="Active Quotations" value={activeCount} icon={FileSignature} />
        <StatCard label="Accepted" value={acceptedCount} icon={FileSignature} />
      </div>

      <Panel title="Quotation Registry">
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : quotations.length === 0 ? (
          <EmptyState icon={FileSignature} message="No quotations yet. Create your first quotation to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">QUOTATION #</th>
                  <th className="px-3 py-3 font-semibold">TITLE</th>
                  <th className="px-3 py-3 font-semibold">CUSTOMER</th>
                  <th className="px-3 py-3 font-semibold">TOTAL</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/erp/finance/quotations/${q.id}`}
                        className="font-mono font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                      >
                        {q.quotationNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{q.title}</td>
                    <td className="px-3 py-3 text-ink-300">{q.customer.company || q.customer.name}</td>
                    <td className="px-3 py-3 text-ink-100">{formatMoney(q.total)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone[q.status]}>{q.status}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          <button type="button" onClick={() => handleDelete(q)} aria-label="Delete quotation" className="hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
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

      {showCreate && (
        <Modal title="New Quotation" onClose={() => setShowCreate(false)}>
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
                <label className={labelClass}>TITLE</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required className={`mt-2 ${inputClass}`} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>PAYMENT TERMS</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value as PaymentTermsTemplate)}
                  className={`mt-2 ${inputClass}`}
                >
                  {PAYMENT_TERMS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
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
                <label className={labelClass}>EXPIRES</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            <div className="rounded-md border border-ink-700 px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input type="checkbox" checked={includesOrder} onChange={(e) => setIncludesOrder(e.target.checked)} />
                This quotation includes a product order (not just installation/service labor)
              </label>
              {includesOrder && (
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>AVAILABILITY</label>
                    <select
                      value={availabilityStatus}
                      onChange={(e) => setAvailabilityStatus(e.target.value as QuotationAvailability)}
                      className={`mt-2 ${inputClass}`}
                    >
                      <option value="IN_STOCK">In stock</option>
                      <option value="ORDER_PENDING">Order to be received in...</option>
                    </select>
                  </div>
                  {availabilityStatus === 'ORDER_PENDING' && (
                    <div>
                      <label className={labelClass}>DAYS FROM CONFIRMATION</label>
                      <input
                        type="number"
                        min={1}
                        value={orderDays}
                        onChange={(e) => setOrderDays(e.target.value)}
                        className={`mt-2 ${inputClass}`}
                      />
                    </div>
                  )}
                </div>
              )}
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

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Creating…' : 'Create Quotation'}
            </button>
          </form>
        </Modal>
      )}
        </>
      )}
    </div>
  )
}

export default QuotationsPage
