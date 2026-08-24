import { useEffect, useState, type FormEvent } from 'react'
import { Search, Plus, Pencil, Trash2, Users, Download, KeyRound, Copy } from 'lucide-react'
import * as api from '../lib/api'
import type { Customer } from '../lib/api'
import { Panel, StatCard, Modal, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, SALES_ROLES } from '../lib/permissions'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

interface FormState {
  name: string
  email: string
  phone: string
  company: string
  address: string
  vatNumber: string
  taxNumber: string
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  company: '',
  address: '',
  vatNumber: '',
  taxNumber: '',
}

function toFormState(c: Customer): FormState {
  return {
    name: c.name,
    email: c.email || '',
    phone: c.phone || '',
    company: c.company || '',
    address: c.address || '',
    vatNumber: c.vatNumber || '',
    taxNumber: c.taxNumber || '',
  }
}

function CustomersPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, SALES_ROLES)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<Customer | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [portalAccessFor, setPortalAccessFor] = useState<Customer | null>(null)
  const [portalEmailInput, setPortalEmailInput] = useState('')
  const [portalResult, setPortalResult] = useState<{ email: string; password: string } | null>(null)
  const [portalBusy, setPortalBusy] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
  const [portalCopied, setPortalCopied] = useState(false)

  function load(searchValue = search) {
    setLoading(true)
    api
      .listCustomers({ search: searchValue || undefined })
      .then(({ customers }) => setCustomers(customers))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load customers'))
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

  function openEdit(c: Customer) {
    setForm(toFormState(c))
    setFormError(null)
    setEditing(c)
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
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
        address: form.address || undefined,
        vatNumber: form.vatNumber || undefined,
        taxNumber: form.taxNumber || undefined,
      }
      if (editing) {
        await api.updateCustomer(editing.id, input)
      } else {
        await api.createCustomer(input)
      }
      toast.success(editing ? 'Customer updated' : 'Customer created')
      closeForm()
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save customer')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(c: Customer) {
    const ok = await confirm({
      title: 'Delete customer',
      message: `Delete customer "${c.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteCustomer(c.id)
      toast.success(`Deleted ${c.name}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete customer')
    }
  }

  function openPortalAccess(c: Customer) {
    setPortalAccessFor(c)
    setPortalEmailInput(c.email || '')
    setPortalResult(null)
    setPortalError(null)
  }

  function closePortalAccess() {
    setPortalAccessFor(null)
    setPortalResult(null)
  }

  async function handleGrantPortalAccess() {
    if (!portalAccessFor) return
    setPortalError(null)
    setPortalBusy(true)
    try {
      const result = await api.grantPortalAccess(portalAccessFor.id, portalEmailInput || undefined)
      setPortalResult(result)
      setPortalCopied(false)
      load()
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Failed to grant portal access')
    } finally {
      setPortalBusy(false)
    }
  }

  async function handleResetPortalAccess() {
    if (!portalAccessFor) return
    setPortalError(null)
    setPortalBusy(true)
    try {
      const result = await api.resetPortalAccess(portalAccessFor.id)
      setPortalResult(result)
      setPortalCopied(false)
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Failed to reset portal access')
    } finally {
      setPortalBusy(false)
    }
  }

  async function handleRevokePortalAccess() {
    if (!portalAccessFor) return
    const ok = await confirm({
      title: 'Revoke portal access',
      message: `Revoke ${portalAccessFor.name}'s portal login? They will no longer be able to sign in to view quotations, invoices, or jobs.`,
      confirmLabel: 'Revoke',
      tone: 'danger',
    })
    if (!ok) return
    setPortalError(null)
    setPortalBusy(true)
    try {
      await api.revokePortalAccess(portalAccessFor.id)
      toast.success('Portal access revoked')
      closePortalAccess()
      load()
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Failed to revoke portal access')
    } finally {
      setPortalBusy(false)
    }
  }

  function exportCsv() {
    downloadCsv(
      'customers',
      [
        { header: 'Name', accessor: (c: Customer) => c.name },
        { header: 'Company', accessor: (c: Customer) => c.company },
        { header: 'Email', accessor: (c: Customer) => c.email },
        { header: 'Phone', accessor: (c: Customer) => c.phone },
        { header: 'VAT Number', accessor: (c: Customer) => c.vatNumber },
        { header: 'BRN', accessor: (c: Customer) => c.taxNumber },
      ],
      customers,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Customer Directory</h1>
          <p className="mt-1 text-sm text-ink-300">Manage strategic partnerships and client engineering accounts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {canWrite && (
            <button type="button" onClick={openCreate} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              Add Customer
            </button>
          )}
        </div>
      </div>

      <StatCard label="Total Customers" value={customers.length} icon={Users} />

      <Panel title="Customer Directory">
        <div className="mb-4 flex flex-1 max-w-sm items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search by name, company, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(search)}
            className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : customers.length === 0 ? (
          <EmptyState icon={Users} message="No customers yet. Add your first customer to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">NAME</th>
                  <th className="px-3 py-3 font-semibold">COMPANY</th>
                  <th className="px-3 py-3 font-semibold">EMAIL</th>
                  <th className="px-3 py-3 font-semibold">PHONE</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-medium text-ink-100">{c.name}</td>
                    <td className="px-3 py-3 text-ink-300">{c.company || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{c.email || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{c.phone || '—'}</td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          <button
                            type="button"
                            onClick={() => openPortalAccess(c)}
                            aria-label="Portal access"
                            title={c.portalUser ? `Portal access granted (${c.portalUser.email})` : 'Grant portal access'}
                            className={c.portalUser ? 'text-cyan-accent hover:text-cyan-accent-dark' : 'hover:text-ink-100'}
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => openEdit(c)} aria-label="Edit customer" className="hover:text-ink-100">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(c)} aria-label="Delete customer" className="hover:text-red-400">
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
        <Modal title={editing ? 'Edit Customer' : 'Add Customer'} onClose={closeForm}>
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
                <label className={labelClass}>COMPANY</label>
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
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
                <label className={labelClass}>ADDRESS</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>VAT NUMBER</label>
                <input
                  value={form.vatNumber}
                  onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>BRN</label>
                <input
                  value={form.taxNumber}
                  onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Customer'}
            </button>
          </form>
        </Modal>
      )}

      {portalAccessFor && (
        <Modal title="Portal Access" onClose={closePortalAccess}>
          <p className="mb-4 text-sm text-ink-400">
            {portalAccessFor.name} {portalAccessFor.company ? `(${portalAccessFor.company})` : ''}
          </p>

          {portalResult ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-300">
                Portal login for <span className="text-ink-100">{portalResult.email}</span>. Copy the password and
                share it with them directly — it won't be shown again, and no email was sent.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-cyan-accent">
                  {portalResult.password}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(portalResult.password)
                    setPortalCopied(true)
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-cyan-accent px-3 py-2 text-xs font-semibold text-ink-950 hover:bg-cyan-accent-dark"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {portalCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ) : portalAccessFor.portalUser ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-ink-300">
                Portal access is active for <span className="text-ink-100">{portalAccessFor.portalUser.email}</span>.
              </p>
              {portalError && <p className="text-sm text-red-400">{portalError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={handleResetPortalAccess} disabled={portalBusy} className={secondaryButtonClass}>
                  Reset Password
                </button>
                <button
                  type="button"
                  onClick={handleRevokePortalAccess}
                  disabled={portalBusy}
                  className="rounded-md border border-red-400/50 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Revoke Access
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-ink-300">
                Grant this customer their own login to view quotations, invoices, and job status, and to request new
                quotations.
              </p>
              <div>
                <label className={labelClass}>PORTAL EMAIL</label>
                <input
                  type="email"
                  value={portalEmailInput}
                  onChange={(e) => setPortalEmailInput(e.target.value)}
                  placeholder="customer@company.com"
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              {portalError && <p className="text-sm text-red-400">{portalError}</p>}
              <button
                type="button"
                onClick={handleGrantPortalAccess}
                disabled={portalBusy || !portalEmailInput.trim()}
                className={`justify-center py-2.5 ${primaryButtonClass}`}
              >
                {portalBusy ? 'Granting…' : 'Grant Access'}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

export default CustomersPage
