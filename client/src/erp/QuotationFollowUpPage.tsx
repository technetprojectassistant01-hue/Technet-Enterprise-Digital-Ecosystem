import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PhoneCall } from 'lucide-react'
import * as api from '../lib/api'
import type { Quotation } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { quotationStatusTone } from './statusTones'
import { formatMoney } from '../lib/format'
import { useCustomers } from './useCustomers'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function QuotationFollowUpPage() {
  const customers = useCustomers()
  const [mode, setMode] = useState<'customer' | 'date'>('customer')

  const [customerId, setCustomerId] = useState('')
  const [customerQuotations, setCustomerQuotations] = useState<Quotation[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)

  const [date, setDate] = useState(today())
  const [dateQuotations, setDateQuotations] = useState<Quotation[]>([])
  const [dateLoading, setDateLoading] = useState(false)

  useEffect(() => {
    if (mode !== 'customer' || !customerId) {
      setCustomerQuotations([])
      return
    }
    setCustomerLoading(true)
    api
      .listQuotations()
      .then(({ quotations }) =>
        setCustomerQuotations(quotations.filter((q) => q.customerId === customerId && q.status !== 'DRAFT')),
      )
      .catch(() => setCustomerQuotations([]))
      .finally(() => setCustomerLoading(false))
  }, [mode, customerId])

  useEffect(() => {
    if (mode !== 'date' || !date) {
      setDateQuotations([])
      return
    }
    setDateLoading(true)
    api
      .listQuotations({ from: date, to: date })
      .then(({ quotations }) => setDateQuotations(quotations))
      .catch(() => setDateQuotations([]))
      .finally(() => setDateLoading(false))
  }, [mode, date])

  function renderList(list: Quotation[], loading: boolean, emptyMessage: string) {
    if (loading) return <TableSkeleton rows={3} cols={4} />
    if (list.length === 0) return <EmptyState icon={PhoneCall} message={emptyMessage} />
    return (
      <ul className="flex flex-col gap-2">
        {list.map((q) => (
          <li key={q.id}>
            <Link
              to={`/dashboard/erp/finance/quotations/${q.id}`}
              className="flex items-center justify-between rounded-md bg-ink-800 px-4 py-3 text-sm hover:bg-ink-700"
            >
              <div>
                <div className="font-mono font-medium text-ink-100">{q.quotationNumber}</div>
                <div className="mt-0.5 text-ink-300">
                  {q.title} · {q.customer.company || q.customer.name}
                </div>
                <div className="mt-0.5 text-xs text-ink-500">{q.issuedAt.slice(0, 10)}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-ink-100">{formatMoney(q.total)}</span>
                <Badge tone={quotationStatusTone[q.status]}>{q.status}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Follow-Up of Quotation</h1>
        <p className="mt-1 text-sm text-ink-300">
          Find a quotation to see its call history, log a new call, or record whether it was approved.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('customer')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === 'customer' ? 'bg-cyan-accent/10 text-cyan-accent' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
          }`}
        >
          By Customer
        </button>
        <button
          type="button"
          onClick={() => setMode('date')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === 'date' ? 'bg-cyan-accent/10 text-cyan-accent' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
          }`}
        >
          By Date
        </button>
      </div>

      {mode === 'customer' ? (
        <Panel title="By Customer">
          <div className="mb-4 max-w-sm">
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
          {customerId ? (
            renderList(customerQuotations, customerLoading, 'No sent quotations for this customer yet.')
          ) : (
            <p className="text-sm text-ink-500">Select a customer to see their quotations.</p>
          )}
        </Panel>
      ) : (
        <Panel title="By Date">
          <div className="mb-4 max-w-sm">
            <label className={labelClass}>DATE</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-2 ${inputClass}`} />
          </div>
          {renderList(dateQuotations, dateLoading, 'No quotations issued on this date.')}
        </Panel>
      )}
    </div>
  )
}

export default QuotationFollowUpPage
