import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Pencil, Trash2, UserCog, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { Employee, EmploymentStatus } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useFormDraft } from '../lib/useFormDraft'
import { DraftNotice } from '../dashboard/DraftNotice'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, HR_ROLES } from '../lib/permissions'
import { employmentStatusTone as statusTone } from '../erp/statusTones'
import EmployeeForm, {
  EMPTY_EMPLOYEE_FORM,
  toEmployeeFormState,
  toEmployeeInput,
  type EmployeeFormState,
} from './EmployeeForm'
import { inputClass } from './formStyles'
import { useT, enumLabel } from '../i18n'

const STATUS_FILTERS: (EmploymentStatus | '')[] = ['', 'ACTIVE', 'ON_LEAVE', 'TERMINATED']

function EmployeesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const t = useT()
  const p = t.people.employees
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
  const draft = useFormDraft('employee', form, showCreate && !editing)
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
        .catch((err) => setError(err instanceof Error ? err.message : p.loadFailed))
        .finally(() => setLoading(false))
    },
    [search, department, status, p],
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
    setForm(draft.take(EMPTY_EMPLOYEE_FORM))
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

    // Only when editing: the server assigns the code on create, and the form deliberately shows
    // no field for it there — requiring it made Add Employee impossible to submit at all.
    if (editing && !form.employeeCode.trim()) {
      setFormError(p.codeRequired)
      return
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError(p.namesRequired)
      return
    }

    setSubmitting(true)
    try {
      const input = toEmployeeInput(form)
      if (editing) {
        await api.updateEmployee(editing.id, input)
      } else {
        await api.createEmployee(input)
        draft.clear()
      }
      toast.success(editing ? p.updated : p.added)
      closeForm()
      load()
      api
        .listDepartments()
        .then(({ departments }) => setDepartments(departments))
        .catch(() => undefined)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : p.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(employee: Employee) {
    const ok = await confirm({
      title: p.deleteTitle,
      message: p.deleteMessage(`${employee.firstName} ${employee.lastName}`),
      confirmLabel: p.deleteConfirm,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteEmployee(employee.id)
      toast.success(p.deleted(`${employee.firstName} ${employee.lastName}`))
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : p.deleteFailed)
    }
  }

  const activeCount = employees.filter((e) => e.employmentStatus === 'ACTIVE').length
  const onLeaveCount = employees.filter((e) => e.employmentStatus === 'ON_LEAVE').length

  function exportCsv() {
    downloadCsv(
      'employees',
      [
        { header: p.csv.code, accessor: (e: Employee) => e.employeeCode },
        { header: p.csv.firstName, accessor: (e: Employee) => e.firstName },
        { header: p.csv.lastName, accessor: (e: Employee) => e.lastName },
        { header: p.csv.position, accessor: (e: Employee) => e.position },
        { header: p.csv.department, accessor: (e: Employee) => e.department },
        { header: p.csv.contract, accessor: (e: Employee) => e.contractType },
        { header: p.csv.status, accessor: (e: Employee) => e.employmentStatus },
      ],
      employees,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{p.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{p.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            {p.exportCsv}
          </button>
          {canWrite && (
            <button type="button" onClick={openCreate} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              {p.add}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={p.statShown} value={employees.length} icon={UserCog} />
        <StatCard label={p.statActive} value={activeCount} icon={UserCog} />
        <StatCard label={p.statOnLeave} value={onLeaveCount} icon={UserCog} />
      </div>

      <Panel title={p.panel}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder={p.searchPlaceholder}
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
            <option value="">{p.allDepartments}</option>
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
                {s ? enumLabel(t.labels.employmentStatus, s) : p.allStatuses}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : employees.length === 0 ? (
          <EmptyState icon={UserCog} message={p.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{p.colCode}</th>
                  <th className="px-3 py-3 font-semibold">{p.colName}</th>
                  <th className="px-3 py-3 font-semibold">{p.colPosition}</th>
                  <th className="px-3 py-3 font-semibold">{p.colDepartment}</th>
                  <th className="px-3 py-3 font-semibold">{p.colContract}</th>
                  <th className="px-3 py-3 font-semibold">{p.colStatus}</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-mono text-ink-300">{e.employeeCode}</td>
                    <td className="px-3 py-3 font-medium">
                      <Link to={`/dashboard/hr/employees/${e.id}`} className="text-ink-100 hover:text-cyan-accent">
                        {e.firstName} {e.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{e.position || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{e.department || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">
                      {e.contractType ? enumLabel(t.people.contractType, e.contractType) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone[e.employmentStatus]}>{enumLabel(t.labels.employmentStatus, e.employmentStatus)}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          <button
                            type="button"
                            onClick={() => openEdit(e)}
                            aria-label={p.editAria}
                            className="hover:text-ink-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(e)}
                            aria-label={p.deleteAria}
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
        <Modal title={editing ? p.edit : p.add} size="lg" onClose={closeForm}>
          {!editing && draft.restored && (
            <div className="mb-4">
              <DraftNotice onDiscard={() => setForm(draft.discard())} />
            </div>
          )}
          <EmployeeForm
            form={form}
            setForm={setForm}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={formError}
            submitLabel={editing ? p.saveChanges : p.add}
            isCreate={!editing}
          />
        </Modal>
      )}
    </div>
  )
}

export default EmployeesPage
