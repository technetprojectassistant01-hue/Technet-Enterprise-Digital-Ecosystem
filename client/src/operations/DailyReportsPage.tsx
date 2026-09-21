import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Check, X as XIcon, ClipboardList, Download, ImagePlus, Images, Search } from 'lucide-react'
import * as api from '../lib/api'
import type { DailyWorkReport, InterventionReport } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useAssignableEmployees } from '../erp/useEmployees'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from '../lib/permissions'
import { reportStatusTone } from '../erp/statusTones'
import { useWorkOrders } from './useWorkOrders'
import { submitOrQueue } from '../lib/outbox'
import { useReloadOnReconnect } from '../lib/useOnline'
import { enumLabel, navLabel, useT } from '../i18n'
import { ClipboardList as ClipboardListIcon } from 'lucide-react'
import PageTitle from '../dashboard/PageTitle'
import { shrinkImage } from '../lib/imageResize'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function DailyReportsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const t = useT()
  const { user } = useAuth()
  const employees = useAssignableEmployees()
  const workOrders = useWorkOrders()
  const [reports, setReports] = useState<DailyWorkReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [summary, setSummary] = useState('')
  const [hours, setHours] = useState('')
  const [technicianIds, setTechnicianIds] = useState<string[]>([])
  const [workOrderIds, setWorkOrderIds] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [photos, setPhotos] = useState<{ fileData: string; fileName: string }[]>([])
  const [addingPhotos, setAddingPhotos] = useState(false)
  const [viewing, setViewing] = useState<DailyWorkReport | null>(null)

  const [relatedReports, setRelatedReports] = useState<InterventionReport[]>([])
  const [loadingRelated, setLoadingRelated] = useState(false)

  function load() {
    setLoading(true)
    api
      .listDailyReports({ from: from || undefined, to: to || undefined })
      .then(({ dailyWorkReports }) => {
        setReports(dailyWorkReports)
        setError(null)
      })
      .catch((err) =>
        setError(
          navigator.onLine
            ? err instanceof Error
              ? err.message
              : t.ops.daily.loadFailed
            : t.shared.offlineNotSynced,
        ),
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [from, to]) // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnReconnect(load)

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

  const searchTerm = search.trim().toLowerCase()
  const visibleReports = searchTerm
    ? reports.filter((report) =>
        `${report.summary} ${report.technicians.map((x) => `${x.employee.firstName} ${x.employee.lastName}`).join(' ')}`
          .toLowerCase()
          .includes(searchTerm),
      )
    : reports

  function openCreate() {
    setDate(todayISO())
    setSummary('')
    setHours('')
    setTechnicianIds([])
    setWorkOrderIds([])
    setPhotos([])
    setFormError(null)
    setShowCreate(true)
  }

  /** Adds picked photos (shrunk on the device first), never more than the maximum. */
  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    const room = api.MAX_DAILY_REPORT_PHOTOS - photos.length
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name))
    if (picked.length > room) toast.error(t.ops.daily.photosLimit(api.MAX_DAILY_REPORT_PHOTOS))
    if (room <= 0) return
    setAddingPhotos(true)
    try {
      const shrunk = await Promise.all(picked.slice(0, room).map(shrinkImage))
      setPhotos((prev) => [...prev, ...shrunk].slice(0, api.MAX_DAILY_REPORT_PHOTOS))
    } catch {
      toast.error(t.ops.daily.photoReadFailed)
    } finally {
      setAddingPhotos(false)
    }
  }

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((v) => v !== id) : [...list, id])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!summary.trim()) {
      setFormError(t.ops.daily.summaryRequired)
      return
    }

    setSubmitting(true)
    try {
      const { queued } = await submitOrQueue({
        kind: 'daily-report',
        label: t.ops.daily.outboxLabel(date),
        endpoint: '/api/daily-reports',
        body: {
          date,
          summary,
          hours: hours ? Number(hours) : undefined,
          technicianIds,
          workOrderIds,
          photos: photos.length ? photos : undefined,
        },
      })
      toast.success(queued ? t.shared.savedOffline : t.ops.daily.submitted)
      setShowCreate(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.ops.daily.submitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(r: DailyWorkReport) {
    try {
      await api.approveDailyReport(r.id)
      toast.success(t.shared.reportApproved)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.shared.approveFailed)
    }
  }

  async function handleReject(r: DailyWorkReport) {
    const ok = await confirm({
      title: t.ops.daily.rejectTitle,
      message: t.ops.daily.rejectMessage(r.date.slice(0, 10)),
      confirmLabel: t.shared.reject,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.rejectDailyReport(r.id)
      toast.success(t.shared.reportRejected)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.shared.rejectFailed)
    }
  }

  const canManage = hasRole(user?.role, OPS_MANAGE_ROLES)
  const canSubmit = hasRole(user?.role, OPS_SUBMIT_ROLES)
  const pendingCount = reports.filter((r) => r.status === 'SUBMITTED').length

  // CSV stays in English — a data file for Excel (see WorkOrdersPage).
  function exportCsv() {
    downloadCsv(
      'daily-reports',
      [
        { header: 'Date', accessor: (r: DailyWorkReport) => r.date.slice(0, 10) },
        { header: 'Summary', accessor: (r: DailyWorkReport) => r.summary },
        {
          header: 'Technicians',
          accessor: (r: DailyWorkReport) => r.technicians.map((x) => `${x.employee.firstName} ${x.employee.lastName}`).join('; '),
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
        <PageTitle icon={ClipboardListIcon} title={navLabel(t, 'Daily Reports')} subtitle={t.ops.daily.subtitle} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            {t.shared.export}
          </button>
          {canSubmit && (
            <button type="button" onClick={openCreate} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              {t.ops.daily.file}
            </button>
          )}
        </div>
      </div>

      <StatCard label={t.ops.daily.pendingReview} value={pendingCount} deltaTone="warning" icon={ClipboardList} />

      <Panel title={t.ops.daily.registry}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">SEARCH</label>
            <div className="flex items-center gap-2 rounded-md border border-ink-600 bg-ink-950 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Summary or technician" className="w-full bg-transparent text-sm text-ink-100 outline-none placeholder-ink-500" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.from}</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.to}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          {(from || to) && (
            <button type="button" onClick={clearDateFilters} className="text-xs font-semibold text-ink-400 hover:text-ink-100">
              {t.ops.daily.clearDates}
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : visibleReports.length === 0 ? (
          <EmptyState icon={ClipboardList} message={t.ops.daily.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.shared.date}</th>
                  <th className="px-3 py-3 font-semibold">{t.ops.daily.colSummary}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.technicians}</th>
                  <th className="px-3 py-3 font-semibold">{t.ops.daily.colHours}</th>
                  <th className="px-3 py-3 font-semibold">{t.ops.daily.colPhotos}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {visibleReports.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-100">{r.date.slice(0, 10)}</td>
                    <td className="px-3 py-3 max-w-sm truncate text-ink-300" title={r.summary}>
                      {r.summary}
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      {r.technicians.length === 0
                        ? '—'
                        : r.technicians.map((x) => `${x.employee.firstName} ${x.employee.lastName}`).join(', ')}
                    </td>
                    <td className="px-3 py-3 text-ink-400">{r.hours ? Number(r.hours) : '—'}</td>
                    <td className="px-3 py-3">
                      {r.photos?.length ? (
                        <button
                          type="button"
                          onClick={() => setViewing(r)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-accent hover:underline"
                        >
                          <Images className="h-4 w-4" />
                          {r.photos.length}
                        </button>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={reportStatusTone[r.status]}>{enumLabel(t.labels.reportStatus, r.status)}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      {canManage && r.status === 'SUBMITTED' && (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => handleApprove(r)}
                            aria-label={t.shared.approve}
                            className="text-ink-400 hover:text-cyan-accent"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(r)}
                            aria-label={t.shared.reject}
                            className="text-ink-400 hover:text-red-400"
                          >
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
        <Modal title={t.ops.daily.newTitle} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.shared.date}</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>{t.ops.daily.hoursOptional}</label>
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
              <label className={labelClass}>{t.ops.daily.summary}</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                required
                placeholder={t.ops.daily.summaryPlaceholder}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            <div>
              <label className={labelClass}>{t.ops.daily.techniciansOptional}</label>
              <div className="mt-2 flex max-h-32 flex-col gap-1.5 overflow-y-auto rounded-md border border-ink-700 bg-ink-950 p-3">
                {employees.length === 0 ? (
                  <p className="text-xs text-ink-400">{t.shared.noEmployees}</p>
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
              <label className={labelClass}>{t.ops.daily.workOrdersTouched}</label>
              <div className="mt-2 flex max-h-32 flex-col gap-1.5 overflow-y-auto rounded-md border border-ink-700 bg-ink-950 p-3">
                {workOrders.length === 0 ? (
                  <p className="text-xs text-ink-400">{t.ops.daily.noWorkOrders}</p>
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

            <div>
              <label className={labelClass}>{t.ops.daily.photosLabel(photos.length, api.MAX_DAILY_REPORT_PHOTOS)}</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative aspect-square max-w-full overflow-hidden rounded-md border border-ink-700 bg-ink-950">
                    <img src={p.fileData} alt={p.fileName} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={t.ops.daily.removePhoto}
                      className="absolute right-1 top-1 rounded-full bg-ink-950/80 p-1 text-ink-100 hover:text-red-400"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < api.MAX_DAILY_REPORT_PHOTOS && (
                  <label className="flex aspect-square max-w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-ink-600 bg-ink-950 text-center text-xs text-ink-400 hover:border-cyan-accent hover:text-cyan-accent">
                    <ImagePlus className="h-5 w-5" />
                    {addingPhotos ? t.ops.daily.addingPhotos : t.ops.daily.addPhoto}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={addingPhotos}
                      onChange={(e) => {
                        void addPhotos(e.target.files)
                        e.target.value = ''
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {workOrderIds.length > 0 && (
              <div>
                <label className={labelClass}>{t.ops.daily.related}</label>
                {loadingRelated ? (
                  <p className="mt-2 text-xs text-ink-400">{t.ops.daily.checkingRelated}</p>
                ) : relatedReports.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-400">{t.ops.daily.noRelated}</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {relatedReports.map((report) => (
                      <div key={report.id} className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-ink-200">
                              {report.interventionNumber}
                              {report.workOrder && (
                                <span className="text-ink-400"> · {report.workOrder.workOrderNumber}</span>
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
                            {t.ops.daily.insert}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting || addingPhotos} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.shared.submitting : t.shared.submitReport}
            </button>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal title={t.ops.daily.photosTitle(viewing.date.slice(0, 10))} onClose={() => setViewing(null)}>
          <div className="flex flex-col gap-3">
            {viewing.photos.map((p) => (
              <img
                key={p.id}
                src={api.dailyReportPhotoUrl(viewing.id, p.id)}
                alt={p.fileName}
                loading="lazy"
                className="max-h-[60vh] w-full rounded-md border border-ink-700 bg-ink-950 object-contain"
              />
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default DailyReportsPage
