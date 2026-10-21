import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Mail, X, Trash2, Upload, Paperclip, Pencil } from 'lucide-react'
import * as api from '../lib/api'
import type {
  Quotation,
  QuotationFollowUp,
  QuotationFollowUpOutcome,
  Document,
  PaymentTermsLine,
  QuotationAvailability,
} from '../lib/api'
import { QUOTATION_FOLLOWUP_OUTCOMES, PRODUCT_LINE_OPTIONS } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass, dangerButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, isAdminLike, SALES_ROLES } from '../lib/permissions'
import { quotationStatusTone } from './statusTones'
import { formatMoney } from '../lib/format'
import { useCustomers } from './useCustomers'
import { usePaymentTermLabels } from './usePaymentTermLabels'
import SalesLineItemsEditor, { EMPTY_SALES_LINE_ITEM, type SalesLineItemRow } from './SalesLineItemsEditor'
import PaymentTermsLinesEditor, { EMPTY_PAYMENT_TERMS_LINE } from './PaymentTermsLinesEditor'
import { useT } from '../i18n'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, SALES_ROLES)
  const isAdmin = isAdminLike(user?.role)
  const { quotationDetail: m, quotations: q, shared, followUpOutcomes, productLines, lineItems, salesLines } = useT().erp
  const customers = useCustomers()
  const paymentTermLabels = usePaymentTermLabels()

  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const [editingItems, setEditingItems] = useState(false)
  const [editCustomerId, setEditCustomerId] = useState('')
  const [editVatRate, setEditVatRate] = useState('15')
  const [editPaymentTermsLines, setEditPaymentTermsLines] = useState<PaymentTermsLine[]>([{ ...EMPTY_PAYMENT_TERMS_LINE }])
  const [editIncludesOrder, setEditIncludesOrder] = useState(false)
  const [editAvailabilityStatus, setEditAvailabilityStatus] = useState<QuotationAvailability>('IN_STOCK')
  const [editOrderDays, setEditOrderDays] = useState('')
  const [editItems, setEditItems] = useState<SalesLineItemRow[]>([{ ...EMPTY_SALES_LINE_ITEM }])
  const [editError, setEditError] = useState<string | null>(null)
  const [savingItems, setSavingItems] = useState(false)

  const [poReference, setPoReference] = useState('')
  const [savingPoReference, setSavingPoReference] = useState(false)

  const [contactPersonInput, setContactPersonInput] = useState('')
  const [savingContactPerson, setSavingContactPerson] = useState(false)

  const [productLineInput, setProductLineInput] = useState('')
  const [savingProductLine, setSavingProductLine] = useState(false)

  const [followUps, setFollowUps] = useState<QuotationFollowUp[]>([])
  const [followUpsLoading, setFollowUpsLoading] = useState(true)
  const [spokenTo, setSpokenTo] = useState('')
  const [outcome, setOutcome] = useState<QuotationFollowUpOutcome>('CALL_BACK')
  const [callScheduledOn, setCallScheduledOn] = useState('')
  const [logError, setLogError] = useState<string | null>(null)
  const [loggingCall, setLoggingCall] = useState(false)

  const [documents, setDocuments] = useState<Document[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getQuotation(id)
      .then(({ quotation }) => {
        setQuotation(quotation)
        setPoReference(quotation.poReference || '')
        setContactPersonInput(quotation.contactPerson || '')
        setProductLineInput(quotation.productLine || '')
        // Default "spoken to" for the next logged call to the quotation's contact person -
        // but only if the user hasn't already started typing a different name in.
        setSpokenTo((prev) => prev || quotation.contactPerson || '')
      })
      .catch((err) => setError(err instanceof Error ? err.message : m.loadFailed))
      .finally(() => setLoading(false))
  }

  function loadFollowUps() {
    if (!id) return
    setFollowUpsLoading(true)
    api
      .listQuotationFollowUps(id)
      .then(({ followUps }) => setFollowUps(followUps))
      .catch(() => setFollowUps([]))
      .finally(() => setFollowUpsLoading(false))
  }

  function loadDocuments() {
    if (!id) return
    setDocumentsLoading(true)
    api
      .listDocuments({ quotationId: id })
      .then(({ documents }) => setDocuments(documents))
      .catch(() => setDocuments([]))
      .finally(() => setDocumentsLoading(false))
  }

  useEffect(load, [id])
  useEffect(loadFollowUps, [id])
  useEffect(loadDocuments, [id])

  async function handleMarkStatus(status: 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED') {
    if (!quotation) return
    setUpdating(true)
    try {
      await api.updateQuotation(quotation.id, { status })
      toast.success(m.statusUpdated)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.statusFailed)
    } finally {
      setUpdating(false)
    }
  }

  function openEditItems() {
    if (!quotation) return
    setEditCustomerId(quotation.customerId)
    setEditVatRate(String(Number(quotation.vatRate)))
    setEditPaymentTermsLines(
      quotation.paymentTermsLines.length > 0 ? quotation.paymentTermsLines : [{ ...EMPTY_PAYMENT_TERMS_LINE }],
    )
    setEditIncludesOrder(!!quotation.availabilityStatus)
    setEditAvailabilityStatus(quotation.availabilityStatus || 'IN_STOCK')
    setEditOrderDays(quotation.orderDays ? String(quotation.orderDays) : '')
    setEditItems(
      quotation.items.map((item) => ({
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: item.unitPrice,
      })),
    )
    setEditError(null)
    setEditingItems(true)
  }

  async function handleSaveItems(e: FormEvent) {
    e.preventDefault()
    setEditError(null)
    if (!quotation) return
    if (!editCustomerId) return setEditError(q.selectCustomer)
    if (editIncludesOrder && editAvailabilityStatus === 'ORDER_PENDING' && (!editOrderDays.trim() || Number(editOrderDays) <= 0)) {
      return setEditError(q.orderDaysRequired)
    }
    const editPaymentTotal = editPaymentTermsLines.reduce((sum, l) => sum + (Number(l.percentage) || 0), 0)
    if (Math.round(editPaymentTotal * 100) !== 10000) {
      return setEditError(q.termsMustSum)
    }

    setSavingItems(true)
    try {
      await api.updateQuotation(quotation.id, {
        customerId: editCustomerId,
        vatRate: Number(editVatRate) || 0,
        paymentTermsLines: editPaymentTermsLines.map((l) => ({ label: l.label, percentage: Number(l.percentage) })),
        availabilityStatus: editIncludesOrder ? editAvailabilityStatus : null,
        orderDays: editIncludesOrder && editAvailabilityStatus === 'ORDER_PENDING' ? Number(editOrderDays) : null,
        items: editItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      })
      toast.success(m.updated)
      setEditingItems(false)
      load()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : m.saveFailed)
    } finally {
      setSavingItems(false)
    }
  }

  async function handleSaveContactPerson() {
    if (!quotation) return
    setSavingContactPerson(true)
    try {
      await api.updateQuotation(quotation.id, { contactPerson: contactPersonInput.trim() || null })
      toast.success(m.saved)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.saveFailedShort)
    } finally {
      setSavingContactPerson(false)
    }
  }

  async function handleSaveProductLine() {
    if (!quotation) return
    setSavingProductLine(true)
    try {
      await api.updateQuotation(quotation.id, { productLine: productLineInput || null })
      toast.success(m.saved)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.saveFailedShort)
    } finally {
      setSavingProductLine(false)
    }
  }

  async function handleSavePoReference() {
    if (!quotation) return
    setSavingPoReference(true)
    try {
      await api.updateQuotation(quotation.id, { poReference: poReference.trim() || null })
      toast.success(m.saved)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.saveFailedShort)
    } finally {
      setSavingPoReference(false)
    }
  }

  async function handleLogCall(e: FormEvent) {
    e.preventDefault()
    setLogError(null)
    if (!id) return
    if (!spokenTo.trim()) return setLogError(m.spokenToRequired)
    if (outcome === 'CALL_BACK' && !callScheduledOn) return setLogError(m.scheduleRequired)

    setLoggingCall(true)
    try {
      await api.createQuotationFollowUp(id, {
        spokenTo: spokenTo.trim(),
        outcome,
        callScheduledOn: outcome === 'CALL_BACK' ? callScheduledOn : undefined,
      })
      toast.success(m.callLogged)
      setSpokenTo(quotation?.contactPerson || '')
      setOutcome('CALL_BACK')
      setCallScheduledOn('')
      loadFollowUps()
    } catch (err) {
      setLogError(err instanceof Error ? err.message : m.logFailed)
    } finally {
      setLoggingCall(false)
    }
  }

  async function handleUploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !id) return
    setUploading(true)
    try {
      const fileData = await readFileAsDataUrl(file)
      await api.createDocument({ title: file.name, category: 'QUOTATION', quotationId: id, fileData, fileName: file.name })
      toast.success(m.attachmentUploaded)
      loadDocuments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.attachmentUploadFailed)
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteAttachment(doc: Document) {
    const ok = await confirm({
      title: m.deleteAttachmentTitle,
      message: m.deleteAttachmentMessage(doc.title),
      confirmLabel: shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteDocument(doc.id)
      toast.success(m.attachmentDeleted)
      loadDocuments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.attachmentDeleteFailed)
    }
  }

  // Cross-origin cookie download - can't be a plain <a href target="_blank"> (prod auth cookies
  // are SameSite=None; Partitioned, which aren't sent on a direct top-level navigation). Same
  // fix as DocumentsPage's handleDownload; see CLAUDE.md §9's "PDF/file download buttons" note.
  async function handleDownloadAttachment(doc: Document) {
    setDownloadingAttachmentId(doc.id)
    try {
      const res = await fetch(api.documentDownloadUrl(doc.id), { credentials: 'include' })
      if (!res.ok) throw new Error(m.attachmentDownloadFailed)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.attachmentDownloadFailed)
    } finally {
      setDownloadingAttachmentId(null)
    }
  }

  async function handleDownloadPdf() {
    if (!quotation) return
    setDownloading(true)
    try {
      const res = await fetch(api.quotationPdfUrl(quotation.id), { credentials: 'include' })
      if (!res.ok) throw new Error(m.pdfFailed)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quotation.quotationNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.pdfFailed)
    } finally {
      setDownloading(false)
    }
  }

  async function handleEmailCustomer() {
    if (!quotation) return
    setEmailing(true)
    try {
      const res = await fetch(api.quotationPdfUrl(quotation.id), { credentials: 'include' })
      if (!res.ok) throw new Error(m.pdfFailed)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quotation.quotationNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      const subject = encodeURIComponent(`Quotation ${quotation.quotationNumber} - Technet Engineering`)
      const body = encodeURIComponent(
        `Dear ${quotation.customer.name},\n\nPlease find attached quotation ${quotation.quotationNumber} (just downloaded to your device - please attach it to this email before sending).\n\nBest regards,\nTechnet Engineering`,
      )
      const to = quotation.customer.email || ''
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
      toast.success(m.emailReady)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.emailFailed)
    } finally {
      setEmailing(false)
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !quotation) return <EmptyState icon={X} message={error || m.notFound} />

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/erp/customers/quotations"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {m.back}
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-ink-100">{quotation.quotationNumber}</h1>
            <Badge tone={quotationStatusTone[quotation.status]}>{m.display[quotation.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {quotation.title} · {quotation.customer.company || quotation.customer.name}
            {` · ${m.validFor(quotation.validityDays)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleDownloadPdf} disabled={downloading} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            {downloading ? m.downloading : m.downloadPdf}
          </button>
          <button type="button" onClick={handleEmailCustomer} disabled={emailing} className={primaryButtonClass}>
            <Mail className="h-4 w-4" />
            {emailing ? m.preparing : m.emailCustomer}
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: q.deleteTitle,
                  message: q.deleteMessage(quotation.title),
                  confirmLabel: shared.delete,
                  tone: 'danger',
                })
                if (!ok) return
                try {
                  await api.deleteQuotation(quotation.id)
                  toast.success(q.deleted)
                  window.location.href = '/dashboard/erp/customers/quotations'
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : q.deleteFailed)
                }
              }}
              className={dangerButtonClass}
            >
              <Trash2 className="h-4 w-4" />
              {shared.delete}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-ink-400">
        {m.emailNote}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title={m.customer} className="lg:col-span-1">
          <div className="flex flex-col gap-1 text-sm text-ink-300">
            <div className="font-medium text-ink-100">{quotation.customer.company || quotation.customer.name}</div>
            {quotation.customer.email && <div>{quotation.customer.email}</div>}
            {quotation.customer.phone && <div>{quotation.customer.phone}</div>}
            {quotation.customer.address && <div>{quotation.customer.address}</div>}
            {quotation.customer.vatNumber && <div>{m.vatShort(quotation.customer.vatNumber)}</div>}
          </div>
          <div className="mt-4 border-t border-ink-800 pt-4">
            <label className={labelClass}>{q.contactPerson}</label>
            <p className="mt-1 text-xs text-ink-400">{m.contactHint}</p>
            <div className="mt-2 flex items-end gap-2">
              <input
                value={contactPersonInput}
                onChange={(e) => setContactPersonInput(e.target.value)}
                disabled={!canWrite}
                className={`flex-1 ${inputClass}`}
              />
              {canWrite && (
                <button type="button" onClick={handleSaveContactPerson} disabled={savingContactPerson} className={secondaryButtonClass}>
                  {savingContactPerson ? shared.saving : m.save}
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 border-t border-ink-800 pt-4">
            <label className={labelClass}>{m.productLine}</label>
            <div className="mt-2 flex items-end gap-2">
              <select
                value={productLineInput}
                onChange={(e) => setProductLineInput(e.target.value)}
                disabled={!canWrite}
                className={`flex-1 ${inputClass}`}
              >
                <option value="">{q.notSpecified}</option>
                {PRODUCT_LINE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {productLines[opt] ?? opt}
                  </option>
                ))}
              </select>
              {canWrite && (
                <button type="button" onClick={handleSaveProductLine} disabled={savingProductLine} className={secondaryButtonClass}>
                  {savingProductLine ? shared.saving : m.save}
                </button>
              )}
            </div>
          </div>
        </Panel>

        <Panel title={m.terms} className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs font-semibold tracking-widest text-ink-400">{shared.paymentTerms}</span>
              <p className="mt-1 text-ink-200">
                {quotation.paymentTermsLines.map((l) => `${l.label} ${l.percentage}%`).join(', ')}
              </p>
            </div>
            {quotation.availabilityStatus && (
              <div>
                <span className="text-xs font-semibold tracking-widest text-ink-400">{q.availability}</span>
                <p className="mt-1 text-ink-200">
                  {quotation.availabilityStatus === 'IN_STOCK'
                    ? q.inStock
                    : m.orderIn(quotation.orderDays ?? 0)}
                </p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title={m.lineItems}
        action={
          canWrite &&
          quotation.status === 'DRAFT' &&
          !editingItems && (
            <button type="button" onClick={openEditItems} className={secondaryButtonClass}>
              <Pencil className="h-4 w-4" />
              {m.edit}
            </button>
          )
        }
      >
        {canWrite && quotation.status === 'DRAFT' && !editingItems && (
          <p className="mb-3 text-xs text-ink-400">
            {m.draftHint}
          </p>
        )}
        {editingItems ? (
          <form onSubmit={handleSaveItems} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{q.customer}</label>
                <select value={editCustomerId} onChange={(e) => setEditCustomerId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">{q.selectCustomer}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-w-[200px]">
                <label className={labelClass}>{q.vat}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editVatRate}
                  onChange={(e) => setEditVatRate(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            <PaymentTermsLinesEditor
              lines={editPaymentTermsLines}
              onChange={setEditPaymentTermsLines}
              knownLabels={paymentTermLabels}
              isAdmin={isAdmin}
            />

            <div className="rounded-md border border-ink-700 px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input type="checkbox" checked={editIncludesOrder} onChange={(e) => setEditIncludesOrder(e.target.checked)} />
                {q.includesOrder}
              </label>
              {editIncludesOrder && (
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>{q.availability}</label>
                    <select
                      value={editAvailabilityStatus}
                      onChange={(e) => setEditAvailabilityStatus(e.target.value as QuotationAvailability)}
                      className={`mt-2 ${inputClass}`}
                    >
                      <option value="IN_STOCK">{q.inStock}</option>
                      <option value="ORDER_PENDING">{q.orderPending}</option>
                    </select>
                  </div>
                  {editAvailabilityStatus === 'ORDER_PENDING' && (
                    <div>
                      <label className={labelClass}>{q.daysFromConfirmation}</label>
                      <input
                        type="number"
                        min={1}
                        value={editOrderDays}
                        onChange={(e) => setEditOrderDays(e.target.value)}
                        className={`mt-2 ${inputClass}`}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <SalesLineItemsEditor items={editItems} onChange={setEditItems} />

            {editError && <p className="text-sm text-red-400">{editError}</p>}

            <div className="flex gap-3">
              <button type="submit" disabled={savingItems} className={primaryButtonClass}>
                {savingItems ? shared.saving : shared.saveChanges}
              </button>
              <button type="button" onClick={() => setEditingItems(false)} className={secondaryButtonClass}>
                {shared.cancel}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                    <th className="px-3 py-3 font-semibold">#</th>
                    <th className="px-3 py-3 font-semibold">{shared.description}</th>
                    <th className="px-3 py-3 font-semibold">{lineItems.qty}</th>
                    <th className="px-3 py-3 font-semibold">{salesLines.unitPrice}</th>
                    <th className="px-3 py-3 font-semibold">{salesLines.totalAmount}</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item, i) => (
                    <tr key={item.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-3 align-top font-mono text-xs text-ink-400">{String(i + 1).padStart(2, '0')}</td>
                      <td className="whitespace-pre-wrap px-3 py-3 font-medium text-ink-100">{item.description}</td>
                      <td className="px-3 py-3 align-top text-ink-300">{item.quantity}</td>
                      <td className="px-3 py-3 align-top text-ink-300">{formatMoney(item.unitPrice)}</td>
                      <td className="px-3 py-3 align-top text-ink-100">{formatMoney(Number(item.unitPrice) * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col items-end gap-1 text-sm">
              <div className="flex w-56 justify-between text-ink-300">
                <span>{q.subtotal}</span>
                <span>{formatMoney(quotation.subtotal)}</span>
              </div>
              <div className="flex w-56 justify-between text-ink-300">
                <span>{q.vatLine(Number(quotation.vatRate))}</span>
                <span>{formatMoney(quotation.vatAmount)}</span>
              </div>
              <div className="flex w-56 justify-between border-t border-ink-700 pt-1 font-semibold text-cyan-accent">
                <span>{shared.total}</span>
                <span>{formatMoney(quotation.total)}</span>
              </div>
            </div>
          </>
        )}
      </Panel>

      <Panel title={m.attachments}>
        {documentsLoading ? (
          <TableSkeleton rows={2} cols={2} />
        ) : documents.length === 0 ? (
          <EmptyState icon={Paperclip} message={m.noAttachments} />
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between rounded-md bg-ink-800 px-3 py-2 text-sm">
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(doc)}
                  disabled={downloadingAttachmentId === doc.id}
                  className="text-left text-ink-100 hover:text-cyan-accent hover:underline disabled:opacity-60"
                >
                  {doc.title} <span className="text-ink-400">({formatSize(doc.sizeBytes)})</span>
                  {downloadingAttachmentId === doc.id && <span className="text-ink-400">{m.downloadingInline}</span>}
                </button>
                {canWrite && (
                  <button type="button" onClick={() => handleDeleteAttachment(doc)} className="text-ink-400 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canWrite && (
          <label className={`mt-4 inline-flex w-fit cursor-pointer items-center gap-2 ${secondaryButtonClass}`}>
            <Upload className="h-4 w-4" />
            {uploading ? m.uploading : m.attachFile}
            <input type="file" className="hidden" onChange={handleUploadAttachment} disabled={uploading} />
          </label>
        )}
      </Panel>

      <Panel title={m.followUp}>
        <div className="flex flex-col gap-4">
          {canWrite && quotation.status === 'DRAFT' && (
            <button type="button" onClick={() => handleMarkStatus('SENT')} disabled={updating} className={`w-fit ${primaryButtonClass}`}>
              {m.markSent}
            </button>
          )}
          {canWrite && quotation.status === 'SENT' && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleMarkStatus('ACCEPTED')}
                disabled={updating}
                className={primaryButtonClass}
              >
                {m.markApproved}
              </button>
              <button
                type="button"
                onClick={() => handleMarkStatus('REJECTED')}
                disabled={updating}
                className="rounded-md border border-red-400/50 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10"
              >
                {m.markNotApproved}
              </button>
              <button
                type="button"
                onClick={() => handleMarkStatus('EXPIRED')}
                disabled={updating}
                className="text-xs text-ink-400 hover:text-ink-100 hover:underline"
              >
                {m.markExpired}
              </button>
            </div>
          )}

          {(quotation.status === 'ACCEPTED' || canWrite) && (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className={labelClass}>{m.poReference}</label>
                <input
                  value={poReference}
                  onChange={(e) => setPoReference(e.target.value)}
                  placeholder={m.poPlaceholder}
                  disabled={!canWrite}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              {canWrite && (
                <button type="button" onClick={handleSavePoReference} disabled={savingPoReference} className={secondaryButtonClass}>
                  {savingPoReference ? shared.saving : m.save}
                </button>
              )}
            </div>
          )}

          <div className="border-t border-ink-800 pt-4">
            <p className={labelClass}>{m.callHistory}</p>
            {followUpsLoading ? (
              <TableSkeleton rows={2} cols={2} />
            ) : followUps.length === 0 ? (
              <p className="mt-2 text-sm text-ink-400">{m.noCalls}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {followUps.map((f) => (
                  <li key={f.id} className="rounded-md bg-ink-800 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-100">{f.spokenTo}</span>
                      <span className="text-xs text-ink-400">{new Date(f.calledAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-ink-300">{followUpOutcomes[f.outcome]}</p>
                    {f.callScheduledOn && (
                      <p className="mt-1 text-xs text-cyan-accent">{m.callScheduled(f.callScheduledOn.slice(0, 10))}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canWrite && (
            <form onSubmit={handleLogCall} className="flex flex-col gap-3 border-t border-ink-800 pt-4">
              <p className={labelClass}>{m.logCall}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{m.spokenTo}</label>
                  <input value={spokenTo} onChange={(e) => setSpokenTo(e.target.value)} className={`mt-2 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>{m.outcome}</label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as QuotationFollowUpOutcome)}
                    className={`mt-2 ${inputClass}`}
                  >
                    {QUOTATION_FOLLOWUP_OUTCOMES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {followUpOutcomes[opt.value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {outcome === 'CALL_BACK' && (
                <div>
                  <label className={labelClass}>{m.callScheduledOn}</label>
                  <input
                    type="date"
                    value={callScheduledOn}
                    onChange={(e) => setCallScheduledOn(e.target.value)}
                    className={`mt-2 ${inputClass}`}
                  />
                </div>
              )}
              {logError && <p className="text-sm text-red-400">{logError}</p>}
              <button type="submit" disabled={loggingCall} className={`w-fit ${secondaryButtonClass}`}>
                {loggingCall ? shared.saving : m.logCallButton}
              </button>
            </form>
          )}
        </div>
      </Panel>
    </div>
  )
}

export default QuotationDetailPage
