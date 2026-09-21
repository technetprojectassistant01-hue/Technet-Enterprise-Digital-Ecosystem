import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, ClipboardList, PackageCheck, X, Search, Clock, CircleCheck } from 'lucide-react'
import * as api from '../lib/api'
import type { Tool, ToolRequest, ToolRequestStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, TOOL_MANAGE_ROLES } from '../lib/permissions'
import { useT } from '../i18n'
import { dayOf, toolRequestStatusTone } from './toolTones'
import { ClipboardList as ClipboardListIcon } from 'lucide-react'
import PageTitle from '../dashboard/PageTitle'

const STATUSES: ToolRequestStatus[] = ['PENDING', 'ISSUED', 'REJECTED', 'CANCELLED']

const smallButton =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition'

function fullName(e: { firstName: string; lastName: string }) {
  return `${e.firstName} ${e.lastName}`
}

/**
 * Tool requests. A technician (anyone with a linked employee record) says what they need; an
 * Admin/Storekeeper issues specific available tools against it or rejects it. The requester can edit
 * their request while it's pending and delete it as long as no tools were issued against it.
 * Managers see every request, others only their own.
 */
function ToolRequestsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const t = useT()
  const { user } = useAuth()
  const canManage = hasRole(user?.role, TOOL_MANAGE_ROLES)
  const canRequest = !!user?.employeeId

  const [requests, setRequests] = useState<ToolRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ToolRequestStatus | ''>('')
  const [requestSearch, setRequestSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // New request / editing one
  const [showForm, setShowForm] = useState(false)
  /** The request being edited, or null when the form is creating a new one. */
  const [editing, setEditing] = useState<ToolRequest | null>(null)
  const [items, setItems] = useState('')
  const [typeOrBrand, setTypeOrBrand] = useState('')
  const [purpose, setPurpose] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Issue
  const [issuing, setIssuing] = useState<ToolRequest | null>(null)
  const [available, setAvailable] = useState<Tool[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [toolSearch, setToolSearch] = useState('')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [issueNote, setIssueNote] = useState('')
  const [issueError, setIssueError] = useState<string | null>(null)

  // Reject
  const [rejecting, setRejecting] = useState<ToolRequest | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  function load() {
    setLoading(true)
    api
      .listToolRequests()
      .then(({ requests }) => setRequests(requests))
      .catch((err) => setError(err instanceof Error ? err.message : t.toolRequests.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** How many tools the signed-in person holds right now, for the My Tools card. */
  const [myToolCount, setMyToolCount] = useState<number | null>(null)
  useEffect(() => {
    if (!user?.employeeId) return
    api
      .listMyTools()
      .then(({ checkouts }) => setMyToolCount(checkouts.length))
      .catch(() => setMyToolCount(null))
  }, [user?.employeeId])

  function openForm() {
    setEditing(null)
    setItems('')
    setTypeOrBrand('')
    setPurpose('')
    setNeededBy('')
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(r: ToolRequest) {
    setEditing(r)
    setItems(r.items)
    setTypeOrBrand(r.typeOrBrand ?? '')
    setPurpose(r.purpose ?? '')
    setNeededBy(r.neededBy ? dayOf(r.neededBy) : '')
    setFormError(null)
    setShowForm(true)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!items.trim()) {
      setFormError(t.toolRequests.itemsRequired)
      return
    }
    setSubmitting(true)
    try {
      const input = {
        items,
        typeOrBrand: typeOrBrand || undefined,
        purpose: purpose || undefined,
        neededBy: neededBy || undefined,
      }
      if (editing) {
        await api.updateToolRequest(editing.id, input)
        toast.success(t.toolRequests.updated)
      } else {
        await api.createToolRequest(input)
        toast.success(t.toolRequests.submitted)
      }
      setShowForm(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : editing ? t.toolRequests.updateFailed : t.toolRequests.submitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(r: ToolRequest) {
    const ok = await confirm({
      title: t.toolRequests.deleteTitle,
      message: t.toolRequests.deleteMessage(r.requestNumber),
      confirmLabel: t.shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteToolRequest(r.id)
      toast.success(t.toolRequests.deleted)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.toolRequests.deleteFailed)
    }
  }

  function openIssue(r: ToolRequest) {
    setIssuing(r)
    setAvailable(null)
    setPicked(new Set())
    setToolSearch('')
    setExpectedReturn('')
    setIssueNote('')
    setIssueError(null)
    api
      .listTools({ status: 'AVAILABLE' })
      .then(({ tools }) => setAvailable(tools))
      .catch((err) => setIssueError(err instanceof Error ? err.message : t.tools.loadFailed))
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleTools = useMemo(() => {
    const term = toolSearch.trim().toLowerCase()
    if (!available || !term) return available ?? []
    return available.filter((tool) =>
      `${tool.toolNumber} ${tool.name} ${tool.category ?? ''} ${tool.serialNumber ?? ''}`.toLowerCase().includes(term),
    )
  }, [available, toolSearch])

  async function handleIssue(e: FormEvent) {
    e.preventDefault()
    if (!issuing) return
    setIssueError(null)
    if (picked.size === 0) {
      setIssueError(t.toolRequests.pickAtLeastOne)
      return
    }
    setSubmitting(true)
    try {
      await api.issueToolRequest(issuing.id, {
        toolIds: [...picked],
        expectedReturnAt: expectedReturn || undefined,
        note: issueNote || undefined,
      })
      toast.success(t.toolRequests.issued(picked.size, fullName(issuing.employee)))
      setIssuing(null)
      load()
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : t.toolRequests.issueFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReject(e: FormEvent) {
    e.preventDefault()
    if (!rejecting) return
    setSubmitting(true)
    try {
      await api.rejectToolRequest(rejecting.id, rejectNote || undefined)
      toast.success(t.toolRequests.rejected)
      setRejecting(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.toolRequests.rejectFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length
  const approvedCount = requests.filter((r) => r.status === 'ISSUED').length
  const requestTerm = requestSearch.trim().toLowerCase()
  const shownRequests = requests.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (!requestTerm) return true
    return `${r.requestNumber} ${r.items} ${r.typeOrBrand} ${r.purpose} ${fullName(r.employee)}`.toLowerCase().includes(requestTerm)
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle icon={ClipboardListIcon} title={t.toolRequests.title} subtitle={canManage ? t.toolRequests.subtitleManager : t.toolRequests.subtitle} />
        {canRequest && (
          <button type="button" onClick={openForm} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            {t.toolRequests.requestTools}
          </button>
        )}
      </div>

      {!canRequest && !canManage && <p className="text-sm text-ink-400">{t.toolRequests.notLinked}</p>}

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <StatCard label={t.toolRequests.statPending} value={loading ? '—' : pendingCount} icon={Clock} />
        <StatCard label={t.toolRequests.statApproved} value={loading ? '—' : approvedCount} icon={CircleCheck} />
        <StatCard label={t.toolRequests.statAll} value={loading ? '—' : requests.length} icon={ClipboardList} />
        {user?.employeeId && (
          <StatCard label={t.tools.statMine} value={myToolCount === null ? '—' : myToolCount} icon={PackageCheck} />
        )}
      </div>

      <Panel title={canManage ? t.toolRequests.allRequests : t.toolRequests.myRequests}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
            <label className={labelClass}>{t.tools.search}</label>
            <div className="flex items-center gap-2 rounded-md border border-ink-600 bg-ink-950 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400" />
              <input value={requestSearch} onChange={(e) => setRequestSearch(e.target.value)} placeholder={t.tools.searchPlaceholder} className="w-full bg-transparent text-sm text-ink-100 outline-none placeholder-ink-500" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.shared.status}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ToolRequestStatus | '')}
              className={inputClass}
            >
              <option value="">{t.shared.allStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.toolRequests.status[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : shownRequests.length === 0 ? (
          <EmptyState icon={ClipboardList} message={canManage ? t.toolRequests.emptyManager : t.toolRequests.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.toolRequests.colNumber}</th>
                  {canManage && <th className="px-3 py-3 font-semibold">{t.toolRequests.colRequestedBy}</th>}
                  <th className="px-3 py-3 font-semibold">{t.toolRequests.colNeeded}</th>
                  <th className="px-3 py-3 font-semibold">{t.toolRequests.colNeededBy}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {shownRequests.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 align-top last:border-0">
                    <td className="px-3 py-3">
                      <div className="font-mono font-medium text-ink-100">{r.requestNumber}</div>
                      <div className="text-xs text-ink-400">{dayOf(r.createdAt)}</div>
                    </td>
                    {canManage && <td className="px-3 py-3 text-ink-100">{fullName(r.employee)}</td>}
                    <td className="max-w-sm px-3 py-3">
                      <div className="whitespace-pre-line text-ink-100">{r.items}</div>
                      {r.typeOrBrand && (
                        <div className="mt-1 text-xs text-ink-300">
                          <span className="font-semibold">{t.toolRequests.typeOrBrandShort}</span> {r.typeOrBrand}
                        </div>
                      )}
                      {r.purpose && <div className="mt-1 text-xs text-ink-400">{r.purpose}</div>}
                      {r.checkouts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {r.checkouts.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 rounded-full border border-ink-700 px-2 py-0.5 text-xs text-ink-200"
                            >
                              <PackageCheck className="h-3 w-3 text-cyan-accent" />
                              {c.tool.toolNumber} {c.tool.name}
                              {c.returnedAt && <span className="text-ink-400">· {t.toolRequests.returnedShort}</span>}
                            </span>
                          ))}
                        </div>
                      )}
                      {r.reviewNote && (
                        <div className="mt-2 text-xs text-ink-300">
                          <span className="font-semibold">{t.toolRequests.storeNote}</span> {r.reviewNote}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-300">{r.neededBy ? dayOf(r.neededBy) : '—'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={toolRequestStatusTone[r.status]}>{t.toolRequests.status[r.status]}</Badge>
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
                                {t.toolRequests.issue}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejecting(r)
                                  setRejectNote('')
                                }}
                                className={`${smallButton} hover:border-red-400 hover:text-red-400`}
                              >
                                <X className="h-3.5 w-3.5" />
                                {t.shared.reject}
                              </button>
                            </>
                          )}
                        {/* The requester's own edit/delete: edit while pending, delete while nothing was issued. */}
                        {r.employeeId === user?.employeeId && r.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t.toolRequests.edit}
                          </button>
                        )}
                        {r.employeeId === user?.employeeId && r.status !== 'ISSUED' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            className={`${smallButton} hover:border-red-400 hover:text-red-400`}
                          >
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
        <Modal
          title={editing ? t.toolRequests.editTitle(editing.requestNumber) : t.toolRequests.requestTools}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.toolRequests.itemsLabel}</label>
              <textarea
                value={items}
                onChange={(e) => setItems(e.target.value)}
                rows={3}
                placeholder={t.toolRequests.itemsPlaceholder}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{t.toolRequests.typeOrBrandLabel}</label>
              <input
                value={typeOrBrand}
                onChange={(e) => setTypeOrBrand(e.target.value)}
                placeholder={t.toolRequests.typeOrBrandPlaceholder}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{t.toolRequests.purposeLabel}</label>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder={t.toolRequests.purposePlaceholder}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{t.toolRequests.colNeededBy}</label>
              <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className={`mt-2 ${inputClass}`} />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.shared.submitting : editing ? t.shared.saveChanges : t.toolRequests.submit}
            </button>
          </form>
        </Modal>
      )}

      {issuing && (
        <Modal title={t.toolRequests.issueTitle(issuing.requestNumber)} onClose={() => setIssuing(null)}>
          <form onSubmit={handleIssue} className="flex flex-col gap-4">
            <div className="rounded-md border border-ink-800 bg-ink-950 p-3 text-sm">
              <div className="text-xs text-ink-400">{t.toolRequests.requestedByLine(fullName(issuing.employee))}</div>
              <div className="mt-1 whitespace-pre-line text-ink-100">{issuing.items}</div>
              {issuing.typeOrBrand && (
                <div className="mt-1 text-xs text-ink-300">
                  <span className="font-semibold">{t.toolRequests.typeOrBrandShort}</span> {issuing.typeOrBrand}
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>{t.toolRequests.pickTools}</label>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
                <Search className="h-4 w-4 text-ink-400" />
                <input
                  type="text"
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  placeholder={t.tools.searchPlaceholder}
                  className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
                />
              </div>
              <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-ink-800">
                {available === null ? (
                  <div className="p-3">
                    <TableSkeleton rows={3} cols={2} />
                  </div>
                ) : visibleTools.length === 0 ? (
                  <p className="p-3 text-sm text-ink-400">{t.toolRequests.noneAvailable}</p>
                ) : (
                  visibleTools.map((tool) => (
                    <label
                      key={tool.id}
                      className="flex cursor-pointer items-center gap-3 border-b border-ink-800 px-3 py-2.5 text-sm last:border-0 hover:bg-ink-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={picked.has(tool.id)}
                        onChange={() => togglePick(tool.id)}
                        className="h-4 w-4 accent-cyan-accent"
                      />
                      <span className="font-mono text-xs text-ink-400">{tool.toolNumber}</span>
                      <span className="text-ink-100">{tool.name}</span>
                      {tool.category && <span className="ml-auto text-xs text-ink-400">{tool.category}</span>}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.toolRequests.expectedReturn}</label>
                <input
                  type="date"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{t.shared.notes}</label>
                <input value={issueNote} onChange={(e) => setIssueNote(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
            </div>

            {issueError && <p className="text-sm text-red-400">{issueError}</p>}

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="submit"
                disabled={submitting || picked.size === 0}
                className={`flex-1 justify-center py-2.5 ${primaryButtonClass}`}
              >
                {submitting ? t.shared.saving : t.toolRequests.issueCount(picked.size)}
              </button>
              <button type="button" onClick={() => setIssuing(null)} className={`justify-center py-2.5 ${secondaryButtonClass}`}>
                {t.common.cancel}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {rejecting && (
        <Modal title={t.toolRequests.rejectTitle(rejecting.requestNumber)} onClose={() => setRejecting(null)}>
          <form onSubmit={handleReject} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.toolRequests.rejectReason}</label>
              <input
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder={t.toolRequests.rejectPlaceholder}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.shared.saving : t.shared.reject}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ToolRequestsPage
