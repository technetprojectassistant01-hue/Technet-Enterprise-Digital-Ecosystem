import { useEffect, useState, type FormEvent } from 'react'
import { Plus, ScrollText, Download, Trash2 } from 'lucide-react'
import * as api from '../lib/api'
import type { MaintenanceContract, MaintenanceContractStatus, MaintenanceFrequency } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES } from '../lib/permissions'
import { useServiceableAssets } from './useAssets'
import { useCustomers } from '../erp/useCustomers'
import { maintenanceContractStatusTone } from './statusTones'
import { enumLabel, useT } from '../i18n'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const FREQUENCIES: MaintenanceFrequency[] = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL']
const CONTRACT_STATUSES: MaintenanceContractStatus[] = ['ACTIVE', 'EXPIRED', 'CANCELLED']

interface FormState {
  assetId: string
  frequency: MaintenanceFrequency
  startDate: string
  expiryDate: string
  notes: string
}

const EMPTY_FORM: FormState = { assetId: '', frequency: 'QUARTERLY', startDate: '', expiryDate: '', notes: '' }

function ContractsPage() {
  const t = useT()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, OPS_MANAGE_ROLES)
  const assets = useServiceableAssets()
  const customers = useCustomers()
  const [contracts, setContracts] = useState<MaintenanceContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<MaintenanceContractStatus | ''>('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [frequencyFilter, setFrequencyFilter] = useState<MaintenanceFrequency | ''>('')
  const [expiringSoonOnly, setExpiringSoonOnly] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .listMaintenanceContracts({
        status: status || undefined,
        customerId: customerFilter || undefined,
        frequency: frequencyFilter || undefined,
        expiringSoon: expiringSoonOnly || undefined,
      })
      .then(({ contracts }) => setContracts(contracts))
      .catch((err) => setError(err instanceof Error ? err.message : t.maint.contracts.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, [status, customerFilter, frequencyFilter, expiringSoonOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearFilters() {
    setStatus('')
    setCustomerFilter('')
    setFrequencyFilter('')
    setExpiringSoonOnly(false)
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, assetId: assets[0]?.id || '' })
    setFormError(null)
    setShowCreate(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.assetId) {
      setFormError(t.shared.selectAsset)
      return
    }
    if (!form.startDate || !form.expiryDate) {
      setFormError(t.maint.contracts.datesRequired)
      return
    }

    setSubmitting(true)
    try {
      await api.createMaintenanceContract({
        assetId: form.assetId,
        frequency: form.frequency,
        startDate: form.startDate,
        expiryDate: form.expiryDate,
        notes: form.notes || undefined,
      })
      toast.success(t.maint.contracts.created)
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.maint.contracts.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(c: MaintenanceContract) {
    const ok = await confirm({
      title: t.maint.contracts.deleteTitle,
      message: t.maint.contracts.deleteMessage(c.contractNumber),
      confirmLabel: t.shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteMaintenanceContract(c.id)
      toast.success(t.shared.deleted(c.contractNumber))
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.maint.contracts.deleteFailed)
    }
  }

  const expiringSoonCount = contracts.filter((c) => {
    if (c.status !== 'ACTIVE') return false
    const days = (new Date(c.expiryDate).getTime() - Date.now()) / 86_400_000
    return days >= 0 && days <= 30
  }).length

  function exportCsv() {
    downloadCsv(
      'maintenance-contracts',
      [
        { header: 'Contract #', accessor: (c: MaintenanceContract) => c.contractNumber },
        { header: 'Asset', accessor: (c: MaintenanceContract) => c.asset.assetNumber },
        { header: 'Customer', accessor: (c: MaintenanceContract) => c.asset.customer.company || c.asset.customer.name },
        { header: 'Frequency', accessor: (c: MaintenanceContract) => c.frequency },
        { header: 'Start Date', accessor: (c: MaintenanceContract) => c.startDate.slice(0, 10) },
        { header: 'Expiry Date', accessor: (c: MaintenanceContract) => c.expiryDate.slice(0, 10) },
        { header: 'Status', accessor: (c: MaintenanceContract) => c.status },
      ],
      contracts,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{t.maint.contracts.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{t.maint.contracts.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            {t.maint.contracts.exportRegistry}
          </button>
          {canWrite && (
            <button type="button" onClick={openCreate} disabled={assets.length === 0} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              {t.maint.contracts.new}
            </button>
          )}
        </div>
      </div>

      {canWrite && assets.length === 0 && (
        <p className="text-sm text-ink-400">{t.maint.contracts.assetFirst}</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label={t.maint.contracts.total} value={contracts.length} icon={ScrollText} />
        <StatCard
          label={t.maint.contracts.expiringSoon}
          value={expiringSoonCount}
          deltaTone={expiringSoonCount > 0 ? 'warning' : undefined}
          icon={ScrollText}
        />
      </div>

      <Panel title={t.maint.contracts.ledger}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className={labelClass}>{t.shared.customer}</label>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={inputClass}>
              <option value="">{t.shared.allCustomers}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.shared.status}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MaintenanceContractStatus | '')}
              className={inputClass}
            >
              <option value="">{t.shared.allStatuses}</option>
              {CONTRACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {enumLabel(t.labels.contractStatus, s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.maint.contracts.frequency}</label>
            <select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value as MaintenanceFrequency | '')}
              className={inputClass}
            >
              <option value="">{t.maint.contracts.allFrequencies}</option>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {enumLabel(t.labels.frequency, f)}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={expiringSoonOnly}
              onChange={(e) => setExpiringSoonOnly(e.target.checked)}
              className="accent-cyan-accent"
            />
            {t.maint.contracts.expiringWithin30}
          </label>
          {(status || customerFilter || frequencyFilter || expiringSoonOnly) && (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-ink-400 hover:text-ink-100">
              {t.shared.clearFilters}
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : contracts.length === 0 ? (
          <EmptyState icon={ScrollText} message={t.maint.contracts.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.maint.contracts.colNumber}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.asset}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.customer}</th>
                  <th className="px-3 py-3 font-semibold">{t.maint.contracts.frequency}</th>
                  <th className="px-3 py-3 font-semibold">{t.maint.contracts.colExpires}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-mono font-medium text-ink-100">{c.contractNumber}</td>
                    <td className="px-3 py-3 font-mono text-ink-300">{c.asset.assetNumber}</td>
                    <td className="px-3 py-3 text-ink-300">{c.asset.customer.company || c.asset.customer.name}</td>
                    <td className="px-3 py-3 text-ink-300">{enumLabel(t.labels.frequency, c.frequency)}</td>
                    <td className="px-3 py-3 text-ink-400">{c.expiryDate.slice(0, 10)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={maintenanceContractStatusTone[c.status]}>{enumLabel(t.labels.contractStatus, c.status)}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          aria-label={t.maint.contracts.deleteTitle}
                          className="text-ink-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
        <Modal title={t.maint.contracts.new} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.shared.asset}</label>
              <select
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                className={`mt-2 ${inputClass}`}
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.assetNumber} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.maint.contracts.frequency}</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value as MaintenanceFrequency })}
                  className={`mt-2 ${inputClass}`}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {enumLabel(t.labels.frequency, f)}
                    </option>
                  ))}
                </select>
              </div>
              <div />
              <div>
                <label className={labelClass}>{t.shared.startDate}</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{t.maint.contracts.expiryDate}</label>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t.shared.notes}</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.shared.saving : t.maint.contracts.create}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ContractsPage
