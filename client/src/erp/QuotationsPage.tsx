import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import * as api from '../lib/api'
import type { Quotation, QuotationStatus } from '../lib/api'
import { Panel, StatCard, Modal } from '../dashboard/ui'
import { useCustomers } from './useCustomers'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const STATUSES: QuotationStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']

const statusClasses: Record<QuotationStatus, string> = {
  DRAFT: 'bg-ink-700 text-ink-300',
  SENT: 'bg-amber-400/10 text-amber-400',
  ACCEPTED: 'bg-cyan-accent/10 text-cyan-accent',
  REJECTED: 'bg-red-400/10 text-red-400',
  EXPIRED: 'bg-ink-700 text-ink-400',
}

interface FormState {
  customerId: string
  title: string
  amount: string
  status: QuotationStatus
  expiresAt: string
}

const EMPTY_FORM: FormState = { customerId: '', title: '', amount: '', status: 'DRAFT', expiresAt: '' }

function QuotationsPage() {
  const customers = useCustomers()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Quotation | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
    setForm({ ...EMPTY_FORM, customerId: customers[0]?.id || '' })
    setFormError(null)
    setEditing(null)
    setShowCreate(true)
  }

  function openEdit(q: Quotation) {
    setForm({
      customerId: q.customerId,
      title: q.title,
      amount: q.amount,
      status: q.status,
      expiresAt: q.expiresAt ? q.expiresAt.slice(0, 10) : '',
    })
    setFormError(null)
    setEditing(q)
    setShowCreate(false)
  }

  function closeForm() {
    setShowCreate(false)
    setEditing(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const amount = Number(form.amount)
    if (!form.title.trim()) {
      setFormError('Title is required')
      return
    }
    if (!amount || amount <= 0) {
      setFormError('Amount must be a positive number')
      return
    }
    if (!editing && !form.customerId) {
      setFormError('Select a customer')
      return
    }

    setSubmitting(true)
    try {
      if (editing) {
        await api.updateQuotation(editing.id, {
          title: form.title,
          amount,
          status: form.status,
          expiresAt: form.expiresAt || undefined,
        })
      } else {
        await api.createQuotation({
          customerId: form.customerId,
          title: form.title,
          amount,
          status: form.status,
          expiresAt: form.expiresAt || undefined,
        })
      }
      closeForm()
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save quotation')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(q: Quotation) {
    if (!confirm(`Delete quotation "${q.title}"? This cannot be undone.`)) return
    try {
      await api.deleteQuotation(q.id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete quotation')
    }
  }

  const activeCount = quotations.filter((q) => q.status === 'DRAFT' || q.status === 'SENT').length
  const acceptedCount = quotations.filter((q) => q.status === 'ACCEPTED').length

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
          New Quotation
        </button>
      </div>

      {customers.length === 0 && (
        <p className="text-sm text-ink-400">Add a customer first before creating quotations.</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="ACTIVE QUOTATIONS" value={activeCount} />
        <StatCard label="ACCEPTED" value={acceptedCount} />
      </div>

      <Panel>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-sm text-ink-400">Loading quotations…</p>
        ) : quotations.length === 0 ? (
          <p className="text-sm text-ink-400">No quotations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">TITLE</th>
                  <th className="px-3 py-3 font-semibold">CUSTOMER</th>
                  <th className="px-3 py-3 font-semibold">AMOUNT</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-medium text-ink-100">{q.title}</td>
                    <td className="px-3 py-3 text-ink-300">{q.customer.company || q.customer.name}</td>
                    <td className="px-3 py-3 text-ink-100">${Number(q.amount).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${statusClasses[q.status]}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        <button type="button" onClick={() => openEdit(q)} aria-label="Edit quotation" className="hover:text-ink-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(q)} aria-label="Delete quotation" className="hover:text-red-400">
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

      {(showCreate || editing) && (
        <Modal title={editing ? 'Edit Quotation' : 'New Quotation'} onClose={closeForm}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!editing && (
              <div>
                <label className={labelClass}>CUSTOMER</label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelClass}>TITLE</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>AMOUNT</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>STATUS</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as QuotationStatus })}
                  className={`mt-2 ${inputClass}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>EXPIRES</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Quotation'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default QuotationsPage
