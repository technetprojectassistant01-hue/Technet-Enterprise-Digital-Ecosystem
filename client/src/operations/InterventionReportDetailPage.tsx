import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, X, Check, Download, Link2, BellRing } from 'lucide-react'
import * as api from '../lib/api'
import type { InterventionReport, ReminderInterval, PhotoKind } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, dangerButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES } from '../lib/permissions'
import { reportStatusTone } from '../erp/statusTones'
import { useWorkOrders } from './useWorkOrders'
import { enumLabel, useT } from '../i18n'

const fieldLabelClass = 'text-[11px] font-semibold tracking-widest text-ink-400'
const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'

const REMINDER_OPTIONS: ReminderInterval[] = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL']

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className={fieldLabelClass}>{label}</div>
      <div className="mt-1 text-sm text-ink-100">{value || <span className="text-ink-500">—</span>}</div>
    </div>
  )
}

// Opening the full-size photo in a new tab can't be a plain <a href target="_blank"> the way the
// thumbnail <img> below safely can - an <img src> is a same-partition subresource fetch (the auth
// cookie is sent fine), but a brand-new top-level tab lands in a partition keyed to the *server's*
// origin, where a SameSite=None; Partitioned cookie set under the client's origin isn't visible
// (see CLAUDE.md §9). Fetch with the cookie, then open the resulting blob instead.
async function openPhotoFullSize(reportId: string, photoId: string) {
  const res = await fetch(api.interventionPhotoUrl(reportId, photoId), { credentials: 'include' })
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  // Revoke once the new tab has had a chance to load the blob URL, not immediately.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function PhotoGrid({
  reportId,
  photos,
  kind,
  label,
}: {
  reportId: string
  photos: InterventionReport['photos']
  kind: PhotoKind
  label: string
}) {
  const t = useT()
  const filtered = photos.filter((p) => p.kind === kind)
  return (
    <div>
      <div className={fieldLabelClass}>{label}</div>
      {filtered.length === 0 ? (
        <p className="mt-1 text-sm text-ink-500">{t.ops.irDetail.noneUploaded}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openPhotoFullSize(reportId, p.id)}
              aria-label={t.ops.irDetail.viewPhoto(p.fileName)}
            >
              <img
                src={api.interventionPhotoUrl(reportId, p.id)}
                alt={p.fileName}
                className="h-24 w-24 rounded-md border border-ink-700 object-cover hover:border-cyan-accent"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function InterventionReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const confirm = useConfirm()
  const t = useT()
  const { user } = useAuth()
  const workOrders = useWorkOrders()

  const [report, setReport] = useState<InterventionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState(false)
  const [downloadingAttachment, setDownloadingAttachment] = useState(false)

  const [linkWorkOrderId, setLinkWorkOrderId] = useState('')
  const [reminderChoice, setReminderChoice] = useState<ReminderInterval | ''>('')

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getInterventionReport(id)
      .then(({ interventionReport }) => {
        setReport(interventionReport)
        setReminderChoice(interventionReport.reminderInterval || '')
      })
      .catch((err) => setError(err instanceof Error ? err.message : t.ops.irDetail.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleApprove() {
    if (!report) return
    setActioning(true)
    try {
      await api.approveInterventionReport(report.id)
      toast.success(t.shared.reportApproved)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.shared.approveFailed)
    } finally {
      setActioning(false)
    }
  }

  async function handleReject() {
    if (!report) return
    const ok = await confirm({
      title: t.ops.irDetail.rejectTitle,
      message: t.ops.irDetail.rejectMessage(report.interventionNumber),
      confirmLabel: t.shared.reject,
      tone: 'danger',
    })
    if (!ok) return
    setActioning(true)
    try {
      await api.rejectInterventionReport(report.id)
      toast.success(t.shared.reportRejected)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.shared.rejectFailed)
    } finally {
      setActioning(false)
    }
  }

  async function handleLinkWorkOrder() {
    if (!report || !linkWorkOrderId) return
    setActioning(true)
    try {
      await api.linkWorkOrderToInterventionReport(report.id, linkWorkOrderId)
      toast.success(t.ops.irDetail.linked)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.irDetail.linkFailed)
    } finally {
      setActioning(false)
    }
  }

  async function handleSetReminder() {
    if (!report) return
    setActioning(true)
    try {
      await api.setInterventionReportReminder(report.id, reminderChoice || null)
      toast.success(reminderChoice ? t.ops.irDetail.reminderSet : t.ops.irDetail.reminderCleared)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.irDetail.reminderFailed)
    } finally {
      setActioning(false)
    }
  }

  // Cross-origin cookie download - can't be a plain <a href target="_blank"> (prod auth cookies
  // are SameSite=None; Partitioned, not sent on a direct top-level navigation - see CLAUDE.md §9).
  async function handleDownloadAttachment() {
    if (!report?.attachmentFileName) return
    setDownloadingAttachment(true)
    try {
      const res = await fetch(api.interventionAttachmentUrl(report.id), { credentials: 'include' })
      if (!res.ok) throw new Error(t.ops.irDetail.downloadFailed)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = report.attachmentFileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.irDetail.downloadFailed)
    } finally {
      setDownloadingAttachment(false)
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !report) return <EmptyState icon={X} message={error || t.ops.irDetail.notFound} />

  const canManage = hasRole(user?.role, OPS_MANAGE_ROLES)
  const reminderDue = !!report.nextReminderAt && new Date(report.nextReminderAt) <= new Date()
  const workTypeLabel = enumLabel(t.labels.workType, report.workType)

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/operations/intervention-reports"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.ops.irForm.back}
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-ink-100">{report.interventionNumber}</h1>
            <Badge tone={reportStatusTone[report.status]}>{enumLabel(t.labels.reportStatus, report.status)}</Badge>
            {reminderDue && <Badge tone="warning">{t.ops.ir.reminderDue}</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {report.customer.company || report.customer.name} · {workTypeLabel} · {report.date.slice(0, 10)}
            {report.workOrder && (
              <>
                {' · '}
                <Link to={`/dashboard/operations/work-orders/${report.workOrder.id}`} className="font-mono text-cyan-accent hover:underline">
                  {report.workOrder.workOrderNumber}
                </Link>
              </>
            )}
          </p>
        </div>

        {canManage && report.status === 'SUBMITTED' && (
          <div className="flex gap-3">
            <button type="button" onClick={handleApprove} disabled={actioning} className={primaryButtonClass}>
              <Check className="h-4 w-4" />
              {t.shared.approve}
            </button>
            <button type="button" onClick={handleReject} disabled={actioning} className={dangerButtonClass}>
              <X className="h-4 w-4" />
              {t.shared.reject}
            </button>
          </div>
        )}
      </div>

      {report.reviewNote && (
        <Panel>
          <p className="text-sm text-ink-300">
            <span className="font-semibold text-ink-100">{t.ops.irDetail.reviewNote}</span> {report.reviewNote}
          </p>
        </Panel>
      )}

      {canManage && !report.workOrder && (
        <Panel title={t.ops.irDetail.workOrderPanel}>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className={fieldLabelClass}>{t.ops.irDetail.linkWorkOrder}</label>
              <select value={linkWorkOrderId} onChange={(e) => setLinkWorkOrderId(e.target.value)} className={`mt-2 w-full ${inputClass}`}>
                <option value="">{t.ops.irDetail.selectWorkOrder}</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.workOrderNumber} — {wo.title}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={handleLinkWorkOrder} disabled={!linkWorkOrderId || actioning} className={primaryButtonClass}>
              <Link2 className="h-4 w-4" />
              {t.ops.irDetail.link}
            </button>
          </div>
        </Panel>
      )}

      <Panel title={t.ops.irDetail.jobContactPanel}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t.shared.jobCategory} value={enumLabel(t.labels.jobCategory, report.jobCategory)} />
          <Field
            label={t.shared.workType}
            value={report.workType === 'OTHER' && report.workTypeOther ? `${workTypeLabel} — ${report.workTypeOther}` : workTypeLabel}
          />
          <Field label={t.ops.irForm.contactPerson} value={report.contactPerson} />
        </div>
      </Panel>

      {(report.equipment || report.make || report.model || report.serialNo) && (
        <Panel title={t.ops.irDetail.equipmentPanel}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label={t.ops.irForm.equipment} value={report.equipment} />
            <Field label={t.ops.irForm.make} value={report.make} />
            <Field label={t.ops.irForm.model} value={report.model} />
            <Field label={t.ops.irDetail.serialNo} value={report.serialNo} />
          </div>
        </Panel>
      )}

      <Panel title={t.ops.irForm.faultPanel}>
        <div className="flex flex-col gap-4">
          <Field label={t.ops.irForm.nature} value={report.natureOfIntervention} />
          <Field label={t.ops.irForm.action} value={report.actionTaken} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={t.shared.workCompleted} value={report.workCompleted ? t.shared.yes : t.shared.no} />
            <Field label={t.attendance.timeIn} value={report.timeIn} />
            <Field label={t.attendance.timeOut} value={report.timeOut} />
          </div>
          {!report.workCompleted && <Field label={t.ops.irDetail.details} value={report.incompleteDetails} />}
          {report.units.length > 0 && (
            <div>
              <div className={fieldLabelClass}>{t.ops.irDetail.perUnit}</div>
              <div className="mt-2 flex flex-col gap-2">
                {report.units.map((unit) => (
                  <div key={unit.id} className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2.5">
                    <div className="text-xs font-semibold text-ink-200">{unit.label}</div>
                    <div className="mt-1 text-xs text-ink-300">{unit.problem}</div>
                    <div className="mt-1 text-xs text-ink-500">{unit.action ? unit.action : t.ops.irDetail.notActioned}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel title={t.ops.irDetail.photosPanel}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <PhotoGrid reportId={report.id} photos={report.photos} kind="BEFORE" label={t.ops.irForm.beforePhotos} />
          <PhotoGrid reportId={report.id} photos={report.photos} kind="AFTER" label={t.ops.irForm.afterPhotos} />
          <PhotoGrid reportId={report.id} photos={report.photos} kind="EQUIPMENT" label={t.ops.irForm.equipmentPhotos} />
          <PhotoGrid reportId={report.id} photos={report.photos} kind="WORK_DONE" label={t.ops.irForm.workDonePhotos} />
        </div>
      </Panel>

      <Panel title={t.shared.techniciansPanel}>
        {report.technicians.length === 0 ? (
          <p className="text-sm text-ink-400">{t.ops.irDetail.noTechnicians}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {report.technicians.map((x) => (
              <span key={x.id} className="rounded-full bg-ink-800 px-3 py-1.5 text-xs text-ink-200">
                {x.employee.firstName} {x.employee.lastName}
              </span>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t.ops.irForm.warrantyPanel}>
        <div className="flex flex-col gap-4">
          <Field
            label={t.ops.irForm.underWarranty}
            value={report.warrantyStatus ? enumLabel(t.labels.warranty, report.warrantyStatus) : null}
          />
          <Field label={t.ops.irForm.technicianReport} value={report.technicianReport} />
          <Field label={t.ops.irDetail.materialsUsed} value={report.materialsUsed} />
          <Field label={t.ops.irForm.comments} value={report.comments} />
          <Field label={t.ops.irForm.otherInfo} value={report.additionalInfo} />
        </div>
      </Panel>

      {canManage && (
        <Panel title={t.ops.irDetail.followUp}>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className={fieldLabelClass}>{t.ops.irDetail.remindMe}</label>
              <select
                value={reminderChoice}
                onChange={(e) => setReminderChoice(e.target.value as ReminderInterval | '')}
                className={`mt-2 w-full ${inputClass}`}
              >
                <option value="">{t.ops.irDetail.noReminder}</option>
                {REMINDER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {enumLabel(t.labels.reminderInterval, opt)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleSetReminder}
              disabled={actioning || reminderChoice === (report.reminderInterval || '')}
              className={primaryButtonClass}
            >
              <BellRing className="h-4 w-4" />
              {t.shared.save}
            </button>
            {report.nextReminderAt && (
              <span className="pb-2.5 text-xs text-ink-400">{t.ops.irDetail.next(report.nextReminderAt.slice(0, 10))}</span>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-500">{t.ops.irDetail.reminderHint}</p>
        </Panel>
      )}

      <Panel title={t.ops.irDetail.signOffPanel}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.ops.irForm.signedBy} value={report.signedByName} />
            <Field label={t.ops.irDetail.signedAt} value={report.signedAt ? new Date(report.signedAt).toLocaleString() : null} />
          </div>
          <div>
            <div className={fieldLabelClass}>{t.ops.irForm.signature}</div>
            <div className="mt-2 inline-block rounded-md border border-ink-700 bg-white p-2">
              <img src={api.interventionSignatureUrl(report.id)} alt={t.ops.irForm.signature} className="h-24" />
            </div>
          </div>
          {report.attachmentFileName && (
            <div>
              <div className={fieldLabelClass}>{t.ops.irDetail.signedSheet}</div>
              <button
                type="button"
                onClick={handleDownloadAttachment}
                disabled={downloadingAttachment}
                className="mt-2 flex w-fit items-center gap-2 rounded-md border border-ink-700 px-3 py-2 text-sm text-cyan-accent hover:bg-ink-800 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {downloadingAttachment ? t.ops.irDetail.downloading : report.attachmentFileName}
              </button>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

export default InterventionReportDetailPage
