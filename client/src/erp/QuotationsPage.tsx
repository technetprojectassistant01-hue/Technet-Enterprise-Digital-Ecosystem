import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, FileSignature, Download, Search } from 'lucide-react'
import * as api from '../lib/api'
import type { Quotation, QuotationStatus, PaymentTermsLine, QuotationAvailability } from '../lib/api'
import { PRODUCT_LINE_OPTIONS } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useCustomers } from './useCustomers'
import { usePaymentTermLabels } from './usePaymentTermLabels'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, isAdminLike, SALES_ROLES, QUOTE_REQUEST_VIEW_ROLES } from '../lib/permissions'
import { quotationStatusTone as statusTone } from './statusTones'
import { formatMoney } from '../lib/format'
import SalesLineItemsEditor, { EMPTY_SALES_LINE_ITEM, type SalesLineItemRow } from './SalesLineItemsEditor'
import PaymentTermsLinesEditor, { EMPTY_PAYMENT_TERMS_LINE } from './PaymentTermsLinesEditor'
import QuoteRequestsTab from './QuoteRequestsTab'
import { useT } from '../i18n'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function QuotationsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, SALES_ROLES)
  const canViewRequests = hasRole(user?.role, QUOTE_REQUEST_VIEW_ROLES)
  const isAdmin = isAdminLike(user?.role)
  const { quotations: m, shared, status, productLines } = useT().erp
  const customers = useCustomers()
  const paymentTermLabels = usePaymentTermLabels()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | ''>('')
  const [filterCustomerId, setFilterCustomerId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [productLine, setProductLine] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [vatRate, setVatRate] = useState('15')
  const [validityDays, setValidityDays] = useState('15')
  const [paymentTermsLines, setPaymentTermsLines] = useState<PaymentTermsLine[]>([{ ...EMPTY_PAYMENT_TERMS_LINE }])
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
      .listQuotations({
        status: statusFilter || undefined,
        customerId: filterCustomerId || undefined,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
      })
      .then(({ quotations }) => setQuotations(quotations))
      .catch((err) => setError(err instanceof Error ? err.message : m.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, [statusFilter, filterCustomerId, from, to, search]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setFilterCustomerId('')
    setFrom('')
    setTo('')
  }

  function openCreate() {
    setCustomerId(customers[0]?.id || '')
    setContactPerson(customers[0]?.name || '')
    setTitle('')
    setProductLine('')
    setVatRate('15')
    setValidityDays('15')
    setPaymentTermsLines([{ ...EMPTY_PAYMENT_TERMS_LINE }])
    setIncludesOrder(false)
    setAvailabilityStatus('IN_STOCK')
    setOrderDays('')
    setItems([{ ...EMPTY_SALES_LINE_ITEM }])
    setFormError(null)
    setShowCreate(true)
  }

  function handleCustomerChange(id: string) {
    setCustomerId(id)
    // Pre-fill the contact person with the customer's own name - a sensible default staff can
    // override, since the actual decision-maker sometimes differs (see the Follow-Up panel).
    setContactPerson(customers.find((c) => c.id === id)?.name || '')
  }

  const liveSubtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
  const liveVatAmount = liveSubtotal * ((Number(vatRate) || 0) / 100)
  const liveTotal = liveSubtotal + liveVatAmount

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!customerId) {
      setFormError(m.selectCustomer)
      return
    }
    if (!title.trim()) {
      setFormError(m.titleRequired)
      return
    }
    if (includesOrder && availabilityStatus === 'ORDER_PENDING' && (!orderDays.trim() || Number(orderDays) <= 0)) {
      setFormError(m.orderDaysRequired)
      return
    }
    const paymentTotal = paymentTermsLines.reduce((sum, l) => sum + (Number(l.percentage) || 0), 0)
    if (Math.round(paymentTotal * 100) !== 10000) {
      setFormError(m.termsMustSum)
      return
    }

    setSubmitting(true)
    try {
      const { quotation } = await api.createQuotation({
        customerId,
        title,
        productLine: productLine || undefined,
        contactPerson: contactPerson.trim() || undefined,
        vatRate: Number(vatRate) || 0,
        validityDays: Number(validityDays) || undefined,
        paymentTermsLines: paymentTermsLines.map((l) => ({ label: l.label, percentage: Number(l.percentage) })),
        availabilityStatus: includesOrder ? availabilityStatus : null,
        orderDays: includesOrder && availabilityStatus === 'ORDER_PENDING' ? Number(orderDays) : null,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      })
      toast.success(m.savedDraft)
      setShowCreate(false)
      // Jump straight to the new quotation instead of leaving the user on the list to hunt for
      // it - same fix already applied to the quote-request conversion flow.
      navigate(`/dashboard/erp/customers/quotations/${quotation.id}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : m.createFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(q: Quotation) {
    const ok = await confirm({
      title: m.deleteTitle,
      message: m.deleteMessage(q.title),
      confirmLabel: shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteQuotation(q.id)
      toast.success(m.deleted)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.deleteFailed)
    }
  }

  const activeCount = quotations.filter((q) => q.status === 'DRAFT' || q.status === 'SENT').length
  const acceptedCount = quotations.filter((q) => q.status === 'ACCEPTED').length

  function exportCsv() {
    downloadCsv(
      'quotations',
      [
        { header: m.csv.number, accessor: (q: Quotation) => q.quotationNumber },
        { header: m.csv.title, accessor: (q: Quotation) => q.title },
        { header: m.csv.customer, accessor: (q: Quotation) => q.customer.company || q.customer.name },
        { header: m.csv.total, accessor: (q: Quotation) => q.total },
        { header: m.csv.status, accessor: (q: Quotation) => status.quotation[q.status] },
      ],
      quotations,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{m.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{m.subtitle}</p>
        </div>
        {view === 'quotations' && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
              <Download className="h-4 w-4" />
              {m.exportCsv}
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={openCreate}
                disabled={customers.length === 0}
                className={primaryButtonClass}
              >
                <Plus className="h-4 w-4" />
                {m.new}
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
            {m.tabQuotations}
          </button>
          <button
            type="button"
            onClick={() => setView('requests')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === 'requests' ? 'bg-cyan-accent/10 text-cyan-accent' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
            }`}
          >
            {m.tabCallLog}
          </button>
        </div>
      )}

      {view === 'requests' ? (
        <QuoteRequestsTab />
      ) : (
        <>
      {canWrite && customers.length === 0 && (
        <p className="text-sm text-ink-400">{m.needCustomer}</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label={m.statActive} value={activeCount} icon={FileSignature} />
        <StatCard label={m.statAccepted} value={acceptedCount} icon={FileSignature} />
      </div>

      <Panel title={m.panel}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className={labelClass}>{m.search}</label>
            <div className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400" />
              <input
                type="text"
                placeholder={m.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
              />
            </div>
          </div>
          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className={labelClass}>{m.customer}</label>
            <select value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)} className={inputClass}>
              <option value="">{m.allCustomers}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{shared.status}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as QuotationStatus | '')}
              className={inputClass}
            >
              <option value="">{m.allStatuses}</option>
              {(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as QuotationStatus[]).map((s) => (
                <option key={s} value={s}>
                  {status.quotation[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{m.from}</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{m.to}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          {(search || filterCustomerId || statusFilter || from || to) && (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-ink-400 hover:text-ink-100">
              {m.clearFilters}
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : quotations.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            message={
              search || filterCustomerId || statusFilter || from || to
                ? m.noMatch
                : m.empty
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{m.colNumber}</th>
                  <th className="px-3 py-3 font-semibold">{m.colTitle}</th>
                  <th className="px-3 py-3 font-semibold">{m.customer}</th>
                  <th className="px-3 py-3 font-semibold">{shared.totalCol}</th>
                  <th className="px-3 py-3 font-semibold">{shared.status}</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/erp/customers/quotations/${q.id}`}
                        className="font-mono font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                      >
                        {q.quotationNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{q.title}</td>
                    <td className="px-3 py-3 text-ink-300">{q.customer.company || q.customer.name}</td>
                    <td className="px-3 py-3 text-ink-100">{formatMoney(q.total)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone[q.status]}>{status.quotation[q.status]}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          <button type="button" onClick={() => handleDelete(q)} aria-label={m.deleteAria} className="hover:text-red-400">
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
        <Modal title={m.new} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{m.customer}</label>
                <select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">{m.selectCustomer}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{m.titleLabel}</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required className={`mt-2 ${inputClass}`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>{m.productLine}</label>
              <select value={productLine} onChange={(e) => setProductLine(e.target.value)} className={`mt-2 ${inputClass}`}>
                <option value="">{m.notSpecified}</option>
                {PRODUCT_LINE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {productLines[opt] ?? opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{m.contactPerson}</label>
              <input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder={m.contactPlaceholder}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{m.vat}</label>
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
                <label className={labelClass}>{m.validity}</label>
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

            <div className="rounded-md border border-ink-700 px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input type="checkbox" checked={includesOrder} onChange={(e) => setIncludesOrder(e.target.checked)} />
                {m.includesOrder}
              </label>
              {includesOrder && (
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>{m.availability}</label>
                    <select
                      value={availabilityStatus}
                      onChange={(e) => setAvailabilityStatus(e.target.value as QuotationAvailability)}
                      className={`mt-2 ${inputClass}`}
                    >
                      <option value="IN_STOCK">{m.inStock}</option>
                      <option value="ORDER_PENDING">{m.orderPending}</option>
                    </select>
                  </div>
                  {availabilityStatus === 'ORDER_PENDING' && (
                    <div>
                      <label className={labelClass}>{m.daysFromConfirmation}</label>
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
                <span>{m.subtotal}</span>
                <span>{formatMoney(liveSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-ink-300">
                <span>{m.vatLine(vatRate || 0)}</span>
                <span>{formatMoney(liveVatAmount)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-cyan-accent">
                <span>{shared.total}</span>
                <span>{formatMoney(liveTotal)}</span>
              </div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? shared.creating : m.create}
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
