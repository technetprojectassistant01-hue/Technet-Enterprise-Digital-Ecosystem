import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Link2Off, Pencil, Plus, Search, Trash2, UserCog, UserPlus } from 'lucide-react'
import * as api from './lib/api'
import type { ManagedUser, Role } from './lib/api'
import { useAuth } from './context/AuthContext'
import { Panel, EmptyState, TableSkeleton, Modal, Badge, Avatar } from './dashboard/ui'
import { inputClass, labelClass, primaryButtonClass } from './dashboard/buttonStyles'
import { useToast } from './dashboard/ToastContext'
import { useConfirm } from './dashboard/ConfirmContext'
import { useT } from './i18n'

/** A random temporary password for an admin-forced reset - the employee should change it on first login. */
function generateTempPassword(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(36)).join('').slice(0, 16)
}

const ROLES: Role[] = [
  'ADMIN',
  'SALES_OFFICER',
  'FINANCE_OFFICER',
  'STOREKEEPER',
  'HR_OFFICER',
  'OPERATIONS_MANAGER',
  'FIELD_TECHNICIAN',
  'EMPLOYEE',
]

/** Admin stands out; the rest are levelled, because no other role outranks another here. */
function roleTone(role: Role) {
  return role === 'ADMIN' ? 'accent' : 'neutral'
}

const ghostButton =
  'flex items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-medium text-ink-300 transition hover:border-cyan-accent hover:text-cyan-accent'

function UsersPage() {
  const toast = useToast()
  const t = useT()
  const confirm = useConfirm()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')

  const [creating, setCreating] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('EMPLOYEE')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Name, email and role are edited together in one dialog: they are the same job ("who is this
  // person, and what may they do"), and three separate actions per row made the table unreadable.
  // The password stays its own action - it is a different kind of decision, and destructive.
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<Role>('EMPLOYEE')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [resettingUser, setResettingUser] = useState<ManagedUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  function loadUsers() {
    setLoading(true)
    api
      .listUsers()
      .then(({ users }) => setUsers(users))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(loadUsers, [])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false
      if (!term) return true
      const employee = u.employee ? `${u.employee.employeeCode} ${u.employee.firstName} ${u.employee.lastName}` : ''
      return `${u.name ?? ''} ${u.email} ${employee}`.toLowerCase().includes(term)
    })
  }, [users, search, roleFilter])

  const unlinked = users.filter((u) => !u.employee && u.role !== 'ADMIN').length

  function openCreate() {
    setEmail('')
    setName('')
    setPassword('')
    setRole('EMPLOYEE')
    setFormError(null)
    setCreating(true)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await api.createUser({ email, password, name: name || undefined, role })
      toast.success(`User ${email} created`)
      setCreating(false)
      loadUsers()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  function openEdit(u: ManagedUser) {
    setEditing(u)
    setEditName(u.name ?? '')
    setEditEmail(u.email)
    setEditRole(u.role)
    setEditError(null)
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const nextName = editName.trim()
    const nextEmail = editEmail.trim().toLowerCase()
    if (!nextEmail) {
      setEditError('An email address is required')
      return
    }

    // Only send what actually changed, so an unchanged email never trips the duplicate check and
    // the server only writes a USER_EMAIL_CHANGED / USER_ROLE_CHANGED event when one really happened.
    const patch: Partial<{ name: string; email: string; role: Role }> = {}
    if (nextName !== (editing.name ?? '')) patch.name = nextName
    if (nextEmail !== editing.email) patch.email = nextEmail
    if (editRole !== editing.role) patch.role = editRole
    if (Object.keys(patch).length === 0) {
      setEditing(null)
      return
    }

    setSaving(true)
    setEditError(null)
    try {
      await api.updateUser(editing.id, patch)
      toast.success(patch.email ? `Now signs in as ${nextEmail}` : `${nextName || nextEmail} updated`)
      setEditing(null)
      loadUsers()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  function openPasswordReset(u: ManagedUser) {
    setResettingUser(u)
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setResetError(null)
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    if (!resettingUser) return
    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setResetError('The two passwords do not match')
      return
    }
    setSavingPassword(true)
    setResetError(null)
    try {
      await api.updateUser(resettingUser.id, { password: newPassword })
      toast.success(`Password updated for ${resettingUser.email}`)
      setResettingUser(null)
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleDelete(u: ManagedUser) {
    const ok = await confirm({
      title: 'Delete user',
      message: `Delete the login for ${u.name || u.email}? This cannot be undone. If they have work on file the server will refuse — change the email and password instead to hand the login to someone else.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteUser(u.id)
      toast.success(`Deleted ${u.email}`)
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const roleSelect = (value: Role, onChange: (r: Role) => void, id: string, disabled = false) => (
    <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Role)} className={inputClass}>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {t.roles[r]}
        </option>
      ))}
    </select>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">User Management</h1>
          <p className="mt-1 text-sm text-ink-300">
            Who can sign in, and what they may do. Passwords are set here — there is no self-service reset.
          </p>
        </div>
        <button type="button" onClick={openCreate} className={primaryButtonClass}>
          <Plus className="h-4 w-4" />
          Add user
        </button>
      </div>

      {unlinked > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-300">
          <Link2Off className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {unlinked === 1 ? '1 login is' : `${unlinked} logins are`} not attached to an employee record, so those
            people cannot check in, request leave or be paid. Attach them under{' '}
            <Link to="/dashboard/hr/employees" className="font-semibold underline">
              Technet HR → Employees
            </Link>
            .
          </span>
        </div>
      )}

      <Panel className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or employee"
              aria-label="Search users"
              className={`w-full pl-9 ${inputClass}`}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | '')}
            aria-label="Filter by role"
            className={`sm:w-56 ${inputClass}`}
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t.roles[r]}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <Panel>
          <TableSkeleton rows={4} cols={4} />
        </Panel>
      ) : visible.length === 0 ? (
        <Panel>
          <EmptyState
            icon={UserCog}
            message={users.length === 0 ? 'No users yet.' : 'No user matches that search.'}
          />
        </Panel>
      ) : (
        <Panel className="p-0">
          {/* Phone: one card per person. A five-column table at 400px is unreadable however it scrolls. */}
          <ul className="flex flex-col divide-y divide-ink-800 md:hidden">
            {visible.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={u.name || u.email} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-ink-100">{u.name || '—'}</div>
                    <div className="truncate text-sm text-ink-300">{u.email}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={roleTone(u.role)}>{t.roles[u.role]}</Badge>
                      {u.id === currentUser?.id && <span className="text-xs text-ink-400">You</span>}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-ink-400">
                  {u.employee ? (
                    <>
                      {u.employee.employeeCode} · {u.employee.firstName} {u.employee.lastName}
                    </>
                  ) : (
                    <span className="text-amber-300">No employee record</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openEdit(u)} className={ghostButton}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button type="button" onClick={() => openPasswordReset(u)} className={ghostButton}>
                    <KeyRound className="h-3.5 w-3.5" />
                    Password
                  </button>
                  <button
                    type="button"
                    disabled={u.id === currentUser?.id}
                    onClick={() => handleDelete(u)}
                    className="flex items-center gap-1.5 rounded-md border border-red-400/50 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-5 py-3 font-semibold">USER</th>
                  <th className="px-5 py-3 font-semibold">ROLE</th>
                  <th className="px-5 py-3 font-semibold">EMPLOYEE RECORD</th>
                  <th className="px-5 py-3 font-semibold">CREATED</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name || u.email} size={36} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-ink-100">{u.name || '—'}</span>
                            {u.id === currentUser?.id && <span className="text-xs text-ink-400">You</span>}
                          </div>
                          <div className="truncate text-xs text-ink-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={roleTone(u.role)}>{t.roles[u.role]}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      {u.employee ? (
                        <Link
                          to={`/dashboard/hr/employees/${u.employee.id}`}
                          className="text-ink-200 hover:text-cyan-accent hover:underline"
                        >
                          <span className="font-mono text-xs text-ink-400">{u.employee.employeeCode}</span>{' '}
                          {u.employee.firstName} {u.employee.lastName}
                        </Link>
                      ) : u.role === 'ADMIN' ? (
                        <span className="text-ink-500">—</span>
                      ) : (
                        <span className="text-xs text-amber-300">Not attached</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => openEdit(u)} title="Edit name, email and role" className={ghostButton}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button type="button" onClick={() => openPasswordReset(u)} title="Set a new password" className={ghostButton}>
                          <KeyRound className="h-3.5 w-3.5" />
                          Password
                        </button>
                        <button
                          type="button"
                          disabled={u.id === currentUser?.id}
                          onClick={() => handleDelete(u)}
                          title={u.id === currentUser?.id ? 'You cannot delete your own account' : 'Delete this login'}
                          className="flex items-center gap-1.5 rounded-md border border-red-400/50 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {creating && (
        <Modal title="Add User" onClose={() => setCreating(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label htmlFor="new-name" className={labelClass}>
                FULL NAME
              </label>
              <input
                id="new-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alan Steeve Smith"
                className={`mt-2 w-full ${inputClass}`}
              />
            </div>
            <div>
              <label htmlFor="new-email" className={labelClass}>
                SIGN-IN EMAIL
              </label>
              <input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`mt-2 w-full ${inputClass}`}
              />
            </div>
            <div>
              <label htmlFor="new-user-password" className={labelClass}>
                PASSWORD
              </label>
              <input
                id="new-user-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className={`mt-2 w-full ${inputClass}`}
              />
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-ink-400">At least 8 characters. Tell them what it is — no email is sent.</span>
                <button
                  type="button"
                  onClick={() => setPassword(generateTempPassword())}
                  className="text-xs text-cyan-accent hover:underline"
                >
                  Suggest one for me
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="new-role" className={labelClass}>
                ROLE
              </label>
              <div className="mt-2">{roleSelect(role, setRole, 'new-role')}</div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            {/* A login on its own cannot check in — SiteAttendance hangs off Employee, not User.
                Saying so here is cheaper than the silent blank landing page it otherwise causes. */}
            <p className="rounded-lg border border-ink-800 bg-ink-950 px-3 py-2.5 text-xs text-ink-300">
              A login on its own cannot check in, request leave or be paid. After creating it, add the person under
              Technet HR → Employees and set this account as their Linked Login.
            </p>

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              <UserPlus className="h-4 w-4" />
              {submitting ? 'Creating…' : 'Create user'}
            </button>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title="Edit User" onClose={() => setEditing(null)}>
          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="edit-name" className={labelClass}>
                FULL NAME
              </label>
              <input
                id="edit-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Not set"
                className={`mt-2 w-full ${inputClass}`}
              />
              <p className="mt-1.5 text-xs text-ink-400">
                Shown in the app header and on notifications. It does not change their employee record.
              </p>
            </div>

            <div>
              <label htmlFor="edit-email" className={labelClass}>
                SIGN-IN EMAIL
              </label>
              <input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
                className={`mt-2 w-full ${inputClass}`}
              />
              {editEmail.trim().toLowerCase() !== editing.email && (
                <p className="mt-1.5 text-xs text-amber-300">
                  {editing.id === currentUser?.id
                    ? 'You will sign in with this address from now on. Make sure you can receive mail there.'
                    : 'Their old address stops working immediately — tell them it has changed.'}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="edit-role" className={labelClass}>
                ROLE
              </label>
              <div className="mt-2">
                {roleSelect(editRole, setEditRole, 'edit-role', editing.id === currentUser?.id)}
              </div>
              {editing.id === currentUser?.id && (
                <p className="mt-1.5 text-xs text-ink-400">
                  You cannot change your own role — that is what stops an admin locking themselves out.
                </p>
              )}
            </div>

            {editError && <p className="text-sm text-red-400">{editError}</p>}

            <button type="submit" disabled={saving} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </Modal>
      )}

      {resettingUser && (
        <Modal title="Set New Password" onClose={() => setResettingUser(null)}>
          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              Choose the password {resettingUser.name || resettingUser.email} will sign in with, then tell them what
              it is — no email is sent. Their old password stops working straight away.
            </p>

            <div>
              <label htmlFor="new-password" className={labelClass}>
                NEW PASSWORD
              </label>
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className={`mt-2 w-full ${inputClass}`}
              />
              <p className="mt-1.5 text-xs text-ink-400">At least 8 characters.</p>
            </div>

            <div>
              <label htmlFor="confirm-password" className={labelClass}>
                CONFIRM PASSWORD
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                className={`mt-2 w-full ${inputClass}`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-ink-300">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="h-3.5 w-3.5 accent-cyan-accent"
                />
                Show password
              </label>
              {/* A suggestion the admin can still edit or replace — never the only option. */}
              <button
                type="button"
                onClick={() => {
                  const suggested = generateTempPassword()
                  setNewPassword(suggested)
                  setConfirmPassword(suggested)
                  setShowPassword(true)
                }}
                className="text-xs text-cyan-accent hover:underline"
              >
                Suggest one for me
              </button>
            </div>

            {resetError && <p className="text-sm text-red-400">{resetError}</p>}

            <button type="submit" disabled={savingPassword} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {savingPassword ? 'Saving…' : 'Save password'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default UsersPage
