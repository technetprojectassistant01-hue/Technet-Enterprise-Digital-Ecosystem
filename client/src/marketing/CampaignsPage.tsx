import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Trash2, Megaphone } from 'lucide-react'
import * as api from '../lib/api'
import type { MarketingCampaign } from '../lib/api'
import { Panel, StatCard, Modal, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useFormDraft } from '../lib/useFormDraft'
import { DraftNotice } from '../dashboard/DraftNotice'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, MARKETING_ROLES } from '../lib/permissions'
import { useT } from '../i18n'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

interface FormState {
  name: string
  description: string
  startDate: string
  endDate: string
}

const EMPTY_FORM: FormState = { name: '', description: '', startDate: '', endDate: '' }

function CampaignsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const t = useT()
  const m = t.marketing.campaigns
  const canWrite = hasRole(user?.role, MARKETING_ROLES)
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const draft = useFormDraft('marketing-campaign', form, showCreate)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load(searchValue = search) {
    setLoading(true)
    api
      .listMarketingCampaigns({ search: searchValue || undefined })
      .then(({ campaigns }) => setCampaigns(campaigns))
      .catch((err) => setError(err instanceof Error ? err.message : m.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setForm(draft.take(EMPTY_FORM))
    setFormError(null)
    setShowCreate(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.name.trim()) {
      setFormError(m.nameRequired)
      return
    }

    setSubmitting(true)
    try {
      await api.createMarketingCampaign({
        name: form.name,
        description: form.description || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      })
      draft.clear()
      toast.success(m.created)
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : m.createFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(c: MarketingCampaign) {
    const ok = await confirm({
      title: m.deleteTitle,
      message: m.deleteMessage(c.name),
      confirmLabel: m.deleteConfirm,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteMarketingCampaign(c.id)
      toast.success(m.deleted(c.name))
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.deleteFailed)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{m.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{m.subtitle}</p>
        </div>
        {canWrite && (
          <button type="button" onClick={openCreate} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            {m.add}
          </button>
        )}
      </div>

      <StatCard label={m.statTotal} value={campaigns.length} icon={Megaphone} />

      <Panel title={m.panel}>
        <div className="mb-4 flex flex-1 max-w-sm items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder={m.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(search)}
            className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} message={m.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{m.colName}</th>
                  <th className="px-3 py-3 font-semibold">{m.colDates}</th>
                  <th className="px-3 py-3 font-semibold">{m.colPosts}</th>
                  <th className="px-3 py-3 font-semibold">{m.colCreatedBy}</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-medium text-ink-100">
                      <Link to={`/dashboard/marketing/campaigns/${c.id}`} className="hover:text-cyan-accent">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      {c.startDate ? c.startDate.slice(0, 10) : '—'}
                      {c.endDate ? ` – ${c.endDate.slice(0, 10)}` : ''}
                    </td>
                    <td className="px-3 py-3 text-ink-300">{c._count?.posts ?? 0}</td>
                    <td className="px-3 py-3 text-ink-300">{c.createdBy?.name || c.createdBy?.email || '—'}</td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            aria-label={m.deleteAria}
                            className="hover:text-red-400"
                          >
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
        <Modal title={m.add} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {draft.restored && <DraftNotice onDiscard={() => setForm(draft.discard())} />}
            <div>
              <label className={labelClass}>{m.name}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{m.description}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{m.startDate}</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{m.endDate}</label>
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
              {submitting ? m.saving : m.create}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default CampaignsPage
