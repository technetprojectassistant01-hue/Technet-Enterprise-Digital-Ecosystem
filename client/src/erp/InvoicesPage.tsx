import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, CheckCircle2, Receipt } from 'lucide-react'
import * as api from '../lib/api'
import type { Invoice, InvoiceStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useCustomers } from './useCustomers'
import { useProjects } from './useProjects'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { invoiceStatusTone as statusTone } from './statusTones'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']

interface FormState {
  customerId: string
  projectId: string
  invoiceNumber: string
  amount: string
  status: InvoiceStatus
  dueDate: string
}

const EMPTY_FORM: FormState = {
  customerId: '',
  projectId: '',
  invoiceNumber: '',
  amount: '',
  status: 'DRAFT',
  dueDate: '',
}

function InvoicesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const customers = useCustomers()
  const projects = useProjects()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Invoice | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .listInvoices()
      .then(({ invoices }) => setInvoices(invoices))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load invoices'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setForm({ ...EMPTY_FORM, customerId: customers[0]?.id || '' })
    setFormError(null)
    setEditing(null)
    setShowCreate(true)
  }

  function openEdit(inv: Invoice) {
    setForm({
      customerId: inv.customerId,
      projectId: inv.projectId || '',
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
      status: inv.status,
      dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : '',
    })
    setFormError(null)
    setEditing(inv)
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
    if (!form.invoiceNumber.trim()) {
      setFormError('Invoice number is required')
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
        await api.updateInvoice(editing.id, {
          invoiceNumber: form.invoiceNumber,
          amount,
          status: form.status,
          dueDate: form.dueDate || undefined,
          projectId: form.projectId || null,
        })
      } else {
        await api.createInvoice({
          customerId: form.customerId,
          projectId: form.projectId || null,
          invoiceNumber: form.invoiceNumber,
          amount,
          status: form.status,
          dueDate: form.dueDate || undefined,
        })
      }
      toast.success(editing ? 'Invoice updated' : 'Invoice created')
      closeForm()
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save invoice')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(inv: Invoice) {
    const ok = await confirm({
      title: 'Delete invoice',
      message: `Delete invoice ${inv.invoiceNumber}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteInvoice(inv.id)
      toast.success(`Deleted invoice ${inv.invoiceNumber}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete invoice')
    }
  }

  async function markPaid(inv: Invoice) {
    try {
      await api.updateInvoice(inv.id, { status: 'PAID' })
      toast.success(`Invoice ${inv.invoiceNumber} marked paid`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update invoice')
    }
  }

  const totalOutstanding = invoices
    .filter((i) => i.status === 'SENT' || i.status === 'OVERDUE')
    .reduce((sum, i) => sum + Number(i.amount), 0)
  const totalPaid = invoices.filter((i) => i.status === 'PAID').reduce((sum, i) => sum + Number(i.amount), 0)

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
          New Invoice
        </button>
      </div>

      {customers.length === 0 && (
        <p className="text-sm text-ink-400">Add a customer first before creating invoices.</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="TOTAL PAID" value={`$${totalPaid.toLocaleString()}`} />
        <StatCard label="OUTSTANDING" value={`$${totalOutstanding.toLocaleString()}`} deltaTone="warning" />
      </div>

      <Panel>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={7} />
        ) : invoices.length === 0 ? (
          <EmptyState icon={Receipt} message="No invoices yet. Create your first invoice to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">INVOICE #</th>
                  <th className="px-3 py-3 font-semibold">CUSTOMER</th>
                  <th className="px-3 py-3 font-semibold">PROJECT</th>
                  <th className="px-3 py-3 font-semibold">AMOUNT</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  <th className="px-3 py-3 font-semibold">DUE</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-medium text-ink-100">{inv.invoiceNumber}</td>
                    <td className="px-3 py-3 text-ink-300">{inv.customer.company || inv.customer.name}</td>
                    <td className="px-3 py-3 text-ink-300">
                      {projects.find((p) => p.id === inv.projectId)?.name || '—'}
                    </td>
                    <td className="px-3 py-3 text-ink-100">${Number(inv.amount).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone[inv.status]}>{inv.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-ink-400">{inv.dueDate ? inv.dueDate.slice(0, 10) : '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        {inv.status !== 'PAID' && (
                          <button type="button" onClick={() => markPaid(inv)} aria-label="Mark paid" className="hover:text-cyan-accent">
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        <button type="button" onClick={() => openEdit(inv)} aria-label="Edit invoice" className="hover:text-ink-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(inv)} aria-label="Delete invoice" className="hover:text-red-400">
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
        <Modal title={editing ? 'Edit Invoice' : 'New Invoice'} onClose={closeForm}>
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
              <label className={labelClass}>PROJECT (OPTIONAL)</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                className={`mt-2 ${inputClass}`}
              >
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>INVOICE NUMBER</label>
              <input
                value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceStatus })}
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
              <label className={labelClass}>DUE DATE</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Invoice'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default InvoicesPage
