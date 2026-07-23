import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, X, Check, Download, Link2, BellRing } from 'lucide-react'
import * as api from '../lib/api'
import type { InterventionReport, ReminderInterval } from '../lib/api'
import { JOB_CATEGORY_LABELS, WORK_TYPE_LABELS, REMINDER_INTERVAL_LABELS } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { reportStatusTone } from '../erp/statusTones'
import { useWorkOrders } from './useWorkOrders'

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

function PhotoGrid({ reportId, photos, kind, label }: { reportId: string; photos: InterventionReport['photos']; kind: 'EQUIPMENT' | 'WORK_DONE'; label: string }) {
  const filtered = photos.filter((p) => p.kind === kind)
  return (
    <div>
      <div className={fieldLabelClass}>{label}</div>
      {filtered.length === 0 ? (
        <p className="mt-1 text-sm text-ink-500">None uploaded.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-3">
          {filtered.map((p) => (
            <a key={p.id} href={api.interventionPhotoUrl(reportId, p.id)} target="_blank" rel="noreferrer">
              <img
                src={api.interventionPhotoUrl(reportId, p.id)}
                alt={p.fileName}
                className="h-24 w-24 rounded-md border border-ink-700 object-cover hover:border-cyan-accent"
              />
            </a>
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
  const { user } = useAuth()
  const workOrders = useWorkOrders()

  const [report, setReport] = useState<InterventionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState(false)

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
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load intervention report'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function handleApprove() {
    if (!report) return
    setActioning(true)
    try {
      await api.approveInterventionReport(report.id)
      toast.success('Report approved')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve report')
    } finally {
      setActioning(false)
    }
  }

  async function handleReject() {
    if (!report) return
    const ok = await confirm({
      title: 'Reject intervention report',
      message: `Reject report ${report.interventionNumber}?`,
      confirmLabel: 'Reject',
      tone: 'danger',
    })
    if (!ok) return
    setActioning(true)
    try {
      await api.rejectInterventionReport(report.id)
      toast.success('Report rejected')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject report')
    } finally {
      setActioning(false)
    }
  }

  async function handleLinkWorkOrder() {
    if (!report || !linkWorkOrderId) return
    setActioning(true)
    try {
      await api.linkWorkOrderToInterventionReport(report.id, linkWorkOrderId)
      toast.success('Work order linked')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to link work order')
    } finally {
      setActioning(false)
    }
  }

  async function handleSetReminder() {
    if (!report) return
    setActioning(true)
    try {
      await api.setInterventionReportReminder(report.id, reminderChoice || null)
      toast.success(reminderChoice ? 'Reminder set' : 'Reminder cleared')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update reminder')
    } finally {
      setActioning(false)
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !report) return <EmptyState icon={X} message={error || 'Intervention report not found'} />

  const isAdmin = user?.role === 'ADMIN'
  const reminderDue = !!report.nextReminderAt && new Date(report.nextReminderAt) <= new Date()

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/operations/intervention-reports"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Intervention Reports
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink-100">{report.interventionNumber}</h1>
            <Badge tone={reportStatusTone[report.status]}>{report.status}</Badge>
            {reminderDue && <Badge tone="warning">REMINDER DUE</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {report.customer.company || report.customer.name} · {WORK_TYPE_LABELS[report.workType]} · {report.date.slice(0, 10)}
            {report.workOrder && (
              <>
                {' · '}
                <Link to={`/dashboard/operations/work-orders/${report.workOrder.id}`} className="text-cyan-accent hover:underline">
                  {report.workOrder.workOrderNumber}
                </Link>
              </>
            )}
          </p>
        </div>

        {isAdmin && report.status === 'SUBMITTED' && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={actioning}
              className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:opacity-70"
            >
              <Check className="h-4 w-4" />
              Approve
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={actioning}
              className="flex items-center gap-2 rounded-md border border-red-400/50 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 disabled:opacity-70"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
          </div>
        )}
      </div>

      {report.reviewNote && (
        <Panel>
          <p className="text-sm text-ink-300">
            <span className="font-semibold text-ink-100">Review note:</span> {report.reviewNote}
          </p>
        </Panel>
      )}

      {!report.workOrder && (
        <Panel title="Work Order">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className={fieldLabelClass}>LINK A WORK ORDER (OPTIONAL)</label>
              <select value={linkWorkOrderId} onChange={(e) => setLinkWorkOrderId(e.target.value)} className={`mt-2 w-full ${inputClass}`}>
                <option value="">Select a work order</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.workOrderNumber} — {wo.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleLinkWorkOrder}
              disabled={!linkWorkOrderId || actioning}
              className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              Link
            </button>
          </div>
        </Panel>
      )}

      <Panel title="Job Category & Contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="JOB CATEGORY" value={JOB_CATEGORY_LABELS[report.jobCategory]} />
          <Field
            label="WORK TYPE"
            value={
              report.workType === 'OTHER' && report.workTypeOther
                ? `${WORK_TYPE_LABELS[report.workType]} — ${report.workTypeOther}`
                : WORK_TYPE_LABELS[report.workType]
            }
          />
          <Field label="CONTACT PERSON" value={report.contactPerson} />
        </div>
      </Panel>

      {(report.equipment || report.make || report.model || report.serialNo) && (
        <Panel title="Equipment / System">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="EQUIPMENT" value={report.equipment} />
            <Field label="MAKE" value={report.make} />
            <Field label="MODEL" value={report.model} />
            <Field label="SERIAL NO." value={report.serialNo} />
          </div>
        </Panel>
      )}

      <Panel title="Fault & Work Done">
        <div className="flex flex-col gap-4">
          <Field label="NATURE OF INTERVENTION / FAULT REPORTED" value={report.natureOfIntervention} />
          <Field label="ACTION TAKEN / WORK DONE" value={report.actionTaken} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="WORK COMPLETED" value={report.workCompleted ? 'Yes' : 'No'} />
            <Field label="TIME IN" value={report.timeIn} />
            <Field label="TIME OUT" value={report.timeOut} />
          </div>
          {!report.workCompleted && <Field label="DETAILS" value={report.incompleteDetails} />}
        </div>
      </Panel>

      <Panel title="Photos">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <PhotoGrid reportId={report.id} photos={report.photos} kind="EQUIPMENT" label="EQUIPMENT PHOTOS" />
          <PhotoGrid reportId={report.id} photos={report.photos} kind="WORK_DONE" label="PHOTOS OF WORK DONE" />
        </div>
      </Panel>

      <Panel title="Technicians">
        {report.technicians.length === 0 ? (
          <p className="text-sm text-ink-400">No technicians recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {report.technicians.map((t) => (
              <span key={t.id} className="rounded-full bg-ink-800 px-3 py-1.5 text-xs text-ink-200">
                {t.employee.firstName} {t.employee.lastName}
              </span>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Warranty & Report">
        <div className="flex flex-col gap-4">
          <Field
            label="EQUIPMENT UNDER WARRANTY"
            value={report.warrantyStatus === 'UNKNOWN' ? 'D.N' : report.warrantyStatus === 'YES' ? 'Yes' : report.warrantyStatus === 'NO' ? 'No' : null}
          />
          <Field label="TECHNICIAN'S REPORT" value={report.technicianReport} />
          <Field label="COMMENTS / RECOMMENDATIONS" value={report.comments} />
          <Field label="OTHER IMPORTANT INFORMATION" value={report.additionalInfo} />
        </div>
      </Panel>

      <Panel title="Follow-up Reminder">
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className={fieldLabelClass}>REMIND ME</label>
            <select
              value={reminderChoice}
              onChange={(e) => setReminderChoice(e.target.value as ReminderInterval | '')}
              className={`mt-2 w-full ${inputClass}`}
            >
              <option value="">No reminder</option>
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {REMINDER_INTERVAL_LABELS[opt]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleSetReminder}
            disabled={actioning || reminderChoice === (report.reminderInterval || '')}
            className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BellRing className="h-4 w-4" />
            Save
          </button>
          {report.nextReminderAt && (
            <span className="pb-2.5 text-xs text-ink-400">Next: {report.nextReminderAt.slice(0, 10)}</span>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-500">
          This surfaces the report under "Reminders Due" in the list once the date passes — no email or SMS is sent.
        </p>
      </Panel>

      <Panel title="Sign-off & Attachment">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="SIGNED BY" value={report.signedByName} />
            <Field label="SIGNED AT" value={report.signedAt ? new Date(report.signedAt).toLocaleString() : null} />
          </div>
          <div>
            <div className={fieldLabelClass}>SIGNATURE</div>
            <div className="mt-2 inline-block rounded-md border border-ink-700 bg-white p-2">
              <img src={api.interventionSignatureUrl(report.id)} alt="Signature" className="h-24" />
            </div>
          </div>
          {report.attachmentFileName && (
            <div>
              <div className={fieldLabelClass}>SIGNED SHEET</div>
              <a
                href={api.interventionAttachmentUrl(report.id)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex w-fit items-center gap-2 rounded-md border border-ink-700 px-3 py-2 text-sm text-cyan-accent hover:bg-ink-800"
              >
                <Download className="h-4 w-4" />
                {report.attachmentFileName}
              </a>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

export default InterventionReportDetailPage
