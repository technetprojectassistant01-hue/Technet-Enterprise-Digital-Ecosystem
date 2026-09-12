import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, X, Trash2, FileText, Plus, MapPin, Pencil } from 'lucide-react'
import * as api from '../lib/api'
import type { WorkOrderDetail, WorkOrderStatus } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass, dangerButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from '../lib/permissions'
import { mapLink } from '../lib/geolocation'
import { workOrderStatusTone, reportStatusTone } from '../erp/statusTones'
import { enumLabel, navLabel, useT } from '../i18n'

const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'

function siteStatusTone(status: 'ON_SITE' | 'OUTSIDE_SITE' | 'UNVERIFIED') {
  if (status === 'ON_SITE') return 'success' as const
  if (status === 'OUTSIDE_SITE') return 'warning' as const
  return 'neutral' as const
}

function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const confirm = useConfirm()
  const t = useT()
  const { user } = useAuth()
  const canSubmit = hasRole(user?.role, OPS_SUBMIT_ROLES)
  const canManage = hasRole(user?.role, OPS_MANAGE_ROLES)

  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioning, setActioning] = useState(false)
  const [editingSite, setEditingSite] = useState(false)
  const [siteQueryInput, setSiteQueryInput] = useState('')
  const [savingSite, setSavingSite] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getWorkOrder(id)
      .then(({ workOrder }) => setWorkOrder(workOrder))
      .catch((err) => setError(err instanceof Error ? err.message : t.ops.woDetail.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const myEmployeeId = user?.employeeId ?? null
  const isAssignedTechnician =
    !!workOrder && myEmployeeId !== null && workOrder.technicians.some((x) => x.employee.id === myEmployeeId)
  const myOpenVisit =
    workOrder && myEmployeeId
      ? workOrder.siteAttendance.find((v) => v.employee.id === myEmployeeId && !v.checkOutAt)
      : undefined
  const hasSiteCoords = !!workOrder?.siteLat && !!workOrder?.siteLng
  const myLatestVerification = myOpenVisit?.verifications[0] ?? null

  async function setStatus(status: WorkOrderStatus) {
    if (!workOrder) return
    setActioning(true)
    try {
      await api.updateWorkOrder(workOrder.id, { status })
      toast.success(t.ops.woDetail.updated)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.woDetail.updateFailed)
    } finally {
      setActioning(false)
    }
  }

  function openSiteEditor() {
    setSiteQueryInput(workOrder?.siteAddress ?? '')
    setEditingSite(true)
  }

  async function handleSaveSite() {
    if (!workOrder) return
    setSavingSite(true)
    try {
      await api.updateWorkOrder(workOrder.id, { siteQuery: siteQueryInput })
      toast.success(t.ops.woDetail.siteUpdated)
      setEditingSite(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.woDetail.siteUpdateFailed)
    } finally {
      setSavingSite(false)
    }
  }

  async function handleDelete() {
    if (!workOrder) return
    const ok = await confirm({
      title: t.ops.wo.deleteTitle,
      message: t.ops.woDetail.deleteMessage(workOrder.workOrderNumber),
      confirmLabel: t.shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteWorkOrder(workOrder.id)
      toast.success(t.ops.woDetail.deleted)
      window.location.href = '/dashboard/operations/work-orders'
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.ops.wo.deleteFailed)
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !workOrder) return <EmptyState icon={X} message={error || t.ops.woDetail.notFound} />

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/operations/work-orders"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.ops.woDetail.back}
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-ink-100">{workOrder.workOrderNumber}</h1>
            <Badge tone={workOrderStatusTone[workOrder.status]}>
              {enumLabel(t.labels.workOrderStatus, workOrder.status)}
            </Badge>
            {isAssignedTechnician && myOpenVisit && (
              <Badge tone={siteStatusTone(myLatestVerification?.status ?? 'UNVERIFIED')}>
                {enumLabel(t.labels.siteStatus, myLatestVerification?.status ?? 'UNVERIFIED')}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {workOrder.title} · {workOrder.customer.company || workOrder.customer.name} ·{' '}
            {enumLabel(t.labels.jobCategory, workOrder.jobCategory)} ·{' '}
            {t.ops.woDetail.scheduledOn(workOrder.scheduledDate.slice(0, 10))}
          </p>
          {workOrder.description && <p className="mt-2 text-sm text-ink-400">{workOrder.description}</p>}

          {canManage && (
            <div className="mt-2 text-sm">
              {editingSite ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={siteQueryInput}
                    onChange={(e) => setSiteQueryInput(e.target.value)}
                    placeholder={t.ops.woDetail.sitePlaceholder}
                    className={inputClass}
                  />
                  <button type="button" onClick={handleSaveSite} disabled={savingSite} className={primaryButtonClass}>
                    {t.shared.save}
                  </button>
                  <button type="button" onClick={() => setEditingSite(false)} className={secondaryButtonClass}>
                    {t.common.cancel}
                  </button>
                </div>
              ) : hasSiteCoords ? (
                <div className="flex items-center gap-2 text-ink-400">
                  <a
                    href={mapLink(workOrder.siteLat!, workOrder.siteLng!)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-cyan-accent hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {workOrder.siteAddress ?? t.ops.woDetail.siteSet}
                  </a>
                  <button type="button" onClick={openSiteEditor} className="text-ink-400 hover:text-ink-100">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={openSiteEditor} className="flex items-center gap-1.5 text-ink-400 hover:text-ink-100">
                  <MapPin className="h-3.5 w-3.5" />
                  {t.ops.woDetail.setSite}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canSubmit && workOrder.status === 'SCHEDULED' && (
            <button type="button" onClick={() => setStatus('IN_PROGRESS')} disabled={actioning} className={primaryButtonClass}>
              {t.ops.woDetail.startWork}
            </button>
          )}
          {canSubmit && workOrder.status === 'IN_PROGRESS' && (
            <button
              type="button"
              onClick={() => setStatus('WAITING_FOR_PARTS')}
              disabled={actioning}
              className={secondaryButtonClass}
            >
              {t.ops.woDetail.waitingForParts}
            </button>
          )}
          {canSubmit && workOrder.status === 'IN_PROGRESS' && (
            <button type="button" onClick={() => setStatus('COMPLETED')} disabled={actioning} className={primaryButtonClass}>
              {t.ops.woDetail.markCompleted}
            </button>
          )}
          {canSubmit && workOrder.status === 'WAITING_FOR_PARTS' && (
            <button type="button" onClick={() => setStatus('IN_PROGRESS')} disabled={actioning} className={primaryButtonClass}>
              {t.ops.woDetail.resumeWork}
            </button>
          )}
          {canManage && workOrder.status === 'COMPLETED' && (
            <button type="button" onClick={() => setStatus('REOPENED')} disabled={actioning} className={secondaryButtonClass}>
              {t.ops.woDetail.reopen}
            </button>
          )}
          {canManage && workOrder.status === 'REOPENED' && (
            <button type="button" onClick={() => setStatus('IN_PROGRESS')} disabled={actioning} className={primaryButtonClass}>
              {t.ops.woDetail.resumeWork}
            </button>
          )}
          {canSubmit &&
            (workOrder.status === 'SCHEDULED' ||
              workOrder.status === 'IN_PROGRESS' ||
              workOrder.status === 'WAITING_FOR_PARTS' ||
              workOrder.status === 'REOPENED') && (
              <button type="button" onClick={() => setStatus('CANCELLED')} disabled={actioning} className={dangerButtonClass}>
                {t.common.cancel}
              </button>
            )}
          {canManage && (
            <button type="button" onClick={handleDelete} className={secondaryButtonClass}>
              <Trash2 className="h-4 w-4" />
              {t.shared.delete}
            </button>
          )}
        </div>
      </div>

      <Panel title={t.ops.woDetail.assignedTechnicians}>
        {workOrder.technicians.length === 0 ? (
          <p className="text-sm text-ink-400">{t.shared.noTechniciansAssigned}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {workOrder.technicians.map((x) => (
              <span key={x.id} className="rounded-full bg-ink-800 px-3 py-1.5 text-xs text-ink-200">
                {x.employee.firstName} {x.employee.lastName}
                {x.employee.position && <span className="text-ink-500"> · {x.employee.position}</span>}
              </span>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t.ops.woDetail.siteAttendance}>
        {workOrder.siteAttendance.length === 0 ? (
          <p className="text-sm text-ink-400">{t.ops.woDetail.noCheckIns}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.ops.wo.technician}</th>
                  <th className="px-3 py-3 font-semibold">{t.ops.woDetail.colCheckIn}</th>
                  <th className="px-3 py-3 font-semibold">{t.ops.woDetail.colCheckOut}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.siteAttendance.map((v) => {
                  const latest = v.verifications[0] ?? null
                  return (
                    <tr key={v.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-3 text-ink-100">
                        {v.employee.firstName} {v.employee.lastName}
                      </td>
                      <td className="px-3 py-3 text-ink-300">
                        <a
                          href={mapLink(v.checkInLat, v.checkInLng)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-cyan-accent hover:underline"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {new Date(v.checkInAt).toLocaleString()}
                          {v.checkInNote && <span> · {v.checkInNote}</span>}
                        </a>
                      </td>
                      <td className="px-3 py-3 text-ink-300">
                        {v.checkOutAt && v.checkOutLat && v.checkOutLng ? (
                          <a
                            href={mapLink(v.checkOutLat, v.checkOutLng)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 text-cyan-accent hover:underline"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            {new Date(v.checkOutAt).toLocaleString()}
                            {v.checkOutNote && <span> · {v.checkOutNote}</span>}
                          </a>
                        ) : (
                          <span className="text-ink-500">{t.ops.woDetail.stillOnSite}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {latest ? (
                          <Badge tone={siteStatusTone(latest.status)}>{enumLabel(t.labels.siteStatus, latest.status)}</Badge>
                        ) : (
                          <span className="text-ink-500">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={navLabel(t, 'Intervention Reports')}
        action={
          canSubmit && (
            <Link
              to={`/dashboard/operations/intervention-reports/new?workOrderId=${workOrder.id}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-cyan-accent hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.shared.fileReport}
            </Link>
          )
        }
      >
        {workOrder.interventionReports.length === 0 ? (
          <EmptyState icon={FileText} message={t.ops.woDetail.noReports} />
        ) : (
          <div className="flex flex-col gap-2">
            {workOrder.interventionReports.map((r) => (
              <Link
                key={r.id}
                to={`/dashboard/operations/intervention-reports/${r.id}`}
                className="flex items-center justify-between rounded-lg bg-ink-800 px-4 py-2.5 hover:bg-ink-700"
              >
                <span className="font-mono text-sm text-ink-100">{r.interventionNumber}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-400">
                    {r.workCompleted ? t.ops.woDetail.workCompleted : t.ops.woDetail.incomplete}
                  </span>
                  <Badge tone={reportStatusTone[r.status]}>{enumLabel(t.labels.reportStatus, r.status)}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

export default WorkOrderDetailPage
