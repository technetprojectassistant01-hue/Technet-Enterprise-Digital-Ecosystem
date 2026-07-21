import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, X, Receipt, CreditCard } from 'lucide-react'
import * as api from '../lib/api'
import type { ProjectDetail, ProjectStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useEmployees } from './useEmployees'
import { projectStatusTone, projectStatusTransitions, invoiceStatusTone } from './statusTones'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const confirm = useConfirm()
  const employees = useEmployees()

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changingStatus, setChangingStatus] = useState(false)

  const [showAssign, setShowAssign] = useState(false)
  const [assignEmployeeId, setAssignEmployeeId] = useState('')
  const [assignRole, setAssignRole] = useState('')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getProject(id)
      .then(({ project }) => setProject(project))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load project'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function handleStatusChange(newStatus: ProjectStatus) {
    if (!project) return
    if (newStatus === 'CANCELLED') {
      const ok = await confirm({
        title: 'Cancel project',
        message: `Move "${project.name}" to CANCELLED? This is a terminal state.`,
        confirmLabel: 'Cancel Project',
        tone: 'danger',
      })
      if (!ok) return
    }
    setChangingStatus(true)
    try {
      await api.updateProjectStatus(project.id, newStatus)
      toast.success(`Project moved to ${newStatus.replace('_', ' ')}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setChangingStatus(false)
    }
  }

  function openAssign() {
    setAssignEmployeeId('')
    setAssignRole('')
    setAssignError(null)
    setShowAssign(true)
  }

  async function handleAssignSubmit(e: FormEvent) {
    e.preventDefault()
    setAssignError(null)
    if (!assignEmployeeId) {
      setAssignError('Select an employee')
      return
    }
    setAssigning(true)
    try {
      await api.assignToProject(project!.id, assignEmployeeId, assignRole || undefined)
      toast.success('Employee assigned')
      setShowAssign(false)
      load()
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign employee')
    } finally {
      setAssigning(false)
    }
  }

  async function handleUnassign(employeeId: string, name: string) {
    const ok = await confirm({
      title: 'Remove from project',
      message: `Remove ${name} from this project?`,
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.unassignFromProject(project!.id, employeeId)
      toast.success('Removed from project')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove employee')
    }
  }

  if (loading) {
    return <TableSkeleton rows={6} cols={4} />
  }

  if (error || !project) {
    return <EmptyState icon={X} message={error || 'Project not found'} />
  }

  const invoiced = project.invoices.reduce((sum, i) => sum + Number(i.amount), 0)
  const expensed = project.expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const budget = project.budget ? Number(project.budget) : null
  const variance = budget !== null ? budget - expensed : null
  const nextStatuses = projectStatusTransitions[project.status]
  const assignedIds = new Set(project.assignments.map((a) => a.employeeId))
  const availableEmployees = employees.filter((e) => !assignedIds.has(e.id))

  return (
    <div className="flex flex-col gap-6">
      <Link to="/dashboard/erp/projects" className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink-100">{project.name}</h1>
            <Badge tone={projectStatusTone[project.status]}>{project.status.replace('_', ' ')}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {project.customer?.company || project.customer?.name || 'No customer'} ·{' '}
            {project.serviceCategory.replace('_', ' ')}
          </p>
          {project.description && <p className="mt-2 max-w-2xl text-sm text-ink-400">{project.description}</p>}
        </div>

        {nextStatuses.length > 0 && (
          <select
            value=""
            disabled={changingStatus}
            onChange={(e) => e.target.value && handleStatusChange(e.target.value as ProjectStatus)}
            className={`w-56 ${inputClass}`}
          >
            <option value="">Move to…</option>
            {nextStatuses.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="BUDGET" value={budget !== null ? `$${budget.toLocaleString()}` : '—'} />
        <StatCard label="INVOICED" value={`$${invoiced.toLocaleString()}`} />
        <StatCard label="EXPENSED" value={`$${expensed.toLocaleString()}`} />
        <StatCard
          label="VARIANCE"
          value={variance !== null ? `$${variance.toLocaleString()}` : '—'}
          deltaTone={variance !== null && variance < 0 ? 'warning' : 'positive'}
        />
      </div>

      <Panel
        title="Team"
        action={
          <button
            type="button"
            onClick={openAssign}
            className="flex items-center gap-1.5 text-xs font-semibold text-cyan-accent hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Assign
          </button>
        }
      >
        {project.assignments.length === 0 ? (
          <p className="text-sm text-ink-400">No one assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {project.assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-ink-800 px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium text-ink-100">
                    {a.employee.firstName} {a.employee.lastName}
                  </span>
                  <span className="ml-2 text-xs text-ink-400">{a.roleOnProject || a.employee.position || ''}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnassign(a.employeeId, `${a.employee.firstName} ${a.employee.lastName}`)}
                  aria-label="Remove from project"
                  className="text-ink-400 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title="Invoices"
          icon={Receipt}
          action={
            <Link to="/dashboard/erp/finance/invoices" className="text-xs font-semibold text-cyan-accent hover:underline">
              Manage &gt;
            </Link>
          }
        >
          {project.invoices.length === 0 ? (
            <p className="text-sm text-ink-400">No invoices for this project.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {project.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg bg-ink-800 px-4 py-2.5">
                  <span className="text-sm text-ink-100">{inv.invoiceNumber}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-ink-300">${Number(inv.amount).toLocaleString()}</span>
                    <Badge tone={invoiceStatusTone[inv.status]}>{inv.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Expenses"
          icon={CreditCard}
          action={
            <Link to="/dashboard/erp/finance/expenses" className="text-xs font-semibold text-cyan-accent hover:underline">
              Manage &gt;
            </Link>
          }
        >
          {project.expenses.length === 0 ? (
            <p className="text-sm text-ink-400">No expenses for this project.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {project.expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between rounded-lg bg-ink-800 px-4 py-2.5">
                  <span className="text-sm text-ink-100">{exp.category}</span>
                  <span className="text-sm text-ink-300">${Number(exp.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {showAssign && (
        <Modal title="Assign Employee" onClose={() => setShowAssign(false)}>
          <form onSubmit={handleAssignSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>EMPLOYEE</label>
              <select
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
                className={`mt-2 ${inputClass}`}
              >
                <option value="">Select an employee</option>
                {availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>ROLE ON PROJECT (OPTIONAL)</label>
              <input
                value={assignRole}
                onChange={(e) => setAssignRole(e.target.value)}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {assignError && <p className="text-sm text-red-400">{assignError}</p>}

            <button
              type="submit"
              disabled={assigning}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ProjectDetailPage
