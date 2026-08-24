import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { usePortalAuth } from './PortalAuthContext'
import Logo from '../components/Logo'

function PortalLogin() {
  const { customer, loading, login } = usePortalAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && customer) return <Navigate to="/portal" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/portal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-ink-100">
      <header className="flex items-center justify-between border-b border-cyan-accent/30 px-8 py-4">
        <Logo size="sm" />
        <span className="text-sm text-ink-300">Client Portal</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-8 shadow-2xl shadow-black/40"
        >
          <Logo size="lg" stacked className="mb-6" />

          <h1 className="text-center text-2xl font-semibold text-ink-100">Client Portal</h1>
          <p className="mt-1 text-center text-sm text-ink-300">
            View your quotations, invoices, and job status
          </p>

          <div className="mt-8">
            <label htmlFor="email" className="text-xs font-semibold tracking-widest text-ink-300">
              EMAIL
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="mt-2 w-full border-b border-ink-600 bg-transparent pb-2 text-ink-100 placeholder-ink-500 outline-none focus:border-cyan-accent"
            />
          </div>

          <div className="mt-6">
            <label htmlFor="password" className="text-xs font-semibold tracking-widest text-ink-300">
              PASSWORD
            </label>
            <div className="mt-2 flex items-center border-b border-ink-600 focus-within:border-cyan-accent">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-transparent pb-2 text-ink-100 placeholder-ink-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="pb-2 text-ink-400 hover:text-ink-100"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 w-full rounded-md bg-cyan-accent py-3 font-semibold text-ink-950 transition hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

          <p className="mt-6 text-center text-xs text-ink-500">
            Don't have portal access yet? Contact your Technet Engineering representative.
          </p>
        </form>
      </main>

      <footer className="border-t border-ink-800 px-8 py-5 text-center text-xs text-ink-400">
        © 2026 Technet Engineering.
      </footer>
    </div>
  )
}

export default PortalLogin
