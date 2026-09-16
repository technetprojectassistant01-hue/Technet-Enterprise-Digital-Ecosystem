import { useEffect, useState, type FormEvent } from 'react'
import { UserCog, KeyRound, AtSign } from 'lucide-react'
import * as api from './lib/api'
import type { ManagedUser, Role } from './lib/api'
import { useAuth } from './context/AuthContext'
import { Panel, EmptyState, TableSkeleton, Modal } from './dashboard/ui'
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

const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'

function UsersPage() {
  const toast = useToast()
  const t = useT()
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
  // The admin types the new password themselves (a generated one is only ever a suggestion), so
  // this is a form, not a confirm-and-reveal — same deliberate dialog shape as the email change.
  const [resettingUser, setResettingUser] = useState<ManagedUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  // Changing an email changes how that person signs in, so it gets its own deliberate dialog
  // rather than an inline edit — including when an admin is changing their own.
  const [editingEmail, setEditingEmail] = useState<ManagedUser | null>(null)
  const [nextEmail, setNextEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [savingEmail, setSavingEmail] = useState(false)

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

  function openEmailEditor(u: ManagedUser) {
    setEditingEmail(u)
    setNextEmail(u.email)
    setEmailError(null)
  }

  async function handleSaveEmail(e: FormEvent) {
    e.preventDefault()
    if (!editingEmail) return
    setEmailError(null)
    setSavingEmail(true)
    try {
      await api.updateUser(editingEmail.id, { email: nextEmail })
      const changingOwn = editingEmail.id === currentUser?.id
      toast.success(
        changingOwn
          ? `You now sign in as ${nextEmail.trim().toLowerCase()}`
          : `${editingEmail.email} now signs in as ${nextEmail.trim().toLowerCase()}`,
      )
      setEditingEmail(null)
      loadUsers()
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to change the email')
    } finally {
      setSavingEmail(false)
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
                  {t.roles[r]}
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
                          {t.roles[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-ink-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEmailEditor(u)}
                        title="Change sign-in email"
                        className="flex items-center gap-1 rounded-md border border-ink-600 px-3 py-1 text-xs text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                      >
                        <AtSign className="h-3.5 w-3.5" />
                        Change Email
                      </button>
                      <button
                        type="button"
                        onClick={() => openPasswordReset(u)}
                        title="Set a new password"
                        className="flex items-center gap-1 rounded-md border border-ink-600 px-3 py-1 text-xs text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Reset Password
                      </button>
                      <button
                        type="button"
                        disabled={u.id === currentUser?.id}
                        onClick={() => handleDelete(u.id, u.email)}
                        className="rounded-md border border-red-400/50 px-3 py-1 text-xs text-red-400 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {editingEmail && (
        <Modal title="Change Sign-In Email" onClose={() => setEditingEmail(null)}>
          <form onSubmit={handleSaveEmail} className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              {editingEmail.id === currentUser?.id
                ? 'This is the address you sign in with, and where a password reset link would be sent. Make sure you can actually receive mail at the new one.'
                : `This is the address ${editingEmail.name || editingEmail.email} signs in with. Tell them it has changed — their old address stops working immediately.`}
            </p>
            <div>
              <label htmlFor="next-email" className="text-xs font-semibold tracking-widest text-ink-400">
                EMAIL
              </label>
              <input
                id="next-email"
                type="email"
                value={nextEmail}
                onChange={(e) => setNextEmail(e.target.value)}
                required
                className={`mt-2 w-full ${inputClass}`}
              />
            </div>

            {emailError && <p className="text-sm text-red-400">{emailError}</p>}

            <button
              type="submit"
              disabled={savingEmail || nextEmail.trim().toLowerCase() === editingEmail.email}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingEmail ? 'Saving…' : 'Save Email'}
            </button>
          </form>
        </Modal>
      )}

      {resettingUser && (
        <Modal title="Set New Password" onClose={() => setResettingUser(null)}>
          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              Choose the password {resettingUser.name || resettingUser.email} will sign in with, then tell them
              what it is — no email is sent. Their old password stops working straight away.
            </p>

            <div>
              <label htmlFor="new-password" className="text-xs font-semibold tracking-widest text-ink-400">
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
              <label htmlFor="confirm-password" className="text-xs font-semibold tracking-widest text-ink-400">
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

            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingPassword ? 'Saving…' : 'Save Password'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default UsersPage
