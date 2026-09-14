import { useEffect, useState, type FormEvent } from 'react'
import { Search, Plus, Pencil, Trash2, Wrench, Download, History, Undo2, PackageCheck } from 'lucide-react'
import * as api from '../lib/api'
import type { MyToolCheckout, Tool, ToolCondition, ToolHistoryEntry, ToolStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, TOOL_MANAGE_ROLES } from '../lib/permissions'
import { useT } from '../i18n'
import { dayOf, isOverdue, toolConditionTone, toolStatusTone } from './toolTones'

const TOOL_STATUSES: ToolStatus[] = ['AVAILABLE', 'CHECKED_OUT', 'UNDER_REPAIR', 'RETIRED']
const MANUAL_STATUSES: ToolStatus[] = ['AVAILABLE', 'UNDER_REPAIR', 'RETIRED']
const CONDITIONS: ToolCondition[] = ['GOOD', 'FAIR', 'DAMAGED']

interface FormState {
  name: string
  category: string
  serialNumber: string
  condition: ToolCondition
  status: ToolStatus
  location: string
  notes: string
}

const EMPTY_FORM: FormState = {
  name: '',
  category: '',
  serialNumber: '',
  condition: 'GOOD',
  status: 'AVAILABLE',
  location: '',
  notes: '',
}

function toFormState(tool: Tool): FormState {
  return {
    name: tool.name,
    category: tool.category || '',
    serialNumber: tool.serialNumber || '',
    condition: tool.condition,
    status: tool.status,
    location: tool.location || '',
    notes: tool.notes || '',
  }
}

function fullName(e: { firstName: string; lastName: string }) {
  return `${e.firstName} ${e.lastName}`
}

/**
 * Technet Maintenance — the tools & equipment register. Everyone sees what exists, what's
 * available and who holds what (plus their own tools at the top). Admin/Storekeeper also add,
 * edit and retire tools and record returns. Tools are handed out from Tool Requests, not here.
 */
function ToolsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const t = useT()
  const { user } = useAuth()
  const canManage = hasRole(user?.role, TOOL_MANAGE_ROLES)

  const [tools, setTools] = useState<Tool[]>([])
  const [mine, setMine] = useState<MyToolCheckout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ToolStatus | ''>('')
  const [categoryFilter, setCategoryFilter] = useState('')
  // From one unfiltered load, so picking a category doesn't shrink the list of categories.
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])

  const [editing, setEditing] = useState<Tool | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [returning, setReturning] = useState<Tool | null>(null)
  const [returnCondition, setReturnCondition] = useState<ToolCondition>('GOOD')
  const [returnNote, setReturnNote] = useState('')

  const [historyFor, setHistoryFor] = useState<Tool | null>(null)
  const [history, setHistory] = useState<ToolHistoryEntry[] | null>(null)

  function load() {
    setLoading(true)
    api
      .listTools({ search: search || undefined, status: statusFilter || undefined, category: categoryFilter || undefined })
      .then(({ tools }) => setTools(tools))
      .catch((err) => setError(err instanceof Error ? err.message : t.tools.loadFailed))
      .finally(() => setLoading(false))
  }

  function loadMine() {
    if (!user?.employeeId) return
    api
      .listMyTools()
      .then(({ checkouts }) => setMine(checkouts))
      .catch(() => undefined)
  }

  function loadCategories() {
    api
      .listTools()
      .then(({ tools }) => {
        const categories = Array.from(new Set(tools.map((x) => x.category).filter((c): c is string => !!c)))
        setCategoryOptions(categories.sort())
      })
      .catch(() => undefined)
  }

  useEffect(load, [search, statusFilter, categoryFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadMine()
    loadCategories()
  }, [user?.employeeId]) // eslint-disable-line react-hooks/exhaustive-deps

  function refresh() {
    load()
    loadMine()
    loadCategories()
  }

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setCategoryFilter('')
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setEditing(null)
    setShowCreate(true)
  }

  function openEdit(tool: Tool) {
    setForm(toFormState(tool))
    setFormError(null)
    setEditing(tool)
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
      setFormError(t.tools.nameRequired)
      return
    }

    const input = {
      name: form.name,
      category: form.category || null,
      serialNumber: form.serialNumber || null,
      condition: form.condition,
      location: form.location || null,
      notes: form.notes || null,
    }

    setSubmitting(true)
    try {
      if (editing) {
        // Status can't be changed by hand while the tool is out — the server refuses it too.
        const statusChanged = editing.status !== 'CHECKED_OUT' && form.status !== editing.status
        await api.updateTool(editing.id, statusChanged ? { ...input, status: form.status } : input)
      } else {
        await api.createTool(input)
      }
      toast.success(editing ? t.tools.updated : t.tools.created)
      closeForm()
      refresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.tools.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(tool: Tool) {
    const ok = await confirm({
      title: t.tools.deleteTitle,
      message: t.tools.deleteMessage(`${tool.toolNumber} ${tool.name}`),
      confirmLabel: t.shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteTool(tool.id)
      toast.success(t.shared.deleted(tool.name))
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.tools.deleteFailed)
    }
  }

  function openReturn(tool: Tool) {
    setReturning(tool)
    setReturnCondition('GOOD')
    setReturnNote('')
  }

  async function handleReturn(e: FormEvent) {
    e.preventDefault()
    if (!returning?.currentCheckout) return
    setSubmitting(true)
    try {
      await api.returnToolCheckout(returning.currentCheckout.id, {
        condition: returnCondition,
        note: returnNote || undefined,
      })
      toast.success(t.tools.returned(returning.name))
      setReturning(null)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.tools.returnFailed)
    } finally {
      setSubmitting(false)
    }
  }

  function openHistory(tool: Tool) {
    setHistoryFor(tool)
    setHistory(null)
    api
      .getToolHistory(tool.id)
      .then(({ checkouts }) => setHistory(checkouts))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : t.tools.historyFailed)
        setHistoryFor(null)
      })
  }

  const count = (status: ToolStatus) => tools.filter((x) => x.status === status).length

  // CSV stays in English — a data file for Excel (see WorkOrdersPage).
  function exportCsv() {
    downloadCsv(
      'tools-and-equipment',
      [
        { header: 'Tag', accessor: (x: Tool) => x.toolNumber },
        { header: 'Name', accessor: (x: Tool) => x.name },
        { header: 'Category', accessor: (x: Tool) => x.category },
        { header: 'Serial Number', accessor: (x: Tool) => x.serialNumber },
        { header: 'Status', accessor: (x: Tool) => x.status },
        { header: 'Condition', accessor: (x: Tool) => x.condition },
        { header: 'Held By', accessor: (x: Tool) => (x.currentCheckout ? fullName(x.currentCheckout.employee) : '') },
        { header: 'Issued', accessor: (x: Tool) => (x.currentCheckout ? dayOf(x.currentCheckout.issuedAt) : '') },
        {
          header: 'Due Back',
          accessor: (x: Tool) => (x.currentCheckout?.expectedReturnAt ? dayOf(x.currentCheckout.expectedReturnAt) : ''),
        },
        { header: 'Location', accessor: (x: Tool) => x.location },
      ],
      tools,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{t.tools.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{canManage ? t.tools.subtitleManager : t.tools.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            {t.shared.exportCsv}
          </button>
          {canManage && (
            <button type="button" onClick={openCreate} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              {t.tools.add}
            </button>
          )}
        </div>
      </div>

      {user?.employeeId && (
        <Panel title={t.tools.myTools}>
          {mine.length === 0 ? (
            <p className="text-sm text-ink-400">{t.tools.myToolsEmpty}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-ink-800">
              {mine.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="flex items-center gap-3">
                    <PackageCheck className="h-4 w-4 shrink-0 text-cyan-accent" />
                    <span className="font-mono text-xs text-ink-400">{c.tool.toolNumber}</span>
                    <span className="text-sm text-ink-100">{c.tool.name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
                    <span>{t.tools.since(dayOf(c.issuedAt))}</span>
                    {c.expectedReturnAt && (
                      <Badge tone={isOverdue(c.expectedReturnAt) ? 'danger' : 'neutral'}>
                        {isOverdue(c.expectedReturnAt) ? t.tools.overdue : t.tools.dueBack(dayOf(c.expectedReturnAt))}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <StatCard label={t.tools.statTotal} value={tools.length} icon={Wrench} />
        <StatCard label={t.tools.status.AVAILABLE.toUpperCase()} value={count('AVAILABLE')} icon={Wrench} />
        <StatCard label={t.tools.status.CHECKED_OUT.toUpperCase()} value={count('CHECKED_OUT')} icon={Wrench} />
        <StatCard
          label={t.tools.status.UNDER_REPAIR.toUpperCase()}
          value={count('UNDER_REPAIR')}
          deltaTone={count('UNDER_REPAIR') > 0 ? 'warning' : undefined}
          icon={Wrench}
        />
      </div>

      <Panel title={t.tools.register}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex min-w-[12rem] max-w-xs flex-1 flex-col gap-1">
            <label className={labelClass}>{t.tools.search}</label>
            <div className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400" />
              <input
                type="text"
                placeholder={t.tools.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.shared.status}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ToolStatus | '')}
              className={inputClass}
            >
              <option value="">{t.shared.allStatuses}</option>
              {TOOL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.tools.status[s]}
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
          {(search || statusFilter || categoryFilter) && (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-ink-400 hover:text-ink-100">
              {t.shared.clearFilters}
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : tools.length === 0 ? (
          <EmptyState icon={Wrench} message={canManage ? t.tools.emptyManager : t.tools.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.tools.colTag}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.name}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  <th className="px-3 py-3 font-semibold">{t.tools.colHeldBy}</th>
                  <th className="px-3 py-3 font-semibold">{t.tools.colCondition}</th>
                  {canManage && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => {
                  const out = tool.currentCheckout
                  return (
                    <tr key={tool.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-3 font-mono font-medium text-ink-100">{tool.toolNumber}</td>
                      <td className="px-3 py-3">
                        <div className="text-ink-100">{tool.name}</div>
                        <div className="text-xs text-ink-400">
                          {[tool.category, tool.serialNumber && `S/N ${tool.serialNumber}`, tool.location]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={toolStatusTone[tool.status]}>{t.tools.status[tool.status]}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        {out ? (
                          <div>
                            <div className="text-ink-100">{fullName(out.employee)}</div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
                              <span>{t.tools.since(dayOf(out.issuedAt))}</span>
                              {out.expectedReturnAt && (
                                <span className={isOverdue(out.expectedReturnAt) ? 'font-semibold text-red-400' : ''}>
                                  {isOverdue(out.expectedReturnAt)
                                    ? t.tools.overdueSince(dayOf(out.expectedReturnAt))
                                    : t.tools.dueBack(dayOf(out.expectedReturnAt))}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={toolConditionTone[tool.condition]}>{t.tools.condition[tool.condition]}</Badge>
                      </td>
                      {canManage && (
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-3 text-ink-400">
                            {out && (
                              <button
                                type="button"
                                onClick={() => openReturn(tool)}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition hover:border-cyan-accent hover:text-cyan-accent"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                                {t.tools.markReturned}
                              </button>
                            )}
                            <button type="button" onClick={() => openHistory(tool)} aria-label={t.tools.history} title={t.tools.history} className="hover:text-ink-100">
                              <History className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openEdit(tool)} aria-label={t.tools.editTitle} title={t.tools.editTitle} className="hover:text-ink-100">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => handleDelete(tool)} aria-label={t.tools.deleteTitle} title={t.tools.deleteTitle} className="hover:text-red-400">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {(showCreate || editing) && (
        <Modal title={editing ? t.tools.editTitle : t.tools.add} onClose={closeForm}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>{t.shared.name}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t.tools.namePlaceholder}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{t.shared.category}</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder={t.tools.categoryPlaceholder}
                  list="tool-categories"
                  className={`mt-2 ${inputClass}`}
                />
                <datalist id="tool-categories">
                  {categoryOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
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
                <label className={labelClass}>{t.tools.colCondition}</label>
                <select
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value as ToolCondition })}
                  className={`mt-2 ${inputClass}`}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {t.tools.condition[c]}
                    </option>
                  ))}
                </select>
              </div>
              {editing && (
                <div>
                  <label className={labelClass}>{t.shared.status}</label>
                  {editing.status === 'CHECKED_OUT' ? (
                    <p className="mt-2 text-sm text-ink-400">{t.tools.statusLockedWhileOut}</p>
                  ) : (
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as ToolStatus })}
                      className={`mt-2 ${inputClass}`}
                    >
                      {MANUAL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t.tools.status[s]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div className={editing ? 'sm:col-span-2' : ''}>
                <label className={labelClass}>{t.tools.storedAt}</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder={t.tools.storedAtPlaceholder}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t.shared.notes}</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>
            {!editing && <p className="text-xs text-ink-400">{t.tools.tagHint}</p>}

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.shared.saving : editing ? t.shared.saveChanges : t.tools.add}
            </button>
          </form>
        </Modal>
      )}

      {returning?.currentCheckout && (
        <Modal title={t.tools.returnTitle} onClose={() => setReturning(null)}>
          <form onSubmit={handleReturn} className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              {t.tools.returnBody(`${returning.toolNumber} ${returning.name}`, fullName(returning.currentCheckout.employee))}
            </p>
            <div>
              <label className={labelClass}>{t.tools.returnCondition}</label>
              <select
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value as ToolCondition)}
                className={`mt-2 ${inputClass}`}
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {t.tools.condition[c]}
                  </option>
                ))}
              </select>
              {returnCondition === 'DAMAGED' && <p className="mt-1 text-xs text-amber-400">{t.tools.damagedHint}</p>}
            </div>
            <div>
              <label className={labelClass}>{t.shared.notes}</label>
              <input value={returnNote} onChange={(e) => setReturnNote(e.target.value)} className={`mt-2 ${inputClass}`} />
            </div>
            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.shared.saving : t.tools.markReturned}
            </button>
          </form>
        </Modal>
      )}

      {historyFor && (
        <Modal title={t.tools.historyTitle(`${historyFor.toolNumber} ${historyFor.name}`)} onClose={() => setHistoryFor(null)}>
          {history === null ? (
            <TableSkeleton rows={3} cols={3} />
          ) : history.length === 0 ? (
            <p className="text-sm text-ink-400">{t.tools.historyEmpty}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-ink-800">
              {history.map((h) => (
                <li key={h.id} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-ink-100">{fullName(h.employee)}</span>
                    {h.returnedAt ? (
                      h.returnCondition && (
                        <Badge tone={toolConditionTone[h.returnCondition]}>{t.tools.condition[h.returnCondition]}</Badge>
                      )
                    ) : (
                      <Badge tone="accent">{t.tools.status.CHECKED_OUT}</Badge>
                    )}
                  </div>
                  <span className="text-xs text-ink-400">
                    {t.tools.historyLine(
                      dayOf(h.issuedAt),
                      h.returnedAt ? dayOf(h.returnedAt) : null,
                      h.request?.requestNumber ?? null,
                    )}
                  </span>
                  {h.returnNote && <span className="text-xs text-ink-300">{h.returnNote}</span>}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  )
}

export default ToolsPage
