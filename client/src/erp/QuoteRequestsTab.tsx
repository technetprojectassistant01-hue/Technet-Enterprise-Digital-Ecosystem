import { useEffect, useState, type FormEvent } from 'react'
import { FileSignature, Plus } from 'lucide-react'
import * as api from '../lib/api'
import type { QuotationRequest, RequestSource, RequestCategory, PaymentTermsTemplate } from '../lib/api'
import { REQUEST_SOURCE_OPTIONS, REQUEST_CATEGORY_OPTIONS, PAYMENT_TERMS_OPTIONS } from '../lib/api'
import { Panel, Modal, Badge, EmptyState, TableSkeleton, type BadgeTone } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, SALES_ROLES } from '../lib/permissions'
import { useCustomers } from './useCustomers'
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

function requesterName(r: QuotationRequest): string {
  return r.customer?.company || r.customer?.name || r.companyName || 'Unknown'
}

function QuoteRequestsTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canManage = hasRole(user?.role, SALES_ROLES)
  const customers = useCustomers()
  const [requests, setRequests] = useState<QuotationRequest[]>([])
  const [loading, setLoading] = useState(true)

  // Log a Request (manual staff intake)
  const [logging, setLogging] = useState(false)
  const [useExistingCustomer, setUseExistingCustomer] = useState(true)
  const [logCustomerId, setLogCustomerId] = useState('')
  const [logCompanyName, setLogCompanyName] = useState('')
  const [logContactEmail, setLogContactEmail] = useState('')
  const [logContactPhone, setLogContactPhone] = useState('')
  const [logContactTitle, setLogContactTitle] = useState('')
  const [logOtherContactName, setLogOtherContactName] = useState('')
  const [logOtherContactPhone, setLogOtherContactPhone] = useState('')
  const [logSource, setLogSource] = useState<Exclude<RequestSource, 'PORTAL'>>('PHONE_CALL')
  const [logRequestFor, setLogRequestFor] = useState<RequestCategory | ''>('')
  const [logRequestForOther, setLogRequestForOther] = useState('')
  const [logDescription, setLogDescription] = useState('')
  const [logRemarks, setLogRemarks] = useState('')
  const [logError, setLogError] = useState<string | null>(null)
  const [logSubmitting, setLogSubmitting] = useState(false)

  // Convert to Quotation
  const [converting, setConverting] = useState<QuotationRequest | null>(null)
  const [convertCustomerId, setConvertCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [vatRate, setVatRate] = useState('15')
  const [expiresAt, setExpiresAt] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermsTemplate>('FULL_ON_CONFIRMATION')
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

  function openLogRequest() {
    setUseExistingCustomer(true)
    setLogCustomerId(customers[0]?.id || '')
    setLogCompanyName('')
    setLogContactEmail('')
    setLogContactPhone('')
    setLogContactTitle('')
    setLogOtherContactName('')
    setLogOtherContactPhone('')
    setLogSource('PHONE_CALL')
    setLogRequestFor('')
    setLogRequestForOther('')
    setLogDescription('')
    setLogRemarks('')
    setLogError(null)
    setLogging(true)
  }

  async function handleLogRequest(e: FormEvent) {
    e.preventDefault()
    setLogError(null)
    if (useExistingCustomer && !logCustomerId) return setLogError('Select a customer')
    if (!useExistingCustomer && !logCompanyName.trim()) return setLogError('Enter a company name')
    if (logRequestFor === 'OTHER' && !logRequestForOther.trim()) return setLogError('Describe the request')
    if (!logDescription.trim()) return setLogError('Description is required')

    setLogSubmitting(true)
    try {
      await api.createQuoteRequest({
        customerId: useExistingCustomer ? logCustomerId : undefined,
        companyName: useExistingCustomer ? undefined : logCompanyName.trim(),
        contactEmail: logContactEmail.trim() || undefined,
        contactPhone: logContactPhone.trim() || undefined,
        contactTitle: logContactTitle.trim() || undefined,
        otherContactName: logOtherContactName.trim() || undefined,
        otherContactPhone: logOtherContactPhone.trim() || undefined,
        source: logSource,
        requestFor: logRequestFor || undefined,
        requestForOther: logRequestFor === 'OTHER' ? logRequestForOther.trim() : undefined,
        description: logDescription.trim(),
        remarks: logRemarks.trim() || undefined,
      })
      toast.success('Request logged')
      setLogging(false)
      load()
    } catch (err) {
      setLogError(err instanceof Error ? err.message : 'Failed to log request')
    } finally {
      setLogSubmitting(false)
    }
  }

  function openConvert(r: QuotationRequest) {
    setConverting(r)
    setConvertCustomerId(r.customerId || customers[0]?.id || '')
    setTitle(r.description.slice(0, 60))
    setVatRate('15')
    setExpiresAt('')
    setPaymentTerms('FULL_ON_CONFIRMATION')
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
    if (!converting.customerId && !convertCustomerId) return setFormError('Select a customer for this request')
    if (!title.trim()) return setFormError('Title is required')

    setSubmitting(true)
    try {
      const { quotation } = await api.convertQuoteRequest(converting.id, {
        customerId: converting.customerId ? undefined : convertCustomerId,
        title,
        vatRate: Number(vatRate) || 0,
        expiresAt: expiresAt || undefined,
        paymentTerms,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      })
      toast.success('Converted to a draft quotation')
      // Jump straight to the new quotation - the Quotations tab's own list only
      // loads once on mount, so switching tabs wouldn't show it without this.
      window.location.href = `/dashboard/erp/finance/quotations/${quotation.id}`
      return
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to convert request')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDecline(r: QuotationRequest) {
    const ok = await confirm({
      title: 'Decline request',
      message: `Decline the quote request from ${requesterName(r)}?`,
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
      <Panel
        title="Customer Quote Requests"
        action={
          canManage && (
            <button type="button" onClick={openLogRequest} className={secondaryButtonClass}>
              <Plus className="h-4 w-4" />
              Log a Request
            </button>
          )
        }
      >
        {loading ? (
          <TableSkeleton rows={4} cols={3} />
        ) : requests.length === 0 ? (
          <EmptyState icon={FileSignature} message="No quote requests yet." />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-lg bg-ink-800 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-ink-100">{requesterName(r)}</div>
                    <p className="mt-1 text-sm text-ink-300">{r.description}</p>
                    {r.remarks && <p className="mt-1 text-xs text-ink-400">{r.remarks}</p>}
                    <p className="mt-1 text-xs text-ink-500">
                      {new Date(r.createdAt).toLocaleString()}
                      {r.source !== 'PORTAL' && ` · via ${r.source === 'PHONE_CALL' ? 'phone call' : r.source.toLowerCase()}`}
                      {r.requestFor && ` · ${REQUEST_CATEGORY_OPTIONS.find((o) => o.value === r.requestFor)?.label || r.requestForOther}`}
                    </p>
                    {r.convertedQuotation && (
                      <p className="mt-1 text-xs text-cyan-accent">→ {r.convertedQuotation.quotationNumber}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                    {canManage && r.status === 'PENDING' && (
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

      {logging && (
        <Modal title="Log a Request" onClose={() => setLogging(false)}>
          <form onSubmit={handleLogRequest} className="flex flex-col gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input
                  type="checkbox"
                  checked={useExistingCustomer}
                  onChange={(e) => setUseExistingCustomer(e.target.checked)}
                />
                This is an existing customer
              </label>
            </div>
            {useExistingCustomer ? (
              <div>
                <label className={labelClass}>CUSTOMER</label>
                <select value={logCustomerId} onChange={(e) => setLogCustomerId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className={labelClass}>COMPANY NAME</label>
                <input value={logCompanyName} onChange={(e) => setLogCompanyName(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CONTACT EMAIL</label>
                <input
                  type="email"
                  value={logContactEmail}
                  onChange={(e) => setLogContactEmail(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>CONTACT PHONE</label>
                <input value={logContactPhone} onChange={(e) => setLogContactPhone(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
            </div>

            <div>
              <label className={labelClass}>TITLE OF CONTACT (their role, e.g. Facilities Manager)</label>
              <input value={logContactTitle} onChange={(e) => setLogContactTitle(e.target.value)} className={`mt-2 ${inputClass}`} />
            </div>

            <div className="rounded-md border border-ink-700 px-4 py-3">
              <p className={labelClass}>OTHER CONTACT (if the caller isn't the decision-maker)</p>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <input
                  placeholder="Name"
                  value={logOtherContactName}
                  onChange={(e) => setLogOtherContactName(e.target.value)}
                  className={inputClass}
                />
                <input
                  placeholder="Phone"
                  value={logOtherContactPhone}
                  onChange={(e) => setLogOtherContactPhone(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>SOURCE</label>
                <select
                  value={logSource}
                  onChange={(e) => setLogSource(e.target.value as Exclude<RequestSource, 'PORTAL'>)}
                  className={`mt-2 ${inputClass}`}
                >
                  {REQUEST_SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>REQUEST FOR</label>
                <select
                  value={logRequestFor}
                  onChange={(e) => setLogRequestFor(e.target.value as RequestCategory | '')}
                  className={`mt-2 ${inputClass}`}
                >
                  <option value="">Not specified</option>
                  {REQUEST_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {logRequestFor === 'OTHER' && (
              <div>
                <label className={labelClass}>DESCRIBE</label>
                <input
                  value={logRequestForOther}
                  onChange={(e) => setLogRequestForOther(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            )}

            <div>
              <label className={labelClass}>WHAT ARE THEY ASKING FOR</label>
              <textarea
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                rows={3}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>REMARKS (extra detail, e.g. which unit/location)</label>
              <textarea value={logRemarks} onChange={(e) => setLogRemarks(e.target.value)} rows={2} className={`mt-2 ${inputClass}`} />
            </div>

            {logError && <p className="text-sm text-red-400">{logError}</p>}

            <button type="submit" disabled={logSubmitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {logSubmitting ? 'Saving…' : 'Save Request'}
            </button>
          </form>
        </Modal>
      )}

      {converting && (
        <Modal title="Convert to Quotation" onClose={() => setConverting(null)}>
          <form onSubmit={handleConvert} className="flex flex-col gap-4">
            <p className="rounded-md bg-ink-800 px-3 py-2 text-sm text-ink-300">{converting.description}</p>

            {!converting.customerId && (
              <div>
                <label className={labelClass}>CUSTOMER (this request had no linked customer)</label>
                <select value={convertCustomerId} onChange={(e) => setConvertCustomerId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>TITLE</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required className={`mt-2 ${inputClass}`} />
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-4">
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
