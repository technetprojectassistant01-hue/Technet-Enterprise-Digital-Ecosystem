import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Pencil, Trash2, Box, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { Asset, AssetStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES } from '../lib/permissions'
import { useCustomers } from '../erp/useCustomers'
import { assetStatusTone } from './statusTones'
import { enumLabel, useT } from '../i18n'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const ASSET_STATUSES: AssetStatus[] = ['ACTIVE', 'DECOMMISSIONED']

interface FormState {
  name: string
  category: string
  serialNumber: string
  location: string
  customerId: string
  notes: string
}

const EMPTY_FORM: FormState = { name: '', category: '', serialNumber: '', location: '', customerId: '', notes: '' }

function toFormState(a: Asset): FormState {
  return {
    name: a.name,
    category: a.category || '',
    serialNumber: a.serialNumber || '',
    location: a.location || '',
    customerId: a.customerId,
    notes: a.notes || '',
  }
}

function AssetsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const t = useT()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, OPS_MANAGE_ROLES)
  const customers = useCustomers()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<AssetStatus | ''>('')
  const [categoryFilter, setCategoryFilter] = useState('')
  // Populated once from an unfiltered load, independent of the filtered `assets` list below - so
  // picking a category doesn't shrink the dropdown down to just the one category left visible.
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])

  const [editing, setEditing] = useState<Asset | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .listAssets({
        search: search || undefined,
        customerId: customerFilter || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      })
      .then(({ assets }) => setAssets(assets))
      .catch((err) => setError(err instanceof Error ? err.message : t.maint.assets.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, [search, customerFilter, statusFilter, categoryFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.listAssets().then(({ assets }) => {
      const categories = Array.from(new Set(assets.map((a) => a.category).filter((c): c is string => !!c)))
      setCategoryOptions(categories.sort())
    })
  }, [])

  function clearFilters() {
    setSearch('')
    setCustomerFilter('')
    setStatusFilter('')
    setCategoryFilter('')
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, customerId: customers[0]?.id || '' })
    setFormError(null)
    setEditing(null)
    setShowCreate(true)
  }

  function openEdit(a: Asset) {
    setForm(toFormState(a))
    setFormError(null)
    setEditing(a)
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
      setFormError(t.maint.assets.nameRequired)
      return
    }
    if (!editing && !form.customerId) {
      setFormError(t.shared.selectCustomer)
      return
    }

    setSubmitting(true)
    try {
      if (editing) {
        await api.updateAsset(editing.id, {
          name: form.name,
          category: form.category || null,
          serialNumber: form.serialNumber || null,
          location: form.location || null,
          notes: form.notes || null,
        })
      } else {
        await api.createAsset({
          name: form.name,
          category: form.category || undefined,
          serialNumber: form.serialNumber || undefined,
          location: form.location || undefined,
          customerId: form.customerId,
          notes: form.notes || undefined,
        })
      }
      toast.success(editing ? t.maint.assets.updated : t.maint.assets.created)
      closeForm()
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.maint.assets.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(a: Asset) {
    const ok = await confirm({
      title: t.maint.assets.deleteTitle,
      message: t.maint.assets.deleteMessage(a.name),
      confirmLabel: t.shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteAsset(a.id)
      toast.success(t.shared.deleted(a.name))
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.maint.assets.deleteFailed)
    }
  }

  const activeCount = assets.filter((a) => a.status === 'ACTIVE').length
  const decommissionedCount = assets.filter((a) => a.status === 'DECOMMISSIONED').length

  // CSV stays in English — a data file for Excel (see WorkOrdersPage).
  function exportCsv() {
    downloadCsv(
      'assets',
      [
        { header: 'Asset #', accessor: (a: Asset) => a.assetNumber },
        { header: 'Name', accessor: (a: Asset) => a.name },
        { header: 'Category', accessor: (a: Asset) => a.category },
        { header: 'Serial Number', accessor: (a: Asset) => a.serialNumber },
        { header: 'Location', accessor: (a: Asset) => a.location },
        { header: 'Customer', accessor: (a: Asset) => a.customer.company || a.customer.name },
        { header: 'Status', accessor: (a: Asset) => a.status },
      ],
      assets,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{t.maint.assets.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{t.maint.assets.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            {t.shared.exportCsv}
          </button>
          {canWrite && (
            <button type="button" onClick={openCreate} disabled={customers.length === 0} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              {t.maint.assets.add}
            </button>
          )}
        </div>
      </div>

      {canWrite && customers.length === 0 && <p className="text-sm text-ink-400">{t.maint.assets.addCustomerFirst}</p>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard label={t.maint.assets.total} value={assets.length} icon={Box} />
        <StatCard label={t.labels.assetStatus.ACTIVE} value={activeCount} icon={Box} />
        <StatCard label={t.labels.assetStatus.DECOMMISSIONED} value={decommissionedCount} icon={Box} />
      </div>

      <Panel title={t.maint.assets.ledger}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex max-w-xs flex-1 flex-col gap-1">
            <label className={labelClass}>{t.maint.assets.search}</label>
            <div className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400" />
              <input
                type="text"
                placeholder={t.maint.assets.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
              />
            </div>
          </div>
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AssetStatus | '')}
              className={inputClass}
            >
              <option value="">{t.shared.allStatuses}</option>
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {enumLabel(t.labels.assetStatus, s)}
                </option>
              ))}
            </select>
          </div>
          {categoryOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className={labelClass}>{t.shared.category}</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClass}>
                <option value="">{t.shared.allCategories}</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(search || customerFilter || statusFilter || categoryFilter) && (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-ink-400 hover:text-ink-100">
              {t.shared.clearFilters}
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : assets.length === 0 ? (
          <EmptyState icon={Box} message={t.maint.assets.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.maint.assets.colNumber}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.name}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.customer}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.location}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/maintenance/assets/${a.id}`}
                        className="font-mono font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                      >
                        {a.assetNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-100">{a.name}</td>
                    <td className="px-3 py-3 text-ink-300">{a.customer.company || a.customer.name}</td>
                    <td className="px-3 py-3 text-ink-300">{a.location || '—'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={assetStatusTone[a.status]}>{enumLabel(t.labels.assetStatus, a.status)}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          <button type="button" onClick={() => openEdit(a)} aria-label={t.maint.assets.editAria} className="hover:text-ink-100">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(a)} aria-label={t.maint.assets.deleteTitle} className="hover:text-red-400">
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
        <Modal title={editing ? t.maint.assets.editTitle : t.maint.assets.add} onClose={closeForm}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="col-span-2">
                <label className={labelClass}>{t.shared.name}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              {!editing && (
                <div>
                  <label className={labelClass}>{t.shared.customer}</label>
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
                <label className={labelClass}>{t.shared.category}</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder={t.maint.assets.categoryPlaceholder}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{t.shared.serialNumber}</label>
                <input
                  value={form.serialNumber}
                  onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{t.shared.location}</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>{t.shared.notes}</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.shared.saving : editing ? t.shared.saveChanges : t.maint.assets.create}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default AssetsPage
