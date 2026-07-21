import { useEffect, useState, type FormEvent } from 'react'
import { Search, Plus, Pencil, Trash2, UserCog } from 'lucide-react'
import * as api from '../lib/api'
import type { Employee, EmploymentStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { employmentStatusTone as statusTone } from './statusTones'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const STATUSES: EmploymentStatus[] = ['ACTIVE', 'ON_LEAVE', 'TERMINATED']

interface FormState {
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
  department: string
  employmentStatus: EmploymentStatus
  hireDate: string
}

const EMPTY_FORM: FormState = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  position: '',
  department: '',
  employmentStatus: 'ACTIVE',
  hireDate: '',
}

function toFormState(e: Employee): FormState {
  return {
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email || '',
    phone: e.phone || '',
    position: e.position || '',
    department: e.department || '',
    employmentStatus: e.employmentStatus,
    hireDate: e.hireDate ? e.hireDate.slice(0, 10) : '',
  }
}

function EmployeesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<Employee | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load(searchValue = search) {
    setLoading(true)
    api
      .listEmployees({ search: searchValue || undefined })
      .then(({ employees }) => setEmployees(employees))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load employees'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setEditing(null)
    setShowCreate(true)
  }

  function openEdit(e: Employee) {
    setForm(toFormState(e))
    setFormError(null)
    setEditing(e)
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
      const input = {
        employeeCode: form.employeeCode,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        position: form.position || undefined,
        department: form.department || undefined,
        employmentStatus: form.employmentStatus,
        hireDate: form.hireDate || undefined,
      }
      if (editing) {
        await api.updateEmployee(editing.id, input)
      } else {
        await api.createEmployee(input)
      }
      toast.success(editing ? 'Employee updated' : 'Employee added')
      closeForm()
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save employee')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(e: Employee) {
    const ok = await confirm({
      title: 'Delete employee',
      message: `Delete ${e.firstName} ${e.lastName}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteEmployee(e.id)
      toast.success(`Deleted ${e.firstName} ${e.lastName}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete employee')
    }
  }

  return (
    <div className="flex flex-col gap-6">
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

      <StatCard label="TOTAL EMPLOYEES" value={employees.length} />

      <Panel>
        <div className="mb-4 flex flex-1 max-w-sm items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search by name or employee code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(search)}
            className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : employees.length === 0 ? (
          <EmptyState icon={UserCog} message="No employees yet. Add your first employee to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">CODE</th>
                  <th className="px-3 py-3 font-semibold">NAME</th>
                  <th className="px-3 py-3 font-semibold">POSITION</th>
                  <th className="px-3 py-3 font-semibold">DEPARTMENT</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-300">{e.employeeCode}</td>
                    <td className="px-3 py-3 font-medium text-ink-100">
                      {e.firstName} {e.lastName}
                    </td>
                    <td className="px-3 py-3 text-ink-300">{e.position || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{e.department || '—'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone[e.employmentStatus]}>{e.employmentStatus.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        <button type="button" onClick={() => openEdit(e)} aria-label="Edit employee" className="hover:text-ink-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(e)} aria-label="Delete employee" className="hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {(showCreate || editing) && (
        <Modal title={editing ? 'Edit Employee' : 'Add Employee'} onClose={closeForm}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>EMPLOYEE CODE</label>
                <input
                  value={form.employeeCode}
                  onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>STATUS</label>
                <select
                  value={form.employmentStatus}
                  onChange={(e) => setForm({ ...form, employmentStatus: e.target.value as EmploymentStatus })}
                  className={`mt-2 ${inputClass}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>FIRST NAME</label>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>LAST NAME</label>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>POSITION</label>
                <input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>DEPARTMENT</label>
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>EMAIL</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>PHONE</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>HIRE DATE</label>
                <input
                  type="date"
                  value={form.hireDate}
                  onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Add Employee'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default EmployeesPage
