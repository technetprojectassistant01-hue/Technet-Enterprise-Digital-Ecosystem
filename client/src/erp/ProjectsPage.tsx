import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, FolderKanban } from 'lucide-react'
import * as api from '../lib/api'
import type { Project, ProjectStatus, ServiceCategory } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { useCustomers } from './useCustomers'
import { useEmployees } from './useEmployees'
import { projectStatusTone } from './statusTones'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const CATEGORIES: ServiceCategory[] = ['ELECTRICAL', 'ELV_SECURITY', 'MECHANICAL', 'PLUMBING', 'SAFETY', 'OTHER']

interface FormState {
  name: string
  customerId: string
  description: string
  serviceCategory: ServiceCategory
  budget: string
  startDate: string
  endDate: string
  managerId: string
}

const EMPTY_FORM: FormState = {
  name: '',
  customerId: '',
  description: '',
  serviceCategory: 'OTHER',
  budget: '',
  startDate: '',
  endDate: '',
  managerId: '',
}

function ProjectsPage() {
  const toast = useToast()
  const customers = useCustomers()
  const employees = useEmployees()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load(searchValue = search) {
    setLoading(true)
    api
      .listProjects({ search: searchValue || undefined })
      .then(({ projects }) => setProjects(projects))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projects'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowCreate(true)
  }

  function closeForm() {
    setShowCreate(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.name.trim()) {
      setFormError('Name is required')
      return
    }

    setSubmitting(true)
    try {
      await api.createProject({
        name: form.name,
        customerId: form.customerId || undefined,
        description: form.description || undefined,
        serviceCategory: form.serviceCategory,
        budget: form.budget === '' ? undefined : Number(form.budget),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        managerId: form.managerId || undefined,
      })
      toast.success('Project created')
      closeForm()
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  const activeCount = projects.filter((p) => p.status !== 'CLOSED' && p.status !== 'CANCELLED').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="TOTAL PROJECTS" value={projects.length} />
        <StatCard label="ACTIVE" value={activeCount} />
      </div>

      <Panel>
        <div className="mb-4 flex flex-1 max-w-sm items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(search)}
            className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : projects.length === 0 ? (
          <EmptyState icon={FolderKanban} message="No projects yet. Create your first project to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">NAME</th>
                  <th className="px-3 py-3 font-semibold">CUSTOMER</th>
                  <th className="px-3 py-3 font-semibold">MANAGER</th>
                  <th className="px-3 py-3 font-semibold">BUDGET</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/erp/projects/${p.id}`}
                        className="font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{p.customer?.company || p.customer?.name || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">
                      {p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-ink-100">
                      {p.budget ? `$${Number(p.budget).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={projectStatusTone[p.status as ProjectStatus]}>{p.status.replace('_', ' ')}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showCreate && (
        <Modal title="New Project" onClose={closeForm}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>NAME</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CUSTOMER</label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                >
                  <option value="">—</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>SERVICE CATEGORY</label>
                <select
                  value={form.serviceCategory}
                  onChange={(e) => setForm({ ...form, serviceCategory: e.target.value as ServiceCategory })}
                  className={`mt-2 ${inputClass}`}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>DESCRIPTION</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>BUDGET</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>PROJECT MANAGER</label>
                <select
                  value={form.managerId}
                  onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                >
                  <option value="">—</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>START DATE</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>END DATE</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
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
              {submitting ? 'Creating…' : 'Create Project'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ProjectsPage
