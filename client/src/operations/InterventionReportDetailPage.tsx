import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, X, Check, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { InterventionReport } from '../lib/api'
import { JOB_CATEGORY_LABELS } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { reportStatusTone } from '../erp/statusTones'

const fieldLabelClass = 'text-[11px] font-semibold tracking-widest text-ink-400'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className={fieldLabelClass}>{label}</div>
      <div className="mt-1 text-sm text-ink-100">{value || <span className="text-ink-500">—</span>}</div>
    </div>
  )
}

function InterventionReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()

  const [report, setReport] = useState<InterventionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getInterventionReport(id)
      .then(({ interventionReport }) => setReport(interventionReport))
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

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !report) return <EmptyState icon={X} message={error || 'Intervention report not found'} />

  const isAdmin = user?.role === 'ADMIN'

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
          </div>
          <p className="mt-1 text-sm text-ink-300">
            <Link to={`/dashboard/operations/work-orders/${report.workOrderId}`} className="text-cyan-accent hover:underline">
              {report.workOrder.workOrderNumber}
            </Link>{' '}
            · {report.workOrder.customer.company || report.workOrder.customer.name} · {report.date.slice(0, 10)}
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

      <Panel title="Job Category & Contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="JOB CATEGORY" value={JOB_CATEGORY_LABELS[report.jobCategory]} />
          <Field label="CONTACT PERSON" value={report.contactPerson} />
          <Field label="CONTACT PHONE" value={report.contactPhone} />
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
        </div>
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
