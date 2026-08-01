import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, ScrollText, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { Contract, ContractStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useCustomers } from './useCustomers'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, FINANCE_ROLES } from '../lib/permissions'
import { contractStatusTone as statusTone } from './statusTones'
import { formatMoney } from '../lib/format'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const STATUSES: ContractStatus[] = ['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

interface FormState {
  customerId: string
  service: string
  value: string
  status: ContractStatus
  startDate: string
  endDate: string
}

const EMPTY_FORM: FormState = {
  customerId: '',
  service: '',
  value: '',
  status: 'PLANNING',
  startDate: '',
  endDate: '',
}

function ContractsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, FINANCE_ROLES)
  const customers = useCustomers()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Contract | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .listContracts()
      .then(({ contracts }) => setContracts(contracts))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load contracts'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setForm({ ...EMPTY_FORM, customerId: customers[0]?.id || '' })
    setFormError(null)
    setEditing(null)
    setShowCreate(true)
  }

  function openEdit(c: Contract) {
    setForm({
      customerId: c.customerId,
      service: c.service,
      value: c.value,
      status: c.status,
      startDate: c.startDate ? c.startDate.slice(0, 10) : '',
      endDate: c.endDate ? c.endDate.slice(0, 10) : '',
    })
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

    const value = Number(form.value)
    if (!form.service.trim()) {
      setFormError('Service is required')
      return
    }
    if (!value || value <= 0) {
      setFormError('Value must be a positive number')
      return
    }
    if (!editing && !form.customerId) {
      setFormError('Select a customer')
      return
    }

    setSubmitting(true)
    try {
      if (editing) {
        await api.updateContract(editing.id, {
          service: form.service,
          value,
          status: form.status,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
        })
      } else {
        await api.createContract({
          customerId: form.customerId,
          service: form.service,
          value,
          status: form.status,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
        })
      }
      toast.success(editing ? 'Contract updated' : 'Contract created')
      closeForm()
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save contract')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(c: Contract) {
    const ok = await confirm({
      title: 'Delete contract',
      message: `Delete the contract for "${c.service}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteContract(c.id)
      toast.success('Contract deleted')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contract')
    }
  }

  const activeValue = contracts
    .filter((c) => c.status === 'IN_PROGRESS' || c.status === 'PLANNING')
    .reduce((sum, c) => sum + Number(c.value), 0)

  function exportCsv() {
    downloadCsv(
      'contracts',
      [
        { header: 'Customer', accessor: (c: Contract) => c.customer.company || c.customer.name },
        { header: 'Service', accessor: (c: Contract) => c.service },
        { header: 'Value', accessor: (c: Contract) => c.value },
        { header: 'Status', accessor: (c: Contract) => c.status },
        { header: 'Start Date', accessor: (c: Contract) => c.startDate?.slice(0, 10) },
        { header: 'End Date', accessor: (c: Contract) => c.endDate?.slice(0, 10) },
      ],
      contracts,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Contracts Ledger</h1>
          <p className="mt-1 text-sm text-ink-300">
            Oversee service level agreements and technical partnership terms.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            Export Registry
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={openCreate}
              disabled={customers.length === 0}
              className={primaryButtonClass}
            >
              <Plus className="h-4 w-4" />
              New Contract
            </button>
          )}
        </div>
      </div>

      {canWrite && customers.length === 0 && (
        <p className="text-sm text-ink-400">Add a customer first before creating contracts.</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard
          label="Active Contracts"
          value={contracts.filter((c) => c.status !== 'COMPLETED' && c.status !== 'CANCELLED').length}
          icon={ScrollText}
        />
        <StatCard label="Active Value" value={formatMoney(activeValue)} icon={ScrollText} />
      </div>

      <Panel title="Active Registry">
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : contracts.length === 0 ? (
          <EmptyState icon={ScrollText} message="No contracts yet. Create your first contract to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">COMPANY</th>
                  <th className="px-3 py-3 font-semibold">SERVICE</th>
                  <th className="px-3 py-3 font-semibold">VALUE</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-medium text-ink-100">{c.customer.company || c.customer.name}</td>
                    <td className="px-3 py-3 text-ink-300">{c.service}</td>
                    <td className="px-3 py-3 text-ink-100">{formatMoney(c.value)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone[c.status]}>{c.status.replace('_', ' ')}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          <button type="button" onClick={() => openEdit(c)} aria-label="Edit contract" className="hover:text-ink-100">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(c)} aria-label="Delete contract" className="hover:text-red-400">
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
        <Modal title={editing ? 'Edit Contract' : 'New Contract'} onClose={closeForm}>
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
              <label className={labelClass}>SERVICE</label>
              <input
                value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>VALUE</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>STATUS</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ContractStatus })}
                  className={`mt-2 ${inputClass}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>START DATE</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>END DATE</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Contract'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ContractsPage
