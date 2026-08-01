import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, ClipboardList, Trash2, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { Requisition } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, PROCUREMENT_ROLES } from '../lib/permissions'
import { useProjects } from './useProjects'
import { useInventoryItems } from './useInventoryItems'
import LineItemsEditor, { EMPTY_LINE_ITEM, type LineItemRow } from './LineItemsEditor'
import { requisitionStatusTone } from './statusTones'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function RequisitionsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canManage = hasRole(user?.role, PROCUREMENT_ROLES)
  const projects = useProjects()
  const inventoryItems = useInventoryItems()
  const [requisitions, setRequisitions] = useState<Requisition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [requisitionNumber, setRequisitionNumber] = useState('')
  const [projectId, setProjectId] = useState('')
  const [neededByDate, setNeededByDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItemRow[]>([{ ...EMPTY_LINE_ITEM }])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load(searchValue = search) {
    setLoading(true)
    api
      .listRequisitions({ search: searchValue || undefined })
      .then(({ requisitions }) => setRequisitions(requisitions))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load requisitions'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setRequisitionNumber('')
    setProjectId('')
    setNeededByDate('')
    setNotes('')
    setItems([{ ...EMPTY_LINE_ITEM }])
    setFormError(null)
    setShowCreate(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!requisitionNumber.trim()) {
      setFormError('Requisition number is required')
      return
    }

    setSubmitting(true)
    try {
      await api.createRequisition({
        requisitionNumber,
        projectId: projectId || undefined,
        neededByDate: neededByDate || undefined,
        notes: notes || undefined,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          inventoryItemId: item.inventoryItemId || undefined,
        })),
      })
      toast.success('Requisition submitted')
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit requisition')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(r: Requisition) {
    const ok = await confirm({
      title: 'Delete requisition',
      message: `Delete requisition ${r.requisitionNumber}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteRequisition(r.id)
      toast.success(`Deleted ${r.requisitionNumber}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete requisition')
    }
  }

  const submittedCount = requisitions.filter((r) => r.status === 'SUBMITTED').length

  function exportCsv() {
    downloadCsv(
      'requisitions',
      [
        { header: 'Number', accessor: (r: Requisition) => r.requisitionNumber },
        { header: 'Project', accessor: (r: Requisition) => r.project?.name },
        { header: 'Requested By', accessor: (r: Requisition) => r.requestedBy.name || r.requestedBy.email },
        { header: 'Items', accessor: (r: Requisition) => r.items.length },
        { header: 'Needed By', accessor: (r: Requisition) => r.neededByDate?.slice(0, 10) },
        { header: 'Status', accessor: (r: Requisition) => r.status },
      ],
      requisitions,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Requisitions</h1>
          <p className="mt-1 text-sm text-ink-300">Track material requests from submission through approval.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            Export Ledger
          </button>
          <button type="button" onClick={openCreate} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            New Requisition
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="TOTAL REQUISITIONS" value={requisitions.length} icon={ClipboardList} />
        <StatCard label="AWAITING APPROVAL" value={submittedCount} deltaTone="warning" icon={ClipboardList} />
      </div>

      <Panel title="Requisition Ledger">
        <div className="mb-4 flex flex-1 max-w-sm items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search by requisition number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(search)}
            className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : requisitions.length === 0 ? (
          <EmptyState icon={ClipboardList} message="No requisitions yet. Submit your first request to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">NUMBER</th>
                  <th className="px-3 py-3 font-semibold">PROJECT</th>
                  <th className="px-3 py-3 font-semibold">REQUESTED BY</th>
                  <th className="px-3 py-3 font-semibold">ITEMS</th>
                  <th className="px-3 py-3 font-semibold">NEEDED BY</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  {canManage && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {requisitions.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/erp/procurement/requisitions/${r.id}`}
                        className="font-mono font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                      >
                        {r.requisitionNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{r.project?.name || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{r.requestedBy.name || r.requestedBy.email}</td>
                    <td className="px-3 py-3 text-ink-300">{r.items.length}</td>
                    <td className="px-3 py-3 text-ink-400">{r.neededByDate ? r.neededByDate.slice(0, 10) : '—'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={requisitionStatusTone[r.status]}>{r.status}</Badge>
                    </td>
                    {canManage && (
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          aria-label="Delete requisition"
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
        <Modal title="New Requisition" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>REQUISITION NUMBER</label>
                <input
                  value={requisitionNumber}
                  onChange={(e) => setRequisitionNumber(e.target.value)}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>NEEDED BY</label>
                <input
                  type="date"
                  value={neededByDate}
                  onChange={(e) => setNeededByDate(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>PROJECT (OPTIONAL)</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`mt-2 ${inputClass}`}>
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>NOTES</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-2 ${inputClass}`} />
            </div>

            <LineItemsEditor items={items} onChange={setItems} inventoryItems={inventoryItems} />

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Submitting…' : 'Submit Requisition'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default RequisitionsPage
