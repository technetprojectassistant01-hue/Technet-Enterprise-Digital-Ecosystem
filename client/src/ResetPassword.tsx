import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Globe, Lock } from 'lucide-react'
import Logo from './components/Logo'
import { ApiError, resetPassword } from './lib/api'

function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      await resetPassword(token!, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-ink-100">
      <header className="flex items-center justify-between border-b border-cyan-accent/30 px-8 py-4">
        <Logo size="sm" />
        <div className="flex items-center gap-6 text-sm text-ink-200">
          <a href="#" className="hover:text-ink-100">
            Help Center
          </a>
          <span className="flex items-center gap-1.5">
            <Globe className="h-4 w-4" />
            EN
          </span>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 15% 30%, rgba(63,217,240,0.08), transparent 40%), radial-gradient(circle at 85% 65%, rgba(63,217,240,0.08), transparent 45%)',
          }}
        />

        <div className="relative w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-8 shadow-2xl shadow-black/40">
          <Logo size="lg" stacked className="mb-6" />

          {!token ? (
            <>
              <h1 className="text-center text-2xl font-semibold text-ink-100">Invalid Link</h1>
              <p className="mt-3 text-center text-sm text-ink-300">
                This password reset link is missing its token. Request a new one to continue.
              </p>
              <Link
                to="/forgot-password"
                className="mt-8 flex items-center justify-center gap-2 text-sm text-cyan-accent hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Request a New Link
              </Link>
            </>
          ) : done ? (
            <>
              <h1 className="text-center text-2xl font-semibold text-ink-100">Password Updated</h1>
              <p className="mt-3 text-center text-sm text-ink-300">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <Link
                to="/login"
                className="mt-8 flex items-center justify-center gap-2 text-sm text-cyan-accent hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-center text-2xl font-semibold text-ink-100">Set a New Password</h1>
              <p className="mt-2 text-center text-sm text-ink-300">
                Choose a new password for your account.
              </p>

              <form onSubmit={handleSubmit} className="mt-8">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold tracking-widest text-ink-300"
                >
                  NEW PASSWORD
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-ink-600 bg-ink-950 px-3 py-2.5 focus-within:border-cyan-accent">
                  <Lock className="h-4 w-4 text-ink-400" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="w-full bg-transparent text-ink-100 placeholder-ink-500 outline-none"
                  />
                </div>

                <label
                  htmlFor="confirmPassword"
                  className="mt-4 block text-xs font-semibold tracking-widest text-ink-300"
                >
                  CONFIRM PASSWORD
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-ink-600 bg-ink-950 px-3 py-2.5 focus-within:border-cyan-accent">
                  <Lock className="h-4 w-4 text-ink-400" />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                    minLength={8}
                    className="w-full bg-transparent text-ink-100 placeholder-ink-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 w-full rounded-md bg-cyan-accent py-3 text-sm font-semibold tracking-widest text-ink-950 transition hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'UPDATING…' : 'UPDATE PASSWORD'}
                </button>

                {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
              </form>

              <Link
                to="/login"
                className="mt-6 flex items-center justify-center gap-2 text-sm text-cyan-accent hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Link>
            </>
          )}

          <div className="mt-8 flex justify-center">
            <span className="flex items-center gap-2 rounded-full border border-ink-700 px-4 py-1.5 text-[11px] tracking-wide text-ink-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-accent" />
              All Core Systems Operational
            </span>
          </div>
        </div>
      </main>

      <footer className="flex flex-col gap-3 border-t border-ink-800 px-8 py-5 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 Technet Engineering. Digital Kineticism Secured.</span>
        <div className="flex flex-wrap gap-5">
          <a href="#" className="hover:text-ink-200">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-ink-200">
            Terms of Service
          </a>
          <a href="#" className="hover:text-ink-200">
            Security Audit
          </a>
          <a href="#" className="hover:text-ink-200">
            Contact Support
          </a>
        </div>
      </footer>
    </div>
  )
}

export default ResetPassword
