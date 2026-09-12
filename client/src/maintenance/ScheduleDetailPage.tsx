import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, X, Check, FileText } from 'lucide-react'
import * as api from '../lib/api'
import type { MaintenanceSchedule } from '../lib/api'
import { Panel, Badge, Modal, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, dangerButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from '../lib/permissions'
import { scheduleStatusTone } from './statusTones'
import { reportStatusTone } from '../erp/statusTones'
import { submitOrQueue } from '../lib/outbox'
import { enumLabel, useT } from '../i18n'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

function ScheduleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const canManage = hasRole(user?.role, OPS_MANAGE_ROLES)
  const canSubmit = hasRole(user?.role, OPS_SUBMIT_ROLES)

  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState(false)

  const [showReport, setShowReport] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [workCompleted, setWorkCompleted] = useState(true)
  const [recommendations, setRecommendations] = useState('')
  const [reportError, setReportError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getMaintenanceSchedule(id)
      .then(({ schedule }) => setSchedule(schedule))
      .catch((err) => setError(err instanceof Error ? err.message : t.maint.scheduleDetail.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  function openReport() {
    setRemarks('')
    setWorkCompleted(true)
    setRecommendations('')
    setReportError(null)
    setShowReport(true)
  }

  async function handleReportSubmit(e: FormEvent) {
    e.preventDefault()
    setReportError(null)

    if (!remarks.trim()) {
      setReportError(t.maint.scheduleDetail.remarksRequired)
      return
    }

    setSubmitting(true)
    try {
      const { queued } = await submitOrQueue({
        kind: 'maintenance-report',
        label: t.maint.scheduleDetail.outboxLabel(
          (schedule!.contract?.asset ?? schedule!.request?.asset)?.name ??
            new Date(schedule!.scheduledDate).toLocaleDateString(t.shared.dateLocale),
        ),
        endpoint: `/api/maintenance-schedules/${schedule!.id}/report`,
        body: {
          remarks: remarks.trim(),
          workCompleted,
          recommendations: recommendations || undefined,
        },
      })
      toast.success(
        queued ? t.shared.savedOffline : t.maint.scheduleDetail.filed,
      )
      setShowReport(false)
      load()
    } catch (err) {
      setReportError(err instanceof Error ? err.message : t.maint.scheduleDetail.fileFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove() {
    setActioning(true)
    try {
      await api.approveMaintenanceReport(schedule!.id)
      toast.success(t.shared.reportApproved)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.shared.approveFailed)
    } finally {
      setActioning(false)
    }
  }

  async function handleReject() {
    setActioning(true)
    try {
      await api.rejectMaintenanceReport(schedule!.id)
      toast.success(t.shared.reportRejected)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.shared.rejectFailed)
    } finally {
      setActioning(false)
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !schedule) return <EmptyState icon={X} message={error || t.maint.scheduleDetail.notFound} />

  const locale = t.shared.dateLocale
  const assetRef = schedule.contract?.asset || schedule.request?.asset
  const canFileReport = canSubmit && schedule.status === 'SCHEDULED' && !schedule.report

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/maintenance/schedule"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.maint.scheduleDetail.back}
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink-100">{formatDate(schedule.scheduledDate, locale)}</h1>
            <Badge tone={scheduleStatusTone[schedule.status]}>{enumLabel(t.labels.scheduleStatus, schedule.status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {schedule.contract ? t.maint.scheduleDetail.preventiveVisit : t.maint.scheduleDetail.correctiveVisit}
            {assetRef && (
              <>
                {' · '}
                <span className="font-mono">{assetRef.assetNumber}</span> — {assetRef.name}
              </>
            )}
          </p>
          {schedule.request && <p className="mt-2 max-w-2xl text-sm text-ink-400">{schedule.request.description}</p>}
        </div>

        {canFileReport && (
          <button type="button" onClick={openReport} className={primaryButtonClass}>
            <FileText className="h-4 w-4" />
            {t.shared.fileReport}
          </button>
        )}
      </div>

      <Panel title={t.shared.techniciansPanel}>
        {schedule.technicians.length === 0 ? (
          <p className="text-sm text-ink-400">{t.shared.noTechniciansAssigned}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {schedule.technicians.map((t) => (
              <span key={t.id} className="rounded-full bg-ink-800 px-3 py-1.5 text-xs text-ink-200">
                {t.employee.firstName} {t.employee.lastName}
                {t.employee.position && <span className="text-ink-500"> · {t.employee.position}</span>}
              </span>
            ))}
          </div>
        )}
      </Panel>

      {schedule.report && (
        <Panel
          title={t.maint.scheduleDetail.report}
          action={
            <Badge tone={reportStatusTone[schedule.report.status]}>
              {enumLabel(t.labels.reportStatus, schedule.report.status)}
            </Badge>
          }
        >
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.remarks}</dt>
              <dd className="mt-1 text-sm text-ink-100">{schedule.report.remarks}</dd>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold tracking-widest text-ink-400">{t.shared.workCompleted}</dt>
                <dd className="mt-1 text-sm text-ink-100">{schedule.report.workCompleted ? t.shared.yes : t.shared.no}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-widest text-ink-400">{t.maint.scheduleDetail.filedBy}</dt>
                <dd className="mt-1 text-sm text-ink-100">
                  {schedule.report.submittedBy.name || schedule.report.submittedBy.email}
                </dd>
              </div>
            </div>
            {schedule.report.recommendations && (
              <div>
                <dt className="text-xs font-semibold tracking-widest text-ink-400">{t.maint.scheduleDetail.recommendations}</dt>
                <dd className="mt-1 text-sm text-ink-100">{schedule.report.recommendations}</dd>
              </div>
            )}
          </dl>

          {canManage && schedule.report.status === 'SUBMITTED' && (
            <div className="mt-4 flex gap-3">
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
        </Panel>
      )}

      {showReport && (
        <Modal title={t.maint.scheduleDetail.fileTitle} onClose={() => setShowReport(false)}>
          <form onSubmit={handleReportSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.shared.remarks}</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                required
                placeholder={t.maint.scheduleDetail.remarksPlaceholder}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{t.shared.workCompletedQuestion}</label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-ink-200">
                  <input type="radio" checked={workCompleted} onChange={() => setWorkCompleted(true)} className="accent-cyan-accent" />
                  {t.shared.yes}
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-200">
                  <input type="radio" checked={!workCompleted} onChange={() => setWorkCompleted(false)} className="accent-cyan-accent" />
                  {t.shared.no}
                </label>
              </div>
            </div>
            <div>
              <label className={labelClass}>{t.maint.scheduleDetail.recommendationsOptional}</label>
              <textarea
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {reportError && <p className="text-sm text-red-400">{reportError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.maint.scheduleDetail.filing : t.shared.fileReport}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ScheduleDetailPage
