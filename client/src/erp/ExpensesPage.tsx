import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react'
import * as api from '../lib/api'
import type { Expense } from '../lib/api'
import { Panel, StatCard, Modal, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

interface FormState {
  category: string
  description: string
  amount: string
  date: string
}

const EMPTY_FORM: FormState = { category: '', description: '', amount: '', date: '' }

function ExpensesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Expense | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .listExpenses()
      .then(({ expenses }) => setExpenses(expenses))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load expenses'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setEditing(null)
    setShowCreate(true)
  }

  function openEdit(exp: Expense) {
    setForm({
      category: exp.category,
      description: exp.description || '',
      amount: exp.amount,
      date: exp.date.slice(0, 10),
    })
    setFormError(null)
    setEditing(exp)
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
    if (!form.category.trim()) {
      setFormError('Category is required')
      return
    }
    if (!amount || amount <= 0) {
      setFormError('Amount must be a positive number')
      return
    }

    setSubmitting(true)
    try {
      const input = {
        category: form.category,
        description: form.description || undefined,
        amount,
        date: form.date || undefined,
      }
      if (editing) {
        await api.updateExpense(editing.id, input)
      } else {
        await api.createExpense(input)
      }
      toast.success(editing ? 'Expense updated' : 'Expense added')
      closeForm()
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save expense')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(exp: Expense) {
    const ok = await confirm({
      title: 'Delete expense',
      message: `Delete this ${exp.category} expense? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteExpense(exp.id)
      toast.success('Expense deleted')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete expense')
    }
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark"
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </button>
      </div>

      <StatCard label="TOTAL EXPENSES" value={`$${totalExpenses.toLocaleString()}`} />

      <Panel>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : expenses.length === 0 ? (
          <EmptyState icon={CreditCard} message="No expenses yet. Add your first expense to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">CATEGORY</th>
                  <th className="px-3 py-3 font-semibold">DESCRIPTION</th>
                  <th className="px-3 py-3 font-semibold">AMOUNT</th>
                  <th className="px-3 py-3 font-semibold">DATE</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-medium text-ink-100">{exp.category}</td>
                    <td className="px-3 py-3 text-ink-300">{exp.description || '—'}</td>
                    <td className="px-3 py-3 text-ink-100">${Number(exp.amount).toLocaleString()}</td>
                    <td className="px-3 py-3 text-ink-400">{exp.date.slice(0, 10)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        <button type="button" onClick={() => openEdit(exp)} aria-label="Edit expense" className="hover:text-ink-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(exp)} aria-label="Delete expense" className="hover:text-red-400">
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
        <Modal title={editing ? 'Edit Expense' : 'Add Expense'} onClose={closeForm}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>CATEGORY</label>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>DESCRIPTION</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                <label className={labelClass}>DATE</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Add Expense'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ExpensesPage
