import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Boxes, PackageCheck, X, Search, Clock, CircleCheck } from 'lucide-react'
import * as api from '../lib/api'
import type { Material, MaterialRequest, MaterialRequestStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton, type BadgeTone } from '../dashboard/ui'
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, TOOL_MANAGE_ROLES } from '../lib/permissions'
import { useT } from '../i18n'
import { dayOf } from './toolTones'
import PageTitle from '../dashboard/PageTitle'

const STATUSES: MaterialRequestStatus[] = ['PENDING', 'ISSUED', 'REJECTED']
const STATUS_TONE: Record<MaterialRequestStatus, BadgeTone> = { PENDING: 'warning', ISSUED: 'success', REJECTED: 'danger' }

const smallButton =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition'

interface Line {
  description: string
  reference: string
  quantity: string
}
const emptyLine = (): Line => ({ description: '', reference: '', quantity: '' })

function fullName(e: { firstName: string; lastName: string }) {
  return `${e.firstName} ${e.lastName}`
}

/**
 * Material requests (2026-10-08, management): consumables such as glue, tape or screws, requested
 * line by line - description, reference, quantity. Works like Tool Requests: anyone with a linked
 * employee record asks; the store (Admin, Storekeeper) marks the request issued or rejects it. The
 * requester can edit while pending and delete unless issued. Materials aren't returned, so there is
 * no hand-back step.
 */
function MaterialRequestsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const t = useT()
  const m = t.materialRequests
  const { user } = useAuth()
  const canManage = hasRole(user?.role, TOOL_MANAGE_ROLES)
  const canRequest = !!user?.employeeId

  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<MaterialRequestStatus | ''>('')
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // New request / editing one
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MaterialRequest | null>(null)
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [purpose, setPurpose] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Store decisions
  const [deciding, setDeciding] = useState<{ request: MaterialRequest; action: 'issue' | 'reject' } | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  // Issue: each request line matched to a stock material (or none) and the quantity handed over.
  const [stockList, setStockList] = useState<Material[] | null>(null)
  const [issueLines, setIssueLines] = useState<Record<string, { materialId: string; quantity: string }>>({})

  /** Opens the issue form, guessing each line's stock material from its reference, else its name. */
  function openIssue(r: MaterialRequest) {
    setDeciding({ request: r, action: 'issue' })
    setDecisionNote('')
    setStockList(null)
    const blank = Object.fromEntries(r.items.map((i) => [i.id, { materialId: '', quantity: String(i.quantity) }]))
    setIssueLines(blank)
    api
      .listMaterials()
      .then(({ materials }) => {
        setStockList(materials)
        const norm = (v: string | null) => (v ?? '').trim().toLowerCase()
        setIssueLines(
          Object.fromEntries(
            r.items.map((i) => {
              const match =
                (i.reference && materials.find((mat) => norm(mat.reference) === norm(i.reference))) ||
                materials.find((mat) => norm(mat.name) === norm(i.description))
              return [i.id, { materialId: match ? match.id : '', quantity: String(i.quantity) }]
            }),
          ),
        )
      })
      .catch(() => setStockList([]))
  }

  function load() {
    setLoading(true)
    api
      .listMaterialRequests()
      .then(({ requests }) => setRequests(requests))
      .catch((err) => setError(err instanceof Error ? err.message : m.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openForm() {
    setEditing(null)
    setLines([emptyLine()])
    setPurpose('')
    setNeededBy('')
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(r: MaterialRequest) {
    setEditing(r)
    setLines(r.items.map((i) => ({ description: i.description, reference: i.reference ?? '', quantity: String(i.quantity) })))
    setPurpose(r.purpose ?? '')
    setNeededBy(r.neededBy ? dayOf(r.neededBy) : '')
    setFormError(null)
    setShowForm(true)
  }

  function setLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const filled = lines.filter((l) => l.description.trim() || l.reference.trim() || l.quantity.trim())
    if (filled.length === 0 || filled.some((l) => !l.description.trim() || !(Number(l.quantity) > 0))) {
      setFormError(m.linesRequired)
      return
    }
    setSubmitting(true)
    try {
      const input = {
        // Quantity goes as a number - the server also accepts the typed text, but be explicit.
        items: filled.map((l) => ({ description: l.description.trim(), reference: l.reference.trim() || undefined, quantity: Number(l.quantity) })),
        purpose: purpose || undefined,
        neededBy: neededBy || undefined,
      }
      if (editing) {
        await api.updateMaterialRequest(editing.id, input)
        toast.success(m.updated)
      } else {
        await api.createMaterialRequest(input)
        toast.success(m.submitted)
      }
      setShowForm(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : editing ? m.updateFailed : m.submitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(r: MaterialRequest) {
    const ok = await confirm({ title: m.deleteTitle, message: m.deleteMessage(r.requestNumber), confirmLabel: t.shared.delete, tone: 'danger' })
    if (!ok) return
    try {
      await api.deleteMaterialRequest(r.id)
      toast.success(m.deleted)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.deleteFailed)
    }
  }

  async function handleDecision(e: FormEvent) {
    e.preventDefault()
    if (!deciding) return
    setSubmitting(true)
    const { request, action } = deciding
    try {
      if (action === 'issue') {
        await api.issueMaterialRequest(request.id, {
          note: decisionNote || undefined,
          lines: request.items.map((i) => {
            const l = issueLines[i.id]
            return { itemId: i.id, materialId: l?.materialId || undefined, quantity: l?.quantity ? Number(l.quantity) : undefined }
          }),
        })
        toast.success(m.issued)
      } else {
        await api.rejectMaterialRequest(request.id, decisionNote || undefined)
        toast.success(m.rejected)
      }
      setDeciding(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : action === 'issue' ? m.issueFailed : m.rejectFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length
  const issuedCount = requests.filter((r) => r.status === 'ISSUED').length
  const term = search.trim().toLowerCase()
  const shown = requests.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (!term) return true
    const text = `${r.requestNumber} ${r.purpose ?? ''} ${fullName(r.employee)} ${r.items.map((i) => `${i.description} ${i.reference ?? ''}`).join(' ')}`
    return text.toLowerCase().includes(term)
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle icon={Boxes} title={navTitle(t)} subtitle={canManage ? m.subtitleManager : m.subtitle} />
        {canRequest && (
          <button type="button" onClick={openForm} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            {m.request}
          </button>
        )}
      </div>

      {!canRequest && !canManage && <p className="text-sm text-ink-400">{m.notLinked}</p>}

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
        <StatCard label={m.statPending} value={loading ? '—' : pendingCount} icon={Clock} />
        <StatCard label={m.statIssued} value={loading ? '—' : issuedCount} icon={CircleCheck} />
        <StatCard label={m.statAll} value={loading ? '—' : requests.length} icon={Boxes} />
      </div>

      <Panel title={canManage ? m.allRequests : m.myRequests}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
            <label className={labelClass}>{t.tools.search}</label>
            <div className="flex items-center gap-2 rounded-md border border-ink-600 bg-ink-950 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.tools.searchPlaceholder}
                className="w-full bg-transparent text-sm text-ink-100 outline-none placeholder-ink-500"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.shared.status}</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as MaterialRequestStatus | '')} className={inputClass}>
              <option value="">{t.shared.allStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {m.status[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Boxes} message={canManage ? m.emptyManager : m.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{m.colNumber}</th>
                  {canManage && <th className="px-3 py-3 font-semibold">{m.colRequestedBy}</th>}
                  <th className="px-3 py-3 font-semibold">{m.colMaterials}</th>
                  <th className="px-3 py-3 font-semibold">{m.colNeededBy}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 align-top last:border-0">
                    <td className="px-3 py-3">
                      <div className="font-mono font-medium text-ink-100">{r.requestNumber}</div>
                      <div className="text-xs text-ink-400">{dayOf(r.createdAt)}</div>
                    </td>
                    {canManage && <td className="px-3 py-3 text-ink-100">{fullName(r.employee)}</td>}
                    <td className="max-w-md px-3 py-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] tracking-widest text-ink-500">
                            <th className="pb-1 pr-3 text-left font-semibold">{m.description}</th>
                            <th className="pb-1 pr-3 text-left font-semibold">{m.reference}</th>
                            <th className="pb-1 text-right font-semibold">{m.quantity}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.items.map((i) => (
                            <tr key={i.id}>
                              <td className="py-0.5 pr-3 text-ink-100">{i.description}</td>
                              <td className="py-0.5 pr-3 font-mono text-ink-300">{i.reference ?? '—'}</td>
                              <td className="py-0.5 text-right text-ink-100">
                                {i.quantity}
                                {i.issuedQuantity !== null && i.material && (
                                  <div className="text-[11px] text-emerald-400">{m.issuedFrom(i.issuedQuantity, i.material.name)}</div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {r.purpose && <div className="mt-1 text-xs text-ink-400">{r.purpose}</div>}
                      {r.reviewNote && (
                        <div className="mt-2 text-xs text-ink-300">
                          <span className="font-semibold">{m.storeNote}</span> {r.reviewNote}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-300">{r.neededBy ? dayOf(r.neededBy) : '—'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={STATUS_TONE[r.status]}>{m.status[r.status]}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canManage && r.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openIssue(r)}
                              className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent`}
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              {m.issue}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeciding({ request: r, action: 'reject' })
                                setDecisionNote('')
                              }}
                              className={`${smallButton} hover:border-red-400 hover:text-red-400`}
                            >
                              <X className="h-3.5 w-3.5" />
                              {t.shared.reject}
                            </button>
                          </>
                        )}
                        {r.employeeId === user?.employeeId && r.status === 'PENDING' && (
                          <button type="button" onClick={() => openEdit(r)} className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent`}>
                            <Pencil className="h-3.5 w-3.5" />
                            {m.edit}
                          </button>
                        )}
                        {r.employeeId === user?.employeeId && r.status !== 'ISSUED' && (
                          <button type="button" onClick={() => handleDelete(r)} className={`${smallButton} hover:border-red-400 hover:text-red-400`}>
                            <Trash2 className="h-3.5 w-3.5" />
                            {t.shared.delete}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showForm && (
        <Modal title={editing ? m.editTitle(editing.requestNumber) : m.request} size="lg" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className={labelClass}>{m.linesLabel}</span>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-ink-800 p-3 sm:grid-cols-[1fr_10rem_6rem_auto] sm:items-end sm:border-0 sm:p-0">
                  <label className="flex flex-col gap-1">
                    <span className={`${labelClass} sm:hidden`}>{m.description}</span>
                    {i === 0 && <span className={`${labelClass} hidden sm:block`}>{m.description}</span>}
                    <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder={m.descriptionPlaceholder} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={`${labelClass} sm:hidden`}>{m.reference}</span>
                    {i === 0 && <span className={`${labelClass} hidden sm:block`}>{m.reference}</span>}
                    <input value={l.reference} onChange={(e) => setLine(i, { reference: e.target.value })} placeholder={m.referencePlaceholder} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={`${labelClass} sm:hidden`}>{m.quantity}</span>
                    {i === 0 && <span className={`${labelClass} hidden sm:block`}>{m.quantity}</span>}
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={m.removeLine}
                    title={m.removeLine}
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                    className="justify-self-end rounded-md p-2 text-ink-400 transition hover:text-red-400 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-cyan-accent hover:underline"
              >
                <Plus className="h-4 w-4" />
                {m.addLine}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>{m.purposeLabel}</span>
                <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={m.purposePlaceholder} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>{m.neededByLabel}</span>
                <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className={inputClass} />
              </label>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className={secondaryButtonClass}>
                {t.common.cancel}
              </button>
              <button type="submit" disabled={submitting} className={primaryButtonClass}>
                {submitting ? t.shared.saving : editing ? t.shared.saveChanges : m.submit}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deciding && (
        <Modal
          title={deciding.action === 'issue' ? m.issueTitle(deciding.request.requestNumber) : m.rejectTitle(deciding.request.requestNumber)}
          size={deciding.action === 'issue' ? 'lg' : undefined}
          onClose={() => setDeciding(null)}
        >
          <form onSubmit={handleDecision} className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              {fullName(deciding.request.employee)} · {deciding.request.items.map((i) => `${i.quantity} × ${i.description}`).join(', ')}
            </p>
            {deciding.action === 'issue' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-ink-400">{m.issueIntro}</p>
                {stockList === null ? (
                  <TableSkeleton rows={2} cols={3} />
                ) : (
                  deciding.request.items.map((i) => {
                    const line = issueLines[i.id] ?? { materialId: '', quantity: String(i.quantity) }
                    const chosen = stockList.find((mat) => mat.id === line.materialId)
                    const short = !!chosen && Number(line.quantity) > chosen.quantity
                    return (
                      <div key={i.id} className="rounded-lg border border-ink-800 p-3">
                        <div className="mb-2 text-sm text-ink-100">
                          {i.quantity} × {i.description}
                          {i.reference && <span className="ml-1 font-mono text-xs text-ink-400">({i.reference})</span>}
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem]">
                          <label className="flex flex-col gap-1">
                            <span className={labelClass}>{m.matchLabel}</span>
                            <select
                              value={line.materialId}
                              onChange={(e) => setIssueLines((prev) => ({ ...prev, [i.id]: { ...line, materialId: e.target.value } }))}
                              className={inputClass}
                            >
                              <option value="">{m.noMatch}</option>
                              {stockList.map((mat) => (
                                <option key={mat.id} value={mat.id}>
                                  {mat.name}
                                  {mat.reference ? ` (${mat.reference})` : ''} · {m.inStock(mat.quantity, mat.unit)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className={labelClass}>{m.issueQty}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0.01"
                              step="0.01"
                              value={line.quantity}
                              onChange={(e) => setIssueLines((prev) => ({ ...prev, [i.id]: { ...line, quantity: e.target.value } }))}
                              className={inputClass}
                            />
                          </label>
                        </div>
                        {short && <p className="mt-1 text-xs font-medium text-red-400">{m.notEnough}: {m.inStock(chosen!.quantity, chosen!.unit)}</p>}
                      </div>
                    )
                  })
                )}
              </div>
            )}
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{deciding.action === 'issue' ? m.issueNote : m.rejectReason}</span>
              <input
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder={deciding.action === 'issue' ? m.issueNotePlaceholder : m.rejectPlaceholder}
                className={inputClass}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeciding(null)} className={secondaryButtonClass}>
                {t.common.cancel}
              </button>
              <button type="submit" disabled={submitting} className={primaryButtonClass}>
                {deciding.action === 'issue' ? m.issueConfirm : t.shared.reject}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

/** The page title is the menu label, so it reads the same in the sidebar and on the page. */
function navTitle(t: ReturnType<typeof useT>) {
  return t.nav['Material Requests']
}

export default MaterialRequestsPage
