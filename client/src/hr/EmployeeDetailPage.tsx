import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, X, FolderKanban, ShieldAlert, CalendarDays, BadgeCheck } from 'lucide-react'
import * as api from '../lib/api'
import type {
  Certification,
  EmployeeDetail,
  LeaveBalance,
  LeaveRequest,
  TrainingRecord,
} from '../lib/api'
import { Panel, Modal, Badge, EmptyState, TableSkeleton, Avatar } from '../dashboard/ui'
import { secondaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, isAdminLike, HR_ROLES, PERSONAL_DOCUMENT_ROLES } from '../lib/permissions'
import { employmentStatusTone, projectStatusTone, leaveRequestStatusTone } from '../erp/statusTones'
import { formatMoney } from '../lib/format'
import EmployeeForm, {
  toEmployeeFormState,
  toEmployeeInput,
  EMPTY_EMPLOYEE_FORM,
  type EmployeeFormState,
} from './EmployeeForm'
import {
  certificationState,
  certificationStateTone,
} from './certificationStatus'
import EmployeeDocumentsPanel from './EmployeeDocumentsPanel'
import HomeLocationPanel from './HomeLocationPanel'
import { useT, enumLabel, type Dict } from '../i18n'

function formatDate(value: string | null, locale: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Whole years and months since the hire date, e.g. "2 yrs 3 mos". */
function formatTenure(hireDate: string | null, d: Dict['people']['detail']): string {
  if (!hireDate) return '—'
  const start = new Date(hireDate)
  const now = new Date()
  if (Number.isNaN(start.getTime()) || start > now) return '—'

  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) months = 0

  const years = Math.floor(months / 12)
  const remainder = months % 12
  if (years === 0) return d.tenureMonths(remainder)
  return d.tenureYears(years, remainder)
}

function daysUntil(value: string | null): number | null {
  if (!value) return null
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-widest text-ink-400">{label}</dt>
      <dd className="mt-1 text-sm text-ink-100">{children}</dd>
    </div>
  )
}

function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const { user } = useAuth()
  const t = useT()
  const d = t.people.detail
  const locale = t.shared.dateLocale
  const canSeeSensitive = isAdminLike(user?.role) || user?.role === 'HR_OFFICER'
  // Uploaded ID cards, passports and medical notes are HR's alone — an admin runs the platform and
  // does not need them (PERSONAL_DOCUMENT_ROLES; the API refuses them too, not just this panel).
  const canSeePersonalDocuments = hasRole(user?.role, PERSONAL_DOCUMENT_ROLES)
  const canSetHome = hasRole(user?.role, HR_ROLES)

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([])
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EmployeeFormState>(EMPTY_EMPLOYEE_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    api
      .getEmployee(id)
      .then(({ employee }) => setEmployee(employee))
      .catch((err) => setError(err instanceof Error ? err.message : d.loadFailed))
      .finally(() => setLoading(false))

    // Leave is HR-only, so these calls are expected to fail for other roles.
    api
      .listLeaveBalances({ year: new Date().getFullYear(), employeeId: id })
      .then(({ balances }) => setBalances(balances))
      .catch(() => setBalances([]))
    api
      .listLeaveRequests({ employeeId: id })
      .then(({ requests }) => setLeaveHistory(requests.slice(0, 8)))
      .catch(() => setLeaveHistory([]))
    api
      .listCertifications({ employeeId: id })
      .then(({ certifications }) => setCertifications(certifications))
      .catch(() => setCertifications([]))
    api
      .listTrainingRecords({ employeeId: id })
      .then(({ records }) => setTrainingRecords(records))
      .catch(() => setTrainingRecords([]))
  }, [id, d])

  useEffect(load, [load])

  function openEdit() {
    if (!employee) return
    setForm(toEmployeeFormState(employee))
    setFormError(null)
    setEditing(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!employee) return

    if (!form.employeeCode.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      setFormError(d.requiredFields)
      return
    }

    setSubmitting(true)
    try {
      await api.updateEmployee(employee.id, toEmployeeInput(form))
      toast.success(t.people.employees.updated)
      setEditing(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.people.employees.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !employee) return <EmptyState icon={X} message={error || d.notFound} />

  const fullName = `${employee.firstName} ${employee.lastName}`
  const probationDays = daysUntil(employee.probationEndDate)
  const contractDays = daysUntil(employee.contractEndDate)

  const alerts: string[] = []
  if (probationDays !== null && probationDays >= 0 && probationDays <= 30) {
    alerts.push(d.probationAlert(probationDays))
  }
  if (contractDays !== null && contractDays >= 0 && contractDays <= 60) {
    alerts.push(d.contractAlert(contractDays))
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/hr/employees"
        className="flex w-fit items-center gap-2 text-sm text-ink-300 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {d.back}
      </Link>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={fullName} size={56} />
            <div>
              <h2 className="text-xl font-semibold text-ink-100">{fullName}</h2>
              <p className="mt-1 text-sm text-ink-300">
                {employee.position || d.noPosition}
                {employee.department ? ` · ${employee.department}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={employmentStatusTone[employee.employmentStatus]}>
                  {enumLabel(t.labels.employmentStatus, employee.employmentStatus)}
                </Badge>
                <span className="font-mono text-xs text-ink-400">{employee.employeeCode}</span>
                {employee.contractType && (
                  <span className="text-xs text-ink-400">· {enumLabel(t.people.contractType, employee.contractType)}</span>
                )}
              </div>
            </div>
          </div>

          {canSeeSensitive && (
            <button type="button" onClick={openEdit} className={secondaryButtonClass}>
              <Pencil className="h-4 w-4" />
              {d.edit}
            </button>
          )}
        </div>

        {alerts.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {alerts.map((alert) => (
              <p
                key={alert}
                className="flex items-center gap-2 rounded-md bg-amber-400/10 px-3 py-2 text-sm text-amber-400"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                {alert}
              </p>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title={d.employment}>
          <dl className="grid grid-cols-2 gap-4">
            <Row label={d.hireDate}>{formatDate(employee.hireDate, locale)}</Row>
            <Row label={d.tenure}>{formatTenure(employee.hireDate, d)}</Row>
            <Row label={d.jobGrade}>{employee.jobGrade || '—'}</Row>
            <Row label={d.contractType}>
              {employee.contractType ? enumLabel(t.people.contractType, employee.contractType) : '—'}
            </Row>
            <Row label={d.probationEnds}>{formatDate(employee.probationEndDate, locale)}</Row>
            <Row label={d.contractEnds}>{formatDate(employee.contractEndDate, locale)}</Row>
            {employee.employmentStatus === 'TERMINATED' && (
              <>
                <Row label={d.exitDate}>{formatDate(employee.exitDate, locale)}</Row>
                <Row label={d.exitReason}>{employee.exitReason || '—'}</Row>
              </>
            )}
            <Row label={d.linkedLogin}>
              {employee.user ? `${employee.user.email} (${t.roles[employee.user.role]})` : d.none}
            </Row>
          </dl>
        </Panel>

        <Panel title={d.personal}>
          <dl className="grid grid-cols-2 gap-4">
            <Row label={d.phone}>{employee.phone || '—'}</Row>
            <Row label={d.email}>{employee.email || '—'}</Row>
            {canSeeSensitive && (
              <>
                <Row label={d.nationalId}>{employee.nationalId || '—'}</Row>
                <Row label={d.dateOfBirth}>{formatDate(employee.dateOfBirth, locale)}</Row>
                <Row label={d.gender}>
                  {employee.gender ? t.people.gender[employee.gender] : '—'}
                </Row>
                <Row label={d.address}>{employee.address || '—'}</Row>
              </>
            )}
          </dl>

          {canSeeSensitive && (
            <>
              <h3 className="mt-6 mb-3 text-xs font-semibold tracking-widest text-ink-400">
                {d.emergencyContact}
              </h3>
              <dl className="grid grid-cols-2 gap-4">
                <Row label={d.name}>{employee.emergencyContactName || '—'}</Row>
                <Row label={d.phone}>{employee.emergencyContactPhone || '—'}</Row>
                <Row label={d.relationship}>{employee.emergencyContactRelation || '—'}</Row>
              </dl>
            </>
          )}
        </Panel>

        {canSeeSensitive && (
          <Panel title={d.payroll}>
            <dl className="grid grid-cols-2 gap-4">
              <Row label={d.basicSalary}>
                {employee.basicSalary ? formatMoney(employee.basicSalary) : '—'}
              </Row>
              <Row label={d.bank}>{employee.bankName || '—'}</Row>
              <Row label={d.accountNumber}>{employee.bankAccountNumber || '—'}</Row>
            </dl>
          </Panel>
        )}

        {canSeeSensitive && (
          <Panel title={d.leaveTitle(new Date().getFullYear())} icon={CalendarDays}>
            {balances.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">
                {d.noBalances}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                      <th className="py-2 pr-3 font-semibold">{d.colType}</th>
                      <th className="py-2 pr-3 font-semibold">{d.colEntitled}</th>
                      <th className="py-2 pr-3 font-semibold">{d.colUsed}</th>
                      <th className="py-2 font-semibold">{d.colRemaining}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((b) => {
                      const remaining =
                        Number(b.entitledDays) + Number(b.carriedOverDays) - Number(b.usedDays)
                      return (
                        <tr key={b.id} className="border-b border-ink-800 last:border-0">
                          <td className="py-2 pr-3 text-ink-100">{b.leaveType.name}</td>
                          <td className="py-2 pr-3 text-ink-300">{b.entitledDays}</td>
                          <td className="py-2 pr-3 text-ink-300">{b.usedDays}</td>
                          <td
                            className={`py-2 font-medium ${
                              remaining < 0 ? 'text-red-400' : 'text-ink-100'
                            }`}
                          >
                            {remaining.toFixed(1)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {leaveHistory.length > 0 && (
              <>
                <h3 className="mt-6 mb-3 text-xs font-semibold tracking-widest text-ink-400">
                  {d.recentRequests}
                </h3>
                <ul className="flex flex-col gap-2">
                  {leaveHistory.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-300">
                        {r.leaveType.name} · {formatDate(r.startDate, locale)}
                        {r.startDate !== r.endDate ? ` → ${formatDate(r.endDate, locale)}` : ''}
                        <span className="text-ink-400"> · {d.daysShort(r.days)}</span>
                      </span>
                      <Badge tone={leaveRequestStatusTone[r.status]}>{enumLabel(t.labels.leaveStatus, r.status)}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        )}

        {canSeeSensitive && (
          <Panel title={d.certsTitle} icon={BadgeCheck}>
            {certifications.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">{d.noCerts}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {certifications.map((c) => {
                  const state = certificationState(c)
                  return (
                    <li key={c.id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-ink-100">{c.name}</div>
                        <div className="text-xs text-ink-400">
                          {c.issuingBody || d.noIssuingBody} · {d.expires(formatDate(c.expiryDate, locale))}
                        </div>
                      </div>
                      <Badge tone={certificationStateTone[state]}>{t.labels.certificationState[state]}</Badge>
                    </li>
                  )
                })}
              </ul>
            )}

            {trainingRecords.length > 0 && (
              <>
                <h3 className="mt-6 mb-3 text-xs font-semibold tracking-widest text-ink-400">{d.training}</h3>
                <ul className="flex flex-col gap-2">
                  {trainingRecords.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-100">{r.title}</span>
                      <span className="text-xs text-ink-400">{formatDate(r.completedDate, locale)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        )}

        {canSeePersonalDocuments && id && <EmployeeDocumentsPanel employeeId={id} />}
        {/* HR only (the API refuses everyone else): used just for the check-in-near-home flag. */}
        {canSetHome && id && <HomeLocationPanel employeeId={id} />}

        <Panel title={d.projects} icon={FolderKanban}>
          {employee.managedProjects.length === 0 && employee.projectAssignments.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">{d.noProjects}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {employee.managedProjects.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold tracking-widest text-ink-400">{d.managing}</h3>
                  <ul className="flex flex-col gap-2">
                    {employee.managedProjects.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3">
                        <Link
                          to={`/dashboard/erp/projects/${p.id}`}
                          className="text-sm text-ink-100 hover:text-cyan-accent"
                        >
                          {p.name}
                        </Link>
                        <Badge tone={projectStatusTone[p.status]}>{enumLabel(t.erp.status.project, p.status)}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {employee.projectAssignments.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold tracking-widest text-ink-400">{d.assignedTo}</h3>
                  <ul className="flex flex-col gap-2">
                    {employee.projectAssignments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3">
                        <Link
                          to={`/dashboard/erp/projects/${a.project.id}`}
                          className="text-sm text-ink-100 hover:text-cyan-accent"
                        >
                          {a.project.name}
                          {a.role ? <span className="text-ink-400"> · {a.role}</span> : null}
                        </Link>
                        <Badge tone={projectStatusTone[a.project.status]}>
                          {enumLabel(t.erp.status.project, a.project.status)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      {employee.notes && canSeeSensitive && (
        <Panel title={d.notes}>
          <p className="whitespace-pre-wrap text-sm text-ink-300">{employee.notes}</p>
        </Panel>
      )}

      {editing && (
        <Modal title={d.editTitle(fullName)} size="lg" onClose={() => setEditing(false)}>
          <EmployeeForm
            form={form}
            setForm={setForm}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={formError}
            submitLabel={d.saveChanges}
          />
        </Modal>
      )}
    </div>
  )
}

export default EmployeeDetailPage
