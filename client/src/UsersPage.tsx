import { useEffect, useState, type FormEvent } from 'react'
import * as api from './lib/api'
import type { ManagedUser, Role } from './lib/api'
import { useAuth } from './context/AuthContext'
import './UsersPage.css'

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'EMPLOYEE']

function UsersPage() {
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
      loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return
    try {
      await api.deleteUser(id)
      loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  return (
    <div className="users-page">
      <div className="users-header">
        <h1>User Management</h1>
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Add user'}
        </button>
      </div>

      {showForm && (
        <form className="user-form" onSubmit={handleCreate}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
          {formError && <p className="form-error">{formError}</p>}
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading users…</p>
      ) : (
        <table className="users-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name || '—'}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={u.id === currentUser?.id}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    type="button"
                    className="delete"
                    disabled={u.id === currentUser?.id}
                    onClick={() => handleDelete(u.id, u.email)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default UsersPage
