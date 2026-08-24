import { useEffect, useState, type FormEvent } from 'react'
import { FileSignature } from 'lucide-react'
import * as api from '../lib/api'
import type { QuotationRequest } from '../lib/api'
import { Panel, Modal, Badge, EmptyState, TableSkeleton, type BadgeTone } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { formatMoney } from '../lib/format'
import SalesLineItemsEditor, { EMPTY_SALES_LINE_ITEM, type SalesLineItemRow } from './SalesLineItemsEditor'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const STATUS_TONE: Record<QuotationRequest['status'], BadgeTone> = {
  PENDING: 'warning',
  CONVERTED: 'success',
  DECLINED: 'danger',
}

function QuoteRequestsTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const [requests, setRequests] = useState<QuotationRequest[]>([])
  const [loading, setLoading] = useState(true)

  const [converting, setConverting] = useState<QuotationRequest | null>(null)
  const [quotationNumber, setQuotationNumber] = useState('')
  const [title, setTitle] = useState('')
  const [vatRate, setVatRate] = useState('15')
  const [expiresAt, setExpiresAt] = useState('')
  const [items, setItems] = useState<SalesLineItemRow[]>([{ ...EMPTY_SALES_LINE_ITEM }])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .listQuoteRequests()
      .then(({ requests }) => setRequests(requests))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openConvert(r: QuotationRequest) {
    setConverting(r)
    setQuotationNumber('')
    setTitle(r.description.slice(0, 60))
    setVatRate('15')
    setExpiresAt('')
    setItems([{ ...EMPTY_SALES_LINE_ITEM }])
    setFormError(null)
  }

  const liveSubtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
  const liveVatAmount = liveSubtotal * ((Number(vatRate) || 0) / 100)
  const liveTotal = liveSubtotal + liveVatAmount

  async function handleConvert(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!converting) return
    if (!quotationNumber.trim()) return setFormError('Quotation number is required')
    if (!title.trim()) return setFormError('Title is required')

    setSubmitting(true)
    try {
      await api.convertQuoteRequest(converting.id, {
        quotationNumber,
        title,
        vatRate: Number(vatRate) || 0,
        expiresAt: expiresAt || undefined,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      })
      toast.success('Converted to a draft quotation')
      setConverting(null)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to convert request')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDecline(r: QuotationRequest) {
    const ok = await confirm({
      title: 'Decline request',
      message: `Decline the quote request from ${r.customer.company || r.customer.name}?`,
      confirmLabel: 'Decline',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.declineQuoteRequest(r.id)
      toast.success('Request declined')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to decline request')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Customer Quote Requests">
        {loading ? (
          <TableSkeleton rows={4} cols={3} />
        ) : requests.length === 0 ? (
          <EmptyState icon={FileSignature} message="No quote requests from customers yet." />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-lg bg-ink-800 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-ink-100">{r.customer.company || r.customer.name}</div>
                    <p className="mt-1 text-sm text-ink-300">{r.description}</p>
                    <p className="mt-1 text-xs text-ink-500">{new Date(r.createdAt).toLocaleString()}</p>
                    {r.convertedQuotation && (
                      <p className="mt-1 text-xs text-cyan-accent">→ {r.convertedQuotation.quotationNumber}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                    {r.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openConvert(r)} className={secondaryButtonClass}>
                          Convert
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecline(r)}
                          className="rounded-md border border-red-400/50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-400/10"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {converting && (
        <Modal title="Convert to Quotation" onClose={() => setConverting(null)}>
          <form onSubmit={handleConvert} className="flex flex-col gap-4">
            <p className="rounded-md bg-ink-800 px-3 py-2 text-sm text-ink-300">{converting.description}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>QUOTATION NUMBER</label>
                <input
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value)}
                  required
                  className={`mt-2 ${inputClass}`}
                />
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
            </div>
            <div>
              <label className={labelClass}>TITLE</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required className={`mt-2 ${inputClass}`} />
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
              {submitting ? 'Creating…' : 'Create Draft Quotation'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default QuoteRequestsTab
