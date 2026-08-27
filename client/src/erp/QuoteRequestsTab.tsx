import { useEffect, useState, type FormEvent } from 'react'
import { FileSignature, Plus, Mail } from 'lucide-react'
import * as api from '../lib/api'
import type { QuotationRequest, RequestSource, RequestCategory, PaymentTermsTemplate } from '../lib/api'
import { REQUEST_SOURCE_OPTIONS, REQUEST_CATEGORY_OPTIONS, PAYMENT_TERMS_OPTIONS } from '../lib/api'
import { Panel, Modal, Badge, EmptyState, TableSkeleton, type BadgeTone } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
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

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** Overdue = still pending, never acknowledged, and past the office's response SLA. Converting or
 * declining a request counts as "responding" on its own, so only PENDING ones can be overdue. */
function isOverdue(r: QuotationRequest, slaHours: number): boolean {
  if (r.status !== 'PENDING' || r.acknowledgedAt) return false
  return Date.now() - new Date(r.createdAt).getTime() > slaHours * 3600 * 1000
}

function ackStatusLabel(r: QuotationRequest): string {
  if (r.acknowledgedAt) return `Acknowledged ${timeAgo(r.acknowledgedAt)}`
  if (r.ackDraftSavedAt) return 'Draft saved'
  return 'Not acknowledged'
}

function ackTemplate(r: QuotationRequest): string {
  const name = requesterName(r)
  return `Dear ${name},\n\nWe've received your request for ${r.description} and are preparing your quotation for you. We'll follow up shortly.\n\nBest regards,\nTechnet Engineering`
}

function QuoteRequestsTab() {
  const toast = useToast()
  const { user } = useAuth()
  const canManage = hasRole(user?.role, SALES_ROLES)
  const customers = useCustomers()
  const [requests, setRequests] = useState<QuotationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [slaHours, setSlaHours] = useState(24)

  // Staff filter - options come from a separate unfiltered fetch so picking a filter doesn't
  // shrink the dropdown down to just the currently-selected option (same reasoning as the
  // Asset Registry's Category filter, see CLAUDE.md §7c).
  const [loggedByFilter, setLoggedByFilter] = useState('')
  const [loggedByOptions, setLoggedByOptions] = useState<{ id: string; name: string }[]>([])

  // Status note (inline, per row)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [savingNote, setSavingNote] = useState<string | null>(null)

  // Acknowledgement email
  const [acknowledging, setAcknowledging] = useState<QuotationRequest | null>(null)
  const [ackBody, setAckBody] = useState('')
  const [ackSaving, setAckSaving] = useState<'draft' | 'send' | null>(null)

  // Decline (needs its own small modal, not the generic confirm(), so a reason can be captured)
  const [declining, setDeclining] = useState<QuotationRequest | null>(null)
  const [declineNote, setDeclineNote] = useState('')
  const [declineSubmitting, setDeclineSubmitting] = useState(false)

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
  const [contactPerson, setContactPerson] = useState('')
  const [vatRate, setVatRate] = useState('15')
  const [expiresAt, setExpiresAt] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermsTemplate>('FULL_ON_CONFIRMATION')
  const [items, setItems] = useState<SalesLineItemRow[]>([{ ...EMPTY_SALES_LINE_ITEM }])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .listQuoteRequests({ loggedById: loggedByFilter || undefined })
      .then(({ requests, slaHours }) => {
        setRequests(requests)
        setSlaHours(slaHours)
      })
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [loggedByFilter])

  // One-time unfiltered fetch purely to populate the staff-filter dropdown's options.
  useEffect(() => {
    api
      .listQuoteRequests()
      .then(({ requests }) => {
        const seen = new Map<string, string>()
        for (const r of requests) {
          if (r.loggedBy) seen.set(r.loggedBy.id, r.loggedBy.name || r.loggedBy.email)
        }
        setLoggedByOptions([...seen.entries()].map(([id, name]) => ({ id, name })))
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    // Prefer the decision-maker if one was recorded on the request, otherwise the customer's own name.
    setContactPerson(r.otherContactName || r.customer?.name || '')
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
        contactPerson: contactPerson.trim() || undefined,
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

  function openDecline(r: QuotationRequest) {
    setDeclining(r)
    setDeclineNote('')
  }

  async function handleDecline(e: FormEvent) {
    e.preventDefault()
    if (!declining) return
    setDeclineSubmitting(true)
    try {
      await api.declineQuoteRequest(declining.id, declineNote.trim() || undefined)
      toast.success('Request declined')
      setDeclining(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to decline request')
    } finally {
      setDeclineSubmitting(false)
    }
  }

  async function handleSaveNote(r: QuotationRequest) {
    const note = noteDrafts[r.id] ?? r.statusNote ?? ''
    setSavingNote(r.id)
    try {
      await api.setQuoteRequestNote(r.id, note)
      toast.success('Note saved')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setSavingNote(null)
    }
  }

  function openAcknowledge(r: QuotationRequest) {
    setAcknowledging(r)
    setAckBody(r.ackEmailBody || ackTemplate(r))
  }

  async function handleSaveAckDraft() {
    if (!acknowledging) return
    setAckSaving('draft')
    try {
      await api.saveQuoteRequestAcknowledgement(acknowledging.id, ackBody, 'draft')
      toast.success('Acknowledgement saved as draft')
      setAcknowledging(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save draft')
    } finally {
      setAckSaving(null)
    }
  }

  async function handleSendAck() {
    if (!acknowledging) return
    setAckSaving('send')
    try {
      const { request: updated } = await api.saveQuoteRequestAcknowledgement(acknowledging.id, ackBody, 'send')
      const to = acknowledging.contactEmail || acknowledging.customer?.email || ''
      const subject = encodeURIComponent(`Re: your request - Technet Engineering`)
      window.location.href = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(ackBody)}`
      toast.success('Acknowledgement sent - attach nothing needed, just send the email that just opened')
      void updated
      setAcknowledging(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send acknowledgement')
    } finally {
      setAckSaving(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Call Log"
        action={
          canManage && (
            <button type="button" onClick={openLogRequest} className={secondaryButtonClass}>
              <Plus className="h-4 w-4" />
              Log a Request
            </button>
          )
        }
      >
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label className={labelClass}>LOGGED BY</label>
            <select
              value={loggedByFilter}
              onChange={(e) => setLoggedByFilter(e.target.value)}
              className={`mt-2 ${inputClass}`}
            >
              <option value="">All staff</option>
              <option value="unassigned">Unassigned / portal</option>
              {loggedByOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          {loggedByFilter && (
            <button
              type="button"
              onClick={() => setLoggedByFilter('')}
              className="pb-2.5 text-xs text-ink-400 hover:text-cyan-accent"
            >
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={4} cols={3} />
        ) : requests.length === 0 ? (
          <EmptyState icon={FileSignature} message="No quote requests yet." />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((r) => {
              const overdue = isOverdue(r, slaHours)
              return (
                <li key={r.id} className="rounded-lg bg-ink-800 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-ink-100">{requesterName(r)}</div>
                      <p className="mt-1 text-sm text-ink-300">{r.description}</p>
                      {r.remarks && <p className="mt-1 text-xs text-ink-400">{r.remarks}</p>}
                      <p className="mt-1 text-xs text-ink-500">
                        {new Date(r.createdAt).toLocaleString()} · {timeAgo(r.createdAt)}
                        {r.source !== 'PORTAL' && ` · via ${r.source === 'PHONE_CALL' ? 'phone call' : r.source.toLowerCase()}`}
                        {r.requestFor && ` · ${REQUEST_CATEGORY_OPTIONS.find((o) => o.value === r.requestFor)?.label || r.requestForOther}`}
                        {' · logged by '}
                        {r.loggedBy ? r.loggedBy.name || r.loggedBy.email : 'submitted via portal'}
                      </p>
                      {r.convertedQuotation && (
                        <p className="mt-1 text-xs text-cyan-accent">→ {r.convertedQuotation.quotationNumber}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {overdue && <Badge tone="danger">OVERDUE</Badge>}
                      <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                      {canManage && r.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openAcknowledge(r)}
                            className={secondaryButtonClass}
                          >
                            <Mail className="h-4 w-4" />
                            Acknowledge
                          </button>
                          <button type="button" onClick={() => openConvert(r)} className={secondaryButtonClass}>
                            Convert
                          </button>
                          <button
                            type="button"
                            onClick={() => openDecline(r)}
                            className="rounded-md border border-red-400/50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-400/10"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {r.status === 'PENDING' && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-700 pt-3">
                      <span className="text-xs text-ink-400">Acknowledgement: {ackStatusLabel(r)}</span>
                      {canManage && (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            value={noteDrafts[r.id] ?? r.statusNote ?? ''}
                            onChange={(e) => setNoteDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                            placeholder="Status note (e.g. awaiting supplier pricing)"
                            className={`${inputClass} !py-1.5 text-xs`}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNote(r)}
                            disabled={savingNote === r.id}
                            className="shrink-0 text-xs font-semibold text-cyan-accent hover:underline disabled:opacity-50"
                          >
                            {savingNote === r.id ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      )}
                      {!canManage && r.statusNote && <span className="text-xs text-ink-300">{r.statusNote}</span>}
                    </div>
                  )}
                </li>
              )
            })}
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
                <label className={labelClass}>CONTACT PERSON</label>
                <input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
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

      {declining && (
        <Modal title="Decline request" onClose={() => setDeclining(null)}>
          <form onSubmit={handleDecline} className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              Decline the quote request from {requesterName(declining)}?
            </p>
            <div>
              <label className={labelClass}>REASON (OPTIONAL)</label>
              <textarea
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <button
              type="submit"
              disabled={declineSubmitting}
              className="justify-center rounded-md bg-red-400 py-2.5 text-sm font-semibold text-ink-950 hover:bg-red-300 disabled:opacity-50"
            >
              {declineSubmitting ? 'Declining…' : 'Decline'}
            </button>
          </form>
        </Modal>
      )}

      {acknowledging && (
        <Modal title="Send acknowledgement" onClose={() => setAcknowledging(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              Satisfies the {slaHours}h SLA even before the priced quotation is ready. Save as a
              draft if you're not ready to send yet, or send it now.
            </p>
            <div>
              <label className={labelClass}>EMAIL BODY</label>
              <textarea
                value={ackBody}
                onChange={(e) => setAckBody(e.target.value)}
                rows={6}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveAckDraft}
                disabled={ackSaving !== null}
                className={`flex-1 justify-center py-2.5 ${secondaryButtonClass}`}
              >
                {ackSaving === 'draft' ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={handleSendAck}
                disabled={ackSaving !== null}
                className={`flex-1 justify-center py-2.5 ${primaryButtonClass}`}
              >
                {ackSaving === 'send' ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default QuoteRequestsTab
