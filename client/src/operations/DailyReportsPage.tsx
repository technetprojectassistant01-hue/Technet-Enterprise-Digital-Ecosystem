import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Check, X as XIcon, ClipboardList, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { DailyWorkReport, InterventionReport } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useEmployees } from '../erp/useEmployees'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from '../lib/permissions'
import { reportStatusTone } from '../erp/statusTones'
import { useWorkOrders } from './useWorkOrders'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function DailyReportsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const employees = useEmployees()
  const workOrders = useWorkOrders()
  const [reports, setReports] = useState<DailyWorkReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [summary, setSummary] = useState('')
  const [hours, setHours] = useState('')
  const [technicianIds, setTechnicianIds] = useState<string[]>([])
  const [workOrderIds, setWorkOrderIds] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [relatedReports, setRelatedReports] = useState<InterventionReport[]>([])
  const [loadingRelated, setLoadingRelated] = useState(false)

  function load() {
    setLoading(true)
    api
      .listDailyReports({ from: from || undefined, to: to || undefined })
      .then(({ dailyWorkReports }) => setReports(dailyWorkReports))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load daily reports'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  // Surfaces same-day intervention reports already filed against the selected work orders, so the
  // summary can be adapted from what was already written up in detail rather than retyped from scratch.
  useEffect(() => {
    if (!showCreate || workOrderIds.length === 0 || !date) {
      setRelatedReports([])
      return
    }
    setLoadingRelated(true)
    Promise.all(workOrderIds.map((id) => api.listInterventionReports({ workOrderId: id, from: date, to: date })))
      .then((results) => {
        const seen = new Set<string>()
        const merged: InterventionReport[] = []
        for (const { interventionReports } of results) {
          for (const report of interventionReports) {
            if (!seen.has(report.id)) {
              seen.add(report.id)
              merged.push(report)
            }
          }
        }
        setRelatedReports(merged)
      })
      .catch(() => setRelatedReports([]))
      .finally(() => setLoadingRelated(false))
  }, [showCreate, workOrderIds, date])

  function insertReportIntoSummary(report: InterventionReport) {
    const line = `${report.workOrder?.workOrderNumber ?? report.interventionNumber}: ${report.natureOfIntervention} — ${report.actionTaken}`
    setSummary((prev) => (prev.trim() ? `${prev}\n${line}` : line))
  }

  function clearDateFilters() {
    setFrom('')
    setTo('')
  }

  function openCreate() {
    setDate(todayISO())
    setSummary('')
    setHours('')
    setTechnicianIds([])
    setWorkOrderIds([])
    setFormError(null)
    setShowCreate(true)
  }

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((v) => v !== id) : [...list, id])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!summary.trim()) {
      setFormError('Summary is required')
      return
    }

    setSubmitting(true)
    try {
      await api.createDailyReport({
        date,
        summary,
        hours: hours ? Number(hours) : undefined,
        technicianIds,
        workOrderIds,
      })
      toast.success('Daily report submitted')
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit daily report')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(r: DailyWorkReport) {
    try {
      await api.approveDailyReport(r.id)
      toast.success('Report approved')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve report')
    }
  }

  async function handleReject(r: DailyWorkReport) {
    const ok = await confirm({
      title: 'Reject daily report',
      message: `Reject the report from ${r.date.slice(0, 10)}?`,
      confirmLabel: 'Reject',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.rejectDailyReport(r.id)
      toast.success('Report rejected')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject report')
    }
  }

  const canManage = hasRole(user?.role, OPS_MANAGE_ROLES)
  const canSubmit = hasRole(user?.role, OPS_SUBMIT_ROLES)
  const pendingCount = reports.filter((r) => r.status === 'SUBMITTED').length

  function exportCsv() {
    downloadCsv(
      'daily-reports',
      [
        { header: 'Date', accessor: (r: DailyWorkReport) => r.date.slice(0, 10) },
        { header: 'Summary', accessor: (r: DailyWorkReport) => r.summary },
        {
          header: 'Technicians',
          accessor: (r: DailyWorkReport) => r.technicians.map((t) => `${t.employee.firstName} ${t.employee.lastName}`).join('; '),
        },
        { header: 'Hours', accessor: (r: DailyWorkReport) => r.hours },
        { header: 'Status', accessor: (r: DailyWorkReport) => r.status },
      ],
      reports,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Daily Reports</h1>
          <p className="mt-1 text-sm text-ink-300">Field technician logs, reviewed and approved daily.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            Export
          </button>
          {canSubmit && (
            <button type="button" onClick={openCreate} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              File Daily Report
            </button>
          )}
        </div>
      </div>

      <StatCard label="PENDING REVIEW" value={pendingCount} deltaTone="warning" icon={ClipboardList} />

      <Panel title="Operations Log Registry">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">FROM</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">TO</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          {(from || to) && (
            <button type="button" onClick={clearDateFilters} className="text-xs font-semibold text-ink-400 hover:text-ink-100">
              Clear dates
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : reports.length === 0 ? (
          <EmptyState icon={ClipboardList} message="No daily reports yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">DATE</th>
                  <th className="px-3 py-3 font-semibold">SUMMARY</th>
                  <th className="px-3 py-3 font-semibold">TECHNICIANS</th>
                  <th className="px-3 py-3 font-semibold">HOURS</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-100">{r.date.slice(0, 10)}</td>
                    <td className="px-3 py-3 max-w-sm truncate text-ink-300" title={r.summary}>
                      {r.summary}
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      {r.technicians.length === 0
                        ? '—'
                        : r.technicians.map((t) => `${t.employee.firstName} ${t.employee.lastName}`).join(', ')}
                    </td>
                    <td className="px-3 py-3 text-ink-400">{r.hours ? Number(r.hours) : '—'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={reportStatusTone[r.status]}>{r.status}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      {canManage && r.status === 'SUBMITTED' && (
                        <div className="flex items-center justify-end gap-3">
                          <button type="button" onClick={() => handleApprove(r)} aria-label="Approve" className="text-ink-400 hover:text-cyan-accent">
                            <Check className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => handleReject(r)} aria-label="Reject" className="text-ink-400 hover:text-red-400">
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showCreate && (
        <Modal title="New Daily Report" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>DATE</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>HOURS (OPTIONAL)</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>SUMMARY</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                required
                placeholder="What was done today..."
                className={`mt-2 ${inputClass}`}
              />
            </div>

            <div>
              <label className={labelClass}>TECHNICIANS (OPTIONAL)</label>
              <div className="mt-2 flex max-h-32 flex-col gap-1.5 overflow-y-auto rounded-md border border-ink-700 bg-ink-950 p-3">
                {employees.length === 0 ? (
                  <p className="text-xs text-ink-500">No employees yet.</p>
                ) : (
                  employees.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 text-sm text-ink-200">
                      <input
                        type="checkbox"
                        checked={technicianIds.includes(emp.id)}
                        onChange={() => toggle(technicianIds, setTechnicianIds, emp.id)}
                        className="accent-cyan-accent"
                      />
                      {emp.firstName} {emp.lastName}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className={labelClass}>WORK ORDERS TOUCHED (OPTIONAL)</label>
              <div className="mt-2 flex max-h-32 flex-col gap-1.5 overflow-y-auto rounded-md border border-ink-700 bg-ink-950 p-3">
                {workOrders.length === 0 ? (
                  <p className="text-xs text-ink-500">No work orders yet.</p>
                ) : (
                  workOrders.map((wo) => (
                    <label key={wo.id} className="flex items-center gap-2 text-sm text-ink-200">
                      <input
                        type="checkbox"
                        checked={workOrderIds.includes(wo.id)}
                        onChange={() => toggle(workOrderIds, setWorkOrderIds, wo.id)}
                        className="accent-cyan-accent"
                      />
                      {wo.workOrderNumber} — {wo.title}
                    </label>
                  ))
                )}
              </div>
            </div>

            {workOrderIds.length > 0 && (
              <div>
                <label className={labelClass}>RELATED INTERVENTION REPORTS (SAME DATE)</label>
                {loadingRelated ? (
                  <p className="mt-2 text-xs text-ink-500">Checking for related intervention reports…</p>
                ) : relatedReports.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-500">
                    No intervention reports filed yet for these work orders on this date.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {relatedReports.map((report) => (
                      <div key={report.id} className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-ink-200">
                              {report.interventionNumber}
                              {report.workOrder && (
                                <span className="text-ink-500"> · {report.workOrder.workOrderNumber}</span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-ink-400">
                              {report.natureOfIntervention} — {report.actionTaken}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => insertReportIntoSummary(report)}
                            className="shrink-0 text-xs font-semibold text-cyan-accent hover:underline"
                          >
                            Insert
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Submitting…' : 'Submit Report'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default DailyReportsPage
