import { useState, type FormEvent } from 'react'
import * as api from './lib/api'
import './SettingsPage.css'

function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match')
      return
    }

    setSubmitting(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <form className="password-form" onSubmit={handleSubmit}>
        <h2>Change password</h2>

        <label htmlFor="currentPassword">Current password</label>
        <input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />

        <label htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          required
        />

        <label htmlFor="confirmPassword">Confirm new password</label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
        />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
        </button>

        {error && <p className="status error">{error}</p>}
        {success && <p className="status success">Password updated successfully.</p>}
      </form>
    </div>
  )
}

export default SettingsPage
