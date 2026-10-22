import { useEffect, useState, type FormEvent } from 'react'
import { FileSignature, Plus, Mail } from 'lucide-react'
import * as api from '../lib/api'
import type { QuotationRequest, RequestSource, RequestCategory, PaymentTermsLine } from '../lib/api'
import { REQUEST_SOURCE_OPTIONS, REQUEST_CATEGORY_OPTIONS } from '../lib/api'
import { Panel, Modal, Badge, EmptyState, TableSkeleton, type BadgeTone } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, isAdminLike, SALES_ROLES } from '../lib/permissions'
import { useCustomers } from './useCustomers'
import { usePaymentTermLabels } from './usePaymentTermLabels'
import { formatMoney } from '../lib/format'
import SalesLineItemsEditor, { EMPTY_SALES_LINE_ITEM, type SalesLineItemRow } from './SalesLineItemsEditor'
import PaymentTermsLinesEditor, { EMPTY_PAYMENT_TERMS_LINE } from './PaymentTermsLinesEditor'
import { useT } from '../i18n'
import { useFormDraft } from '../lib/useFormDraft'
import { DraftNotice } from '../dashboard/DraftNotice'
import type { ErpDict } from '../i18n/erp/en'

type RequestsText = ErpDict['quoteRequests']

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const STATUS_TONE: Record<QuotationRequest['status'], BadgeTone> = {
  PENDING: 'warning',
  CONVERTED: 'success',
  DECLINED: 'danger',
}

function requesterName(r: QuotationRequest, unknown = 'Unknown'): string {
  return r.customer?.company || r.customer?.name || r.companyName || unknown
}

function timeAgo(iso: string, m: RequestsText) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return m.justNow
  if (mins < 60) return m.minutesAgo(mins)
  const hours = Math.floor(mins / 60)
  if (hours < 24) return m.hoursAgo(hours)
  return m.daysAgo(Math.floor(hours / 24))
}

/** Overdue = still pending, never acknowledged, and past the office's response SLA. Converting or
 * declining a request counts as "responding" on its own, so only PENDING ones can be overdue. */
function isOverdue(r: QuotationRequest, slaHours: number): boolean {
  if (r.status !== 'PENDING' || r.acknowledgedAt) return false
  return Date.now() - new Date(r.createdAt).getTime() > slaHours * 3600 * 1000
}

function ackStatusLabel(r: QuotationRequest, m: RequestsText): string {
  if (r.acknowledgedAt) return m.acknowledged(timeAgo(r.acknowledgedAt, m))
  if (r.ackDraftSavedAt) return m.draftSaved
  return m.notAcknowledged
}

/** The acknowledgement email goes to the customer, so it stays in English like the quotation PDF. */
function ackTemplate(r: QuotationRequest): string {
  const name = requesterName(r)
  return `Dear ${name},\n\nWe've received your request for ${r.description} and are preparing your quotation for you. We'll follow up shortly.\n\nBest regards,\nTechnet Engineering`
}

function QuoteRequestsTab() {
  const toast = useToast()
  const { user } = useAuth()
  const canManage = hasRole(user?.role, SALES_ROLES)
  const isAdmin = isAdminLike(user?.role)
  const { quoteRequests: m, quotations: q, shared, status, requestSources, requestSourceOptions, requestCategories } = useT().erp
  const customers = useCustomers()
  const paymentTermLabels = usePaymentTermLabels()
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
  const draftValue = {
    useExistingCustomer,
    logCustomerId,
    logCompanyName,
    logContactEmail,
    logContactPhone,
    logContactTitle,
    logOtherContactName,
    logOtherContactPhone,
    logSource,
    logRequestFor,
    logRequestForOther,
    logDescription,
    logRemarks,
  }
  const draft = useFormDraft('quote-request', draftValue, logging)

  // Convert to Quotation
  const [converting, setConverting] = useState<QuotationRequest | null>(null)
  const [convertCustomerId, setConvertCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [vatRate, setVatRate] = useState('15')
  const [validityDays, setValidityDays] = useState('15')
  const [paymentTermsLines, setPaymentTermsLines] = useState<PaymentTermsLine[]>([{ ...EMPTY_PAYMENT_TERMS_LINE }])
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

  function fillDraft(d: typeof draftValue) {
    setUseExistingCustomer(d.useExistingCustomer)
    setLogCustomerId(d.logCustomerId)
    setLogCompanyName(d.logCompanyName)
    setLogContactEmail(d.logContactEmail)
    setLogContactPhone(d.logContactPhone)
    setLogContactTitle(d.logContactTitle)
    setLogOtherContactName(d.logOtherContactName)
    setLogOtherContactPhone(d.logOtherContactPhone)
    setLogSource(d.logSource)
    setLogRequestFor(d.logRequestFor)
    setLogRequestForOther(d.logRequestForOther)
    setLogDescription(d.logDescription)
    setLogRemarks(d.logRemarks)
  }

  function openLogRequest() {
    fillDraft(draft.take({
      useExistingCustomer: true,
      logCustomerId: customers[0]?.id || '',
      logCompanyName: '',
      logContactEmail: '',
      logContactPhone: '',
      logContactTitle: '',
      logOtherContactName: '',
      logOtherContactPhone: '',
      logSource: 'PHONE_CALL' as Exclude<RequestSource,
      'PORTAL'>,
      logRequestFor: '' as RequestCategory | '',
      logRequestForOther: '',
      logDescription: '',
      logRemarks: '',
    }))
    setLogError(null)
    setLogging(true)
  }

  async function handleLogRequest(e: FormEvent) {
    e.preventDefault()
    setLogError(null)
    if (useExistingCustomer && !logCustomerId) return setLogError(m.selectCustomerError)
    if (!useExistingCustomer && !logCompanyName.trim()) return setLogError(m.companyRequired)
    if (logRequestFor === 'OTHER' && !logRequestForOther.trim()) return setLogError(m.describeRequired)
    if (!logDescription.trim()) return setLogError(m.descriptionRequired)

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
      draft.clear()
      toast.success(m.logged)
      setLogging(false)
      load()
    } catch (err) {
      setLogError(err instanceof Error ? err.message : m.logFailed)
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
    setValidityDays('15')
    setPaymentTermsLines([{ ...EMPTY_PAYMENT_TERMS_LINE }])
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
    if (!converting.customerId && !convertCustomerId) return setFormError(m.selectCustomerForRequest)
    if (!title.trim()) return setFormError(q.titleRequired)
    const paymentTotal = paymentTermsLines.reduce((sum, l) => sum + (Number(l.percentage) || 0), 0)
    if (Math.round(paymentTotal * 100) !== 10000) return setFormError(q.termsMustSum)

    setSubmitting(true)
    try {
      const { quotation } = await api.convertQuoteRequest(converting.id, {
        customerId: converting.customerId ? undefined : convertCustomerId,
        title,
        contactPerson: contactPerson.trim() || undefined,
        vatRate: Number(vatRate) || 0,
        validityDays: Number(validityDays) || undefined,
        paymentTermsLines: paymentTermsLines.map((l) => ({ label: l.label, percentage: Number(l.percentage) })),
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      })
      toast.success(m.converted)
      // Jump straight to the new quotation - the Quotations tab's own list only
      // loads once on mount, so switching tabs wouldn't show it without this.
      window.location.href = `/dashboard/erp/customers/quotations/${quotation.id}`
      return
    } catch (err) {
      setFormError(err instanceof Error ? err.message : m.convertFailed)
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
      toast.success(m.declined)
      setDeclining(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.declineFailed)
    } finally {
      setDeclineSubmitting(false)
    }
  }

  async function handleSaveNote(r: QuotationRequest) {
    const note = noteDrafts[r.id] ?? r.statusNote ?? ''
    setSavingNote(r.id)
    try {
      await api.setQuoteRequestNote(r.id, note)
      toast.success(m.noteSaved)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.noteFailed)
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
      toast.success(m.ackDraftSaved)
      setAcknowledging(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.ackDraftFailed)
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
      toast.success(m.ackSent)
      void updated
      setAcknowledging(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.ackSendFailed)
    } finally {
      setAckSaving(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title={m.panel}
        action={
          canManage && (
            <button type="button" onClick={openLogRequest} className={secondaryButtonClass}>
              <Plus className="h-4 w-4" />
              {m.logRequest}
            </button>
          )
        }
      >
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label className={labelClass}>{m.loggedBy}</label>
            <select
              value={loggedByFilter}
              onChange={(e) => setLoggedByFilter(e.target.value)}
              className={`mt-2 ${inputClass}`}
            >
              <option value="">{m.allStaff}</option>
              <option value="unassigned">{m.unassigned}</option>
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
              {m.clearFilter}
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={4} cols={3} />
        ) : requests.length === 0 ? (
          <EmptyState icon={FileSignature} message={m.empty} />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((r) => {
              const overdue = isOverdue(r, slaHours)
              return (
                <li key={r.id} className="rounded-lg bg-ink-800 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-ink-100">{requesterName(r, m.unknown)}</div>
                      <p className="mt-1 text-sm text-ink-300">{r.description}</p>
                      {r.remarks && <p className="mt-1 text-xs text-ink-400">{r.remarks}</p>}
                      <p className="mt-1 text-xs text-ink-400">
                        {new Date(r.createdAt).toLocaleString()} · {timeAgo(r.createdAt, m)}
                        {r.source !== 'PORTAL' && ` · ${m.via(requestSources[r.source])}`}
                        {r.requestFor && ` · ${r.requestFor === 'OTHER' && r.requestForOther ? r.requestForOther : requestCategories[r.requestFor]}`}
                        {` · ${r.loggedBy ? m.loggedByName(r.loggedBy.name || r.loggedBy.email) : m.viaPortal}`}
                      </p>
                      {r.convertedQuotation && (
                        <p className="mt-1 text-xs text-cyan-accent">→ {r.convertedQuotation.quotationNumber}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {overdue && <Badge tone="danger">{m.overdue}</Badge>}
                      <Badge tone={STATUS_TONE[r.status]}>{status.quoteRequest[r.status]}</Badge>
                      {canManage && r.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openAcknowledge(r)}
                            className={secondaryButtonClass}
                          >
                            <Mail className="h-4 w-4" />
                            {m.acknowledge}
                          </button>
                          <button type="button" onClick={() => openConvert(r)} className={secondaryButtonClass}>
                            {m.convert}
                          </button>
                          <button
                            type="button"
                            onClick={() => openDecline(r)}
                            className="rounded-md border border-red-400/50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-400/10"
                          >
                            {m.decline}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {r.status === 'PENDING' && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-700 pt-3">
                      <span className="text-xs text-ink-400">{m.ackLabel(ackStatusLabel(r, m))}</span>
                      {canManage && (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            value={noteDrafts[r.id] ?? r.statusNote ?? ''}
                            onChange={(e) => setNoteDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                            placeholder={m.notePlaceholder}
                            className={`${inputClass} !py-1.5 text-xs`}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNote(r)}
                            disabled={savingNote === r.id}
                            className="shrink-0 text-xs font-semibold text-cyan-accent hover:underline disabled:opacity-50"
                          >
                            {savingNote === r.id ? shared.saving : m.save}
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
        <Modal title={m.logRequest} onClose={() => setLogging(false)}>
          <form onSubmit={handleLogRequest} className="flex flex-col gap-4">
            {draft.restored && <DraftNotice onDiscard={() => fillDraft(draft.discard())} />}
            <div>
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input
                  type="checkbox"
                  checked={useExistingCustomer}
                  onChange={(e) => setUseExistingCustomer(e.target.checked)}
                />
                {m.existingCustomer}
              </label>
            </div>
            {useExistingCustomer ? (
              <div>
                <label className={labelClass}>{m.customer}</label>
                <select value={logCustomerId} onChange={(e) => setLogCustomerId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">{m.selectCustomer}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className={labelClass}>{m.companyName}</label>
                <input value={logCompanyName} onChange={(e) => setLogCompanyName(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{m.contactEmail}</label>
                <input
                  type="email"
                  value={logContactEmail}
                  onChange={(e) => setLogContactEmail(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{m.contactPhone}</label>
                <input value={logContactPhone} onChange={(e) => setLogContactPhone(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
            </div>

            <div>
              <label className={labelClass}>{m.contactTitle}</label>
              <input value={logContactTitle} onChange={(e) => setLogContactTitle(e.target.value)} className={`mt-2 ${inputClass}`} />
            </div>

            <div className="rounded-md border border-ink-700 px-4 py-3">
              <p className={labelClass}>{m.otherContact}</p>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <input
                  placeholder={m.namePlaceholder}
                  value={logOtherContactName}
                  onChange={(e) => setLogOtherContactName(e.target.value)}
                  className={inputClass}
                />
                <input
                  placeholder={m.phonePlaceholder}
                  value={logOtherContactPhone}
                  onChange={(e) => setLogOtherContactPhone(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{m.source}</label>
                <select
                  value={logSource}
                  onChange={(e) => setLogSource(e.target.value as Exclude<RequestSource, 'PORTAL'>)}
                  className={`mt-2 ${inputClass}`}
                >
                  {REQUEST_SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {requestSourceOptions[opt.value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{m.requestFor}</label>
                <select
                  value={logRequestFor}
                  onChange={(e) => setLogRequestFor(e.target.value as RequestCategory | '')}
                  className={`mt-2 ${inputClass}`}
                >
                  <option value="">{m.notSpecified}</option>
                  {REQUEST_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {requestCategories[opt.value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {logRequestFor === 'OTHER' && (
              <div>
                <label className={labelClass}>{m.describe}</label>
                <input
                  value={logRequestForOther}
                  onChange={(e) => setLogRequestForOther(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            )}

            <div>
              <label className={labelClass}>{m.askingFor}</label>
              <textarea
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                rows={3}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{m.remarks}</label>
              <textarea value={logRemarks} onChange={(e) => setLogRemarks(e.target.value)} rows={2} className={`mt-2 ${inputClass}`} />
            </div>

            {logError && <p className="text-sm text-red-400">{logError}</p>}

            <button type="submit" disabled={logSubmitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {logSubmitting ? shared.saving : m.saveRequest}
            </button>
          </form>
        </Modal>
      )}

      {converting && (
        <Modal title={m.convertTitle} onClose={() => setConverting(null)}>
          <form onSubmit={handleConvert} className="flex flex-col gap-4">
            <p className="rounded-md bg-ink-800 px-3 py-2 text-sm text-ink-300">{converting.description}</p>

            {!converting.customerId && (
              <div>
                <label className={labelClass}>{m.customerNoLink}</label>
                <select value={convertCustomerId} onChange={(e) => setConvertCustomerId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">{m.selectCustomer}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{q.titleLabel}</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>{q.contactPerson}</label>
                <input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{q.vat}</label>
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
                <label className={labelClass}>{q.validity}</label>
                <input
                  type="number"
                  min={1}
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            <PaymentTermsLinesEditor
              lines={paymentTermsLines}
              onChange={setPaymentTermsLines}
              knownLabels={paymentTermLabels}
              isAdmin={isAdmin}
            />

            <SalesLineItemsEditor items={items} onChange={setItems} />

            <div className="flex flex-col gap-1 rounded-md bg-ink-800 px-4 py-3 text-sm">
              <div className="flex items-center justify-between text-ink-300">
                <span>{q.subtotal}</span>
                <span>{formatMoney(liveSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-ink-300">
                <span>{q.vatLine(vatRate || 0)}</span>
                <span>{formatMoney(liveVatAmount)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-cyan-accent">
                <span>{shared.total}</span>
                <span>{formatMoney(liveTotal)}</span>
              </div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? shared.creating : m.createDraft}
            </button>
          </form>
        </Modal>
      )}

      {declining && (
        <Modal title={m.declineTitle} onClose={() => setDeclining(null)}>
          <form onSubmit={handleDecline} className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              {m.declineMessage(requesterName(declining, m.unknown))}
            </p>
            <div>
              <label className={labelClass}>{m.reasonOptional}</label>
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
              {declineSubmitting ? m.declining : m.decline}
            </button>
          </form>
        </Modal>
      )}

      {acknowledging && (
        <Modal title={m.ackTitle} onClose={() => setAcknowledging(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              {m.ackIntro(slaHours)}
            </p>
            <div>
              <label className={labelClass}>{m.emailBody}</label>
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
                {ackSaving === 'draft' ? shared.saving : m.saveDraft}
              </button>
              <button
                type="button"
                onClick={handleSendAck}
                disabled={ackSaving !== null}
                className={`flex-1 justify-center py-2.5 ${primaryButtonClass}`}
              >
                {ackSaving === 'send' ? m.sending : m.send}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default QuoteRequestsTab
