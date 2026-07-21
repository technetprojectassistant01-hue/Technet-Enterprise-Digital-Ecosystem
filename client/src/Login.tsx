import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Globe } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Logo from './components/Logo'

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard')
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
              'radial-gradient(circle at 20% 20%, rgba(63,217,240,0.08), transparent 40%), radial-gradient(circle at 80% 70%, rgba(63,217,240,0.08), transparent 45%)',
          }}
        />

        <form
          onSubmit={handleSubmit}
          className="relative w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-8 shadow-2xl shadow-black/40"
        >
          <Logo size="lg" stacked className="mb-6" />

          <h1 className="text-center text-2xl font-semibold text-ink-100">Welcome Back</h1>
          <p className="mt-1 text-center text-sm text-ink-300">
            Secure access to your engineering portal
          </p>

          <div className="mt-8">
            <label
              htmlFor="email"
              className="text-xs font-semibold tracking-widest text-ink-300"
            >
              USER IDENTIFIER
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="mt-2 w-full border-b border-ink-600 bg-transparent pb-2 text-ink-100 placeholder-ink-500 outline-none focus:border-cyan-accent"
            />
          </div>

          <div className="mt-6">
            <label
              htmlFor="password"
              className="text-xs font-semibold tracking-widest text-ink-300"
            >
              ACCESS TOKEN
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

          <div className="mt-5 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-ink-300">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-ink-500 accent-cyan-accent"
              />
              Remember session
            </label>
            <Link to="/forgot-password" className="text-cyan-accent hover:underline">
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-md bg-cyan-accent py-3 font-semibold text-ink-950 transition hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

          <div className="mt-6 flex justify-center">
            <span className="flex items-center gap-2 text-[11px] tracking-wide text-ink-400">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-accent" />
              ALL CORE SYSTEMS OPERATIONAL
            </span>
          </div>
        </form>
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

export default Login
