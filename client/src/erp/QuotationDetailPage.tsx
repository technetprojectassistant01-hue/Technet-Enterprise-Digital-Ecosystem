import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Mail, X, Trash2, Upload, Paperclip } from 'lucide-react'
import * as api from '../lib/api'
import type { Quotation, QuotationFollowUp, QuotationFollowUpOutcome, Document } from '../lib/api'
import { QUOTATION_FOLLOWUP_OUTCOMES } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass, dangerButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, SALES_ROLES } from '../lib/permissions'
import { quotationStatusTone } from './statusTones'
import { formatMoney } from '../lib/format'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const FOLLOWUP_LABEL: Record<QuotationFollowUpOutcome, string> = Object.fromEntries(
  QUOTATION_FOLLOWUP_OUTCOMES.map((o) => [o.value, o.label]),
) as Record<QuotationFollowUpOutcome, string>

function displayStatus(status: Quotation['status']): string {
  if (status === 'ACCEPTED') return 'Approved'
  if (status === 'REJECTED') return 'Not Approved'
  if (status === 'EXPIRED') return 'Expired'
  return 'In Progress'
}

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

  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const [poReference, setPoReference] = useState('')
  const [savingPoReference, setSavingPoReference] = useState(false)

  const [contactPersonInput, setContactPersonInput] = useState('')
  const [savingContactPerson, setSavingContactPerson] = useState(false)

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

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getQuotation(id)
      .then(({ quotation }) => {
        setQuotation(quotation)
        setPoReference(quotation.poReference || '')
        setContactPersonInput(quotation.contactPerson || '')
        // Default "spoken to" for the next logged call to the quotation's contact person -
        // but only if the user hasn't already started typing a different name in.
        setSpokenTo((prev) => prev || quotation.contactPerson || '')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load quotation'))
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
      toast.success('Status updated')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  async function handleSaveContactPerson() {
    if (!quotation) return
    setSavingContactPerson(true)
    try {
      await api.updateQuotation(quotation.id, { contactPerson: contactPersonInput.trim() || null })
      toast.success('Saved')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingContactPerson(false)
    }
  }

  async function handleSavePoReference() {
    if (!quotation) return
    setSavingPoReference(true)
    try {
      await api.updateQuotation(quotation.id, { poReference: poReference.trim() || null })
      toast.success('Saved')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingPoReference(false)
    }
  }

  async function handleLogCall(e: FormEvent) {
    e.preventDefault()
    setLogError(null)
    if (!id) return
    if (!spokenTo.trim()) return setLogError('Who was spoken to is required')
    if (outcome === 'CALL_BACK' && !callScheduledOn) return setLogError('Call schedule date is required')

    setLoggingCall(true)
    try {
      await api.createQuotationFollowUp(id, {
        spokenTo: spokenTo.trim(),
        outcome,
        callScheduledOn: outcome === 'CALL_BACK' ? callScheduledOn : undefined,
      })
      toast.success('Call logged')
      setSpokenTo(quotation?.contactPerson || '')
      setOutcome('CALL_BACK')
      setCallScheduledOn('')
      loadFollowUps()
    } catch (err) {
      setLogError(err instanceof Error ? err.message : 'Failed to log call')
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
      toast.success('Attachment uploaded')
      loadDocuments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload attachment')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteAttachment(doc: Document) {
    const ok = await confirm({
      title: 'Delete attachment',
      message: `Delete "${doc.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteDocument(doc.id)
      toast.success('Attachment deleted')
      loadDocuments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete attachment')
    }
  }

  async function handleEmailCustomer() {
    if (!quotation) return
    setEmailing(true)
    try {
      const res = await fetch(api.quotationPdfUrl(quotation.id), { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to download PDF')
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
      toast.success('PDF downloaded - attach it manually in the email that just opened')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prepare email')
    } finally {
      setEmailing(false)
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
            <Badge tone={quotationStatusTone[quotation.status]}>{displayStatus(quotation.status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {quotation.title} · {quotation.customer.company || quotation.customer.name}
            {quotation.expiresAt && ` · Expires ${quotation.expiresAt.slice(0, 10)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href={api.quotationPdfUrl(quotation.id)} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <button type="button" onClick={handleEmailCustomer} disabled={emailing} className={primaryButtonClass}>
            <Mail className="h-4 w-4" />
            {emailing ? 'Preparing…' : 'Email Customer'}
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={async () => {
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
              }}
              className={dangerButtonClass}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-ink-500">
        "Email Customer" downloads the PDF and opens a draft email addressed to the customer - browsers can't
        auto-attach a file for security reasons, so you'll need to attach the downloaded PDF yourself before sending.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Customer" className="lg:col-span-1">
          <div className="flex flex-col gap-1 text-sm text-ink-300">
            <div className="font-medium text-ink-100">{quotation.customer.company || quotation.customer.name}</div>
            {quotation.customer.email && <div>{quotation.customer.email}</div>}
            {quotation.customer.phone && <div>{quotation.customer.phone}</div>}
            {quotation.customer.address && <div>{quotation.customer.address}</div>}
            {quotation.customer.vatNumber && <div>VAT: {quotation.customer.vatNumber}</div>}
          </div>
          <div className="mt-4 border-t border-ink-800 pt-4">
            <label className={labelClass}>CONTACT PERSON</label>
            <p className="mt-1 text-xs text-ink-500">Who to talk to about this quotation - defaults for logged calls below.</p>
            <div className="mt-2 flex items-end gap-2">
              <input
                value={contactPersonInput}
                onChange={(e) => setContactPersonInput(e.target.value)}
                disabled={!canWrite}
                className={`flex-1 ${inputClass}`}
              />
              {canWrite && (
                <button type="button" onClick={handleSaveContactPerson} disabled={savingContactPerson} className={secondaryButtonClass}>
                  {savingContactPerson ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Terms" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs font-semibold tracking-widest text-ink-500">PAYMENT TERMS</span>
              <p className="mt-1 text-ink-200">
                {quotation.paymentTerms === 'FULL_ON_CONFIRMATION' && '100% on confirmation of order'}
                {quotation.paymentTerms === 'SPLIT_60_40_20' && '60% confirmation, 40% progress, 20% completion'}
                {quotation.paymentTerms === 'SPLIT_50_50' && '50% confirmation, 50% completion'}
              </p>
            </div>
            {quotation.availabilityStatus && (
              <div>
                <span className="text-xs font-semibold tracking-widest text-ink-500">AVAILABILITY</span>
                <p className="mt-1 text-ink-200">
                  {quotation.availabilityStatus === 'IN_STOCK'
                    ? 'In stock'
                    : `Order to be received in ${quotation.orderDays} day${quotation.orderDays === 1 ? '' : 's'} from confirmation`}
                </p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Line Items">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                <th className="px-3 py-3 font-semibold">#</th>
                <th className="px-3 py-3 font-semibold">DESCRIPTION</th>
                <th className="px-3 py-3 font-semibold">QTY</th>
                <th className="px-3 py-3 font-semibold">UNIT PRICE</th>
                <th className="px-3 py-3 font-semibold">TOTAL AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item, i) => (
                <tr key={item.id} className="border-b border-ink-800 last:border-0">
                  <td className="px-3 py-3 align-top font-mono text-xs text-ink-500">{String(i + 1).padStart(2, '0')}</td>
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

      <Panel title="Attachments">
        {documentsLoading ? (
          <TableSkeleton rows={2} cols={2} />
        ) : documents.length === 0 ? (
          <EmptyState icon={Paperclip} message="No datasheets or brochures attached yet." />
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between rounded-md bg-ink-800 px-3 py-2 text-sm">
                <a
                  href={api.documentDownloadUrl(doc.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink-100 hover:text-cyan-accent hover:underline"
                >
                  {doc.title} <span className="text-ink-500">({formatSize(doc.sizeBytes)})</span>
                </a>
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
            {uploading ? 'Uploading…' : 'Attach a file'}
            <input type="file" className="hidden" onChange={handleUploadAttachment} disabled={uploading} />
          </label>
        )}
      </Panel>

      <Panel title="Follow-Up">
        <div className="flex flex-col gap-4">
          {canWrite && quotation.status === 'DRAFT' && (
            <button type="button" onClick={() => handleMarkStatus('SENT')} disabled={updating} className={`w-fit ${primaryButtonClass}`}>
              Mark as Sent
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
                Mark Approved
              </button>
              <button
                type="button"
                onClick={() => handleMarkStatus('REJECTED')}
                disabled={updating}
                className="rounded-md border border-red-400/50 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10"
              >
                Mark Not Approved
              </button>
              <button
                type="button"
                onClick={() => handleMarkStatus('EXPIRED')}
                disabled={updating}
                className="text-xs text-ink-400 hover:text-ink-100 hover:underline"
              >
                Mark Expired
              </button>
            </div>
          )}

          {(quotation.status === 'ACCEPTED' || canWrite) && (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className={labelClass}>PO / CONFIRMATION REFERENCE</label>
                <input
                  value={poReference}
                  onChange={(e) => setPoReference(e.target.value)}
                  placeholder="e.g. PO#1234 received via email"
                  disabled={!canWrite}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              {canWrite && (
                <button type="button" onClick={handleSavePoReference} disabled={savingPoReference} className={secondaryButtonClass}>
                  {savingPoReference ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          )}

          <div className="border-t border-ink-800 pt-4">
            <p className={labelClass}>CALL HISTORY</p>
            {followUpsLoading ? (
              <TableSkeleton rows={2} cols={2} />
            ) : followUps.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">No calls logged yet.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {followUps.map((f) => (
                  <li key={f.id} className="rounded-md bg-ink-800 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-100">{f.spokenTo}</span>
                      <span className="text-xs text-ink-500">{new Date(f.calledAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-ink-300">{FOLLOWUP_LABEL[f.outcome]}</p>
                    {f.callScheduledOn && (
                      <p className="mt-1 text-xs text-cyan-accent">Call scheduled: {f.callScheduledOn.slice(0, 10)}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canWrite && (
            <form onSubmit={handleLogCall} className="flex flex-col gap-3 border-t border-ink-800 pt-4">
              <p className={labelClass}>LOG A CALL</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>SPOKEN TO</label>
                  <input value={spokenTo} onChange={(e) => setSpokenTo(e.target.value)} className={`mt-2 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>OUTCOME</label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as QuotationFollowUpOutcome)}
                    className={`mt-2 ${inputClass}`}
                  >
                    {QUOTATION_FOLLOWUP_OUTCOMES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {outcome === 'CALL_BACK' && (
                <div>
                  <label className={labelClass}>CALL SCHEDULED ON</label>
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
                {loggingCall ? 'Saving…' : 'Log Call'}
              </button>
            </form>
          )}
        </div>
      </Panel>
    </div>
  )
}

export default QuotationDetailPage
