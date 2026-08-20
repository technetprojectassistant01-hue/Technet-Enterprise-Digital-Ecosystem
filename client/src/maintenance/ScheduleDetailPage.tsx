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

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ScheduleDetailPage() {
  const { id } = useParams<{ id: string }>()
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
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load visit'))
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
      setReportError('Remarks are required')
      return
    }

    setSubmitting(true)
    try {
      await api.submitMaintenanceReport(schedule!.id, {
        remarks: remarks.trim(),
        workCompleted,
        recommendations: recommendations || undefined,
      })
      toast.success('Report filed')
      setShowReport(false)
      load()
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to file report')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove() {
    setActioning(true)
    try {
      await api.approveMaintenanceReport(schedule!.id)
      toast.success('Report approved')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve report')
    } finally {
      setActioning(false)
    }
  }

  async function handleReject() {
    setActioning(true)
    try {
      await api.rejectMaintenanceReport(schedule!.id)
      toast.success('Report rejected')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject report')
    } finally {
      setActioning(false)
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !schedule) return <EmptyState icon={X} message={error || 'Visit not found'} />

  const assetRef = schedule.contract?.asset || schedule.request?.asset
  const canFileReport = canSubmit && schedule.status === 'SCHEDULED' && !schedule.report

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/maintenance/schedule"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Schedule
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink-100">{formatDate(schedule.scheduledDate)}</h1>
            <Badge tone={scheduleStatusTone[schedule.status]}>{schedule.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {schedule.contract ? 'Preventive visit' : 'Corrective visit'}
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
            File Report
          </button>
        )}
      </div>

      <Panel title="Technicians">
        {schedule.technicians.length === 0 ? (
          <p className="text-sm text-ink-400">No technicians assigned yet.</p>
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
          title="Maintenance Report"
          action={<Badge tone={reportStatusTone[schedule.report.status]}>{schedule.report.status}</Badge>}
        >
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="text-xs font-semibold tracking-widest text-ink-400">REMARKS</dt>
              <dd className="mt-1 text-sm text-ink-100">{schedule.report.remarks}</dd>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-semibold tracking-widest text-ink-400">WORK COMPLETED</dt>
                <dd className="mt-1 text-sm text-ink-100">{schedule.report.workCompleted ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-widest text-ink-400">FILED BY</dt>
                <dd className="mt-1 text-sm text-ink-100">
                  {schedule.report.submittedBy.name || schedule.report.submittedBy.email}
                </dd>
              </div>
            </div>
            {schedule.report.recommendations && (
              <div>
                <dt className="text-xs font-semibold tracking-widest text-ink-400">RECOMMENDATIONS</dt>
                <dd className="mt-1 text-sm text-ink-100">{schedule.report.recommendations}</dd>
              </div>
            )}
          </dl>

          {canManage && schedule.report.status === 'SUBMITTED' && (
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={handleApprove} disabled={actioning} className={primaryButtonClass}>
                <Check className="h-4 w-4" />
                Approve
              </button>
              <button type="button" onClick={handleReject} disabled={actioning} className={dangerButtonClass}>
                <X className="h-4 w-4" />
                Reject
              </button>
            </div>
          )}
        </Panel>
      )}

      {showReport && (
        <Modal title="File Maintenance Report" onClose={() => setShowReport(false)}>
          <form onSubmit={handleReportSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>REMARKS</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                required
                placeholder="What was found and done during the visit..."
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>WORK COMPLETED?</label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-ink-200">
                  <input type="radio" checked={workCompleted} onChange={() => setWorkCompleted(true)} className="accent-cyan-accent" />
                  Yes
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-200">
                  <input type="radio" checked={!workCompleted} onChange={() => setWorkCompleted(false)} className="accent-cyan-accent" />
                  No
                </label>
              </div>
            </div>
            <div>
              <label className={labelClass}>RECOMMENDATIONS (OPTIONAL)</label>
              <textarea
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {reportError && <p className="text-sm text-red-400">{reportError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Filing…' : 'File Report'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ScheduleDetailPage
