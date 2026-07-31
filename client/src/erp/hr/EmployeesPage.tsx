import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Pencil, Trash2, UserCog } from 'lucide-react'
import * as api from '../../lib/api'
import type { Employee, EmploymentStatus } from '../../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../../dashboard/ui'
import { useToast } from '../../dashboard/ToastContext'
import { useConfirm } from '../../dashboard/ConfirmContext'
import { useAuth } from '../../context/AuthContext'
import { hasRole, HR_ROLES } from '../../lib/permissions'
import { employmentStatusTone as statusTone } from '../statusTones'
import EmployeeForm, {
  EMPTY_EMPLOYEE_FORM,
  toEmployeeFormState,
  toEmployeeInput,
  type EmployeeFormState,
} from './EmployeeForm'
import { inputClass } from './formStyles'

const STATUS_FILTERS: (EmploymentStatus | '')[] = ['', 'ACTIVE', 'ON_LEAVE', 'TERMINATED']

function EmployeesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, HR_ROLES)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState<EmploymentStatus | ''>('')

  const [editing, setEditing] = useState<Employee | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<EmployeeFormState>(EMPTY_EMPLOYEE_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    (overrides: { search?: string; department?: string; status?: EmploymentStatus | '' } = {}) => {
      const params = {
        search: overrides.search ?? search,
        department: overrides.department ?? department,
        status: overrides.status ?? status,
      }
      setLoading(true)
      setError(null)
      api
        .listEmployees({
          search: params.search || undefined,
          department: params.department || undefined,
          status: params.status || undefined,
        })
        .then(({ employees }) => setEmployees(employees))
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load employees'))
        .finally(() => setLoading(false))
    },
    [search, department, status],
  )

  useEffect(() => {
    load({ search: '', department: '', status: '' })
    api
      .listDepartments()
      .then(({ departments }) => setDepartments(departments))
      .catch(() => setDepartments([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setForm(EMPTY_EMPLOYEE_FORM)
    setFormError(null)
    setEditing(null)
    setShowCreate(true)
  }

  function openEdit(employee: Employee) {
    setForm(toEmployeeFormState(employee))
    setFormError(null)
    setEditing(employee)
    setShowCreate(false)
  }

  function closeForm() {
    setShowCreate(false)
    setEditing(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.employeeCode.trim()) {
      setFormError('Employee code is required')
      return
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('First and last name are required')
      return
    }

    setSubmitting(true)
    try {
      const input = toEmployeeInput(form)
      if (editing) {
        await api.updateEmployee(editing.id, input)
      } else {
        await api.createEmployee(input)
      }
      toast.success(editing ? 'Employee updated' : 'Employee added')
      closeForm()
      load()
      api
        .listDepartments()
        .then(({ departments }) => setDepartments(departments))
        .catch(() => undefined)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save employee')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(employee: Employee) {
    const ok = await confirm({
      title: 'Delete employee',
      message: `Delete ${employee.firstName} ${employee.lastName}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteEmployee(employee.id)
      toast.success(`Deleted ${employee.firstName} ${employee.lastName}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete employee')
    }
  }

  const activeCount = employees.filter((e) => e.employmentStatus === 'ACTIVE').length
  const onLeaveCount = employees.filter((e) => e.employmentStatus === 'ON_LEAVE').length

  return (
    <div className="flex flex-col gap-6">
      {canWrite && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark"
          >
            <Plus className="h-4 w-4" />
            Add Employee
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="EMPLOYEES SHOWN" value={employees.length} />
        <StatCard label="ACTIVE" value={activeCount} />
        <StatCard label="ON LEAVE" value={onLeaveCount} />
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search by name, code, or position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
            />
          </div>

          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value)
              load({ department: e.target.value })
            }}
            className={`max-w-[12rem] ${inputClass}`}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => {
              const next = e.target.value as EmploymentStatus | ''
              setStatus(next)
              load({ status: next })
            }}
            className={`max-w-[12rem] ${inputClass}`}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s ? s.replace('_', ' ') : 'All statuses'}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : employees.length === 0 ? (
          <EmptyState icon={UserCog} message="No employees match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">CODE</th>
                  <th className="px-3 py-3 font-semibold">NAME</th>
                  <th className="px-3 py-3 font-semibold">POSITION</th>
                  <th className="px-3 py-3 font-semibold">DEPARTMENT</th>
                  <th className="px-3 py-3 font-semibold">CONTRACT</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-300">{e.employeeCode}</td>
                    <td className="px-3 py-3 font-medium">
                      <Link to={`/dashboard/erp/hr/employees/${e.id}`} className="text-ink-100 hover:text-cyan-accent">
                        {e.firstName} {e.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{e.position || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{e.department || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">
                      {e.contractType ? e.contractType.replace('_', ' ') : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone[e.employmentStatus]}>{e.employmentStatus.replace('_', ' ')}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          <button
                            type="button"
                            onClick={() => openEdit(e)}
                            aria-label="Edit employee"
                            className="hover:text-ink-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(e)}
                            aria-label="Delete employee"
                            className="hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {(showCreate || editing) && (
        <Modal title={editing ? 'Edit Employee' : 'Add Employee'} size="lg" onClose={closeForm}>
          <EmployeeForm
            form={form}
            setForm={setForm}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={formError}
            submitLabel={editing ? 'Save Changes' : 'Add Employee'}
          />
        </Modal>
      )}
    </div>
  )
}

export default EmployeesPage
