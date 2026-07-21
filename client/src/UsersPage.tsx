import { useEffect, useState, type FormEvent } from 'react'
import { UserCog } from 'lucide-react'
import * as api from './lib/api'
import type { ManagedUser, Role } from './lib/api'
import { useAuth } from './context/AuthContext'
import { Panel, EmptyState, TableSkeleton } from './dashboard/ui'
import { useToast } from './dashboard/ToastContext'
import { useConfirm } from './dashboard/ConfirmContext'

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'EMPLOYEE']

const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'

function UsersPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('EMPLOYEE')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function loadUsers() {
    setLoading(true)
    api
      .listUsers()
      .then(({ users }) => setUsers(users))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(loadUsers, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await api.createUser({ email, password, name: name || undefined, role })
      toast.success(`User ${email} created`)
      setEmail('')
      setName('')
      setPassword('')
      setRole('EMPLOYEE')
      setShowForm(false)
      loadUsers()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRoleChange(id: string, newRole: Role) {
    try {
      await api.updateUser(id, { role: newRole })
      toast.success('Role updated')
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  async function handleDelete(id: string, email: string) {
    const ok = await confirm({
      title: 'Delete user',
      message: `Delete user ${email}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteUser(id)
      toast.success(`Deleted ${email}`)
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-100">User Management</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark"
        >
          {showForm ? 'Cancel' : 'Add user'}
        </button>
      </div>

      {showForm && (
        <Panel className="mb-5">
          <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className={inputClass}
            />
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
            {formError && <p className="w-full text-sm text-red-400">{formError}</p>}
          </form>
        </Panel>
      )}

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {loading ? (
        <Panel>
          <TableSkeleton cols={5} />
        </Panel>
      ) : users.length === 0 ? (
        <Panel>
          <EmptyState icon={UserCog} message="No users yet." />
        </Panel>
      ) : (
        <Panel className="p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                <th className="px-5 py-3 font-semibold">EMAIL</th>
                <th className="px-5 py-3 font-semibold">NAME</th>
                <th className="px-5 py-3 font-semibold">ROLE</th>
                <th className="px-5 py-3 font-semibold">CREATED</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ink-800 last:border-0">
                  <td className="px-5 py-3 text-ink-100">{u.email}</td>
                  <td className="px-5 py-3 text-ink-300">{u.name || '—'}</td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role}
                      disabled={u.id === currentUser?.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      className="rounded-md border border-ink-600 bg-ink-950 px-2 py-1 text-xs text-ink-100 disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-ink-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      disabled={u.id === currentUser?.id}
                      onClick={() => handleDelete(u.id, u.email)}
                      className="rounded-md border border-red-400/50 px-3 py-1 text-xs text-red-400 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  )
}

export default UsersPage
