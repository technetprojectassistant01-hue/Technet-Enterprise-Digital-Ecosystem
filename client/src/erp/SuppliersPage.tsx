import { useEffect, useState, type FormEvent } from 'react'
import { Search, Plus, Pencil, Trash2, Truck, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { Supplier } from '../lib/api'
import { Panel, StatCard, Modal, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, PROCUREMENT_ROLES } from '../lib/permissions'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

interface FormState {
  name: string
  contactName: string
  email: string
  phone: string
  address: string
  paymentTerms: string
}

const EMPTY_FORM: FormState = { name: '', contactName: '', email: '', phone: '', address: '', paymentTerms: '' }

function toFormState(s: Supplier): FormState {
  return {
    name: s.name,
    contactName: s.contactName || '',
    email: s.email || '',
    phone: s.phone || '',
    address: s.address || '',
    paymentTerms: s.paymentTerms || '',
  }
}

function SuppliersPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, PROCUREMENT_ROLES)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<Supplier | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load(searchValue = search) {
    setLoading(true)
    api
      .listSuppliers({ search: searchValue || undefined })
      .then(({ suppliers }) => setSuppliers(suppliers))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load suppliers'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setEditing(null)
    setShowCreate(true)
  }

  function openEdit(s: Supplier) {
    setForm(toFormState(s))
    setFormError(null)
    setEditing(s)
    setShowCreate(false)
  }

  function closeForm() {
    setShowCreate(false)
    setEditing(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.name.trim()) {
      setFormError('Name is required')
      return
    }

    setSubmitting(true)
    try {
      const input = {
        name: form.name,
        contactName: form.contactName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        paymentTerms: form.paymentTerms || undefined,
      }
      if (editing) {
        await api.updateSupplier(editing.id, input)
      } else {
        await api.createSupplier(input)
      }
      toast.success(editing ? 'Supplier updated' : 'Supplier created')
      closeForm()
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save supplier')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(s: Supplier) {
    const ok = await confirm({
      title: 'Delete supplier',
      message: `Delete supplier "${s.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteSupplier(s.id)
      toast.success(`Deleted ${s.name}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete supplier')
    }
  }

  function exportCsv() {
    downloadCsv(
      'suppliers',
      [
        { header: 'Name', accessor: (s: Supplier) => s.name },
        { header: 'Contact', accessor: (s: Supplier) => s.contactName },
        { header: 'Email', accessor: (s: Supplier) => s.email },
        { header: 'Phone', accessor: (s: Supplier) => s.phone },
        { header: 'Payment Terms', accessor: (s: Supplier) => s.paymentTerms },
      ],
      suppliers,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Supplier Directory</h1>
          <p className="mt-1 text-sm text-ink-300">Manage global engineering vendor relationships and compliance.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            Export List
          </button>
          {canWrite && (
            <button type="button" onClick={openCreate} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              Add Supplier
            </button>
          )}
        </div>
      </div>

      <StatCard label="TOTAL SUPPLIERS" value={suppliers.length} icon={Truck} />

      <Panel title="Suppliers Ledger">
        <div className="mb-4 flex flex-1 max-w-sm items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search by name, contact, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(search)}
            className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : suppliers.length === 0 ? (
          <EmptyState icon={Truck} message="No suppliers yet. Add your first supplier to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">NAME</th>
                  <th className="px-3 py-3 font-semibold">CONTACT</th>
                  <th className="px-3 py-3 font-semibold">EMAIL</th>
                  <th className="px-3 py-3 font-semibold">PAYMENT TERMS</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-medium text-ink-100">{s.name}</td>
                    <td className="px-3 py-3 text-ink-300">{s.contactName || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{s.email || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{s.paymentTerms || '—'}</td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          <button type="button" onClick={() => openEdit(s)} aria-label="Edit supplier" className="hover:text-ink-100">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(s)} aria-label="Delete supplier" className="hover:text-red-400">
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

      {(showCreate || editing) && (
        <Modal title={editing ? 'Edit Supplier' : 'Add Supplier'} onClose={closeForm}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>NAME</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>CONTACT NAME</label>
                <input
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>EMAIL</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>PHONE</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>PAYMENT TERMS</label>
                <input
                  value={form.paymentTerms}
                  onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                  placeholder="e.g. Net 30"
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>ADDRESS</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Supplier'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default SuppliersPage
