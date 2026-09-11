import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Logo from './components/Logo'
import { InstallAppPrompt } from './dashboard/InstallAppDialog'
import LanguageSwitcher from './dashboard/LanguageSwitcher'
import { useT } from './i18n'

function Login() {
  const { login } = useAuth()
  const t = useT()
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
      setError(err instanceof Error ? err.message : t.auth.loginFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-ink-100">
      <InstallAppPrompt appName="Technet Digital" />
      <header className="flex items-center justify-between gap-4 border-b border-cyan-accent/30 px-4 py-4 sm:px-8">
        <Logo size="sm" />
        <div className="flex items-center gap-4 text-sm text-ink-200 sm:gap-6">
          <Link to="/help" className="hover:text-ink-100">
            {t.auth.helpCenter}
          </Link>
          <LanguageSwitcher />
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

          <h1 className="text-center text-2xl font-semibold text-ink-100">{t.auth.welcomeBack}</h1>
          <p className="mt-1 text-center text-sm text-ink-300">{t.auth.loginSubtitle}</p>

          <div className="mt-8">
            <label
              htmlFor="email"
              className="text-xs font-semibold tracking-widest text-ink-300"
            >
              {t.auth.userIdentifier}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              required
              className="mt-2 w-full border-b border-ink-600 bg-transparent pb-2 text-ink-100 placeholder-ink-500 outline-none focus:border-cyan-accent"
            />
          </div>

          <div className="mt-6">
            <label
              htmlFor="password"
              className="text-xs font-semibold tracking-widest text-ink-300"
            >
              {t.auth.accessToken}
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
                aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2 text-ink-300">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-ink-500 accent-cyan-accent"
              />
              {t.auth.rememberSession}
            </label>
            <Link to="/forgot-password" className="text-cyan-accent hover:underline">
              {t.auth.forgotPassword}
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-md bg-cyan-accent py-3 font-semibold text-ink-950 transition hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? t.auth.signingIn : t.auth.signIn}
          </button>

          {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

          <div className="mt-6 flex justify-center">
            <span className="flex items-center gap-2 text-[11px] tracking-wide text-ink-400">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-accent" />
              {t.auth.systemsOperational}
            </span>
          </div>
        </form>
      </main>

      <footer className="flex flex-col gap-3 border-t border-ink-800 px-8 py-5 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
        <span>{t.auth.copyright}</span>
        <div className="flex flex-wrap gap-5">
          <a href="#" className="hover:text-ink-200">
            {t.auth.privacyPolicy}
          </a>
          <a href="#" className="hover:text-ink-200">
            {t.auth.termsOfService}
          </a>
          <a href="#" className="hover:text-ink-200">
            {t.auth.securityAudit}
          </a>
          <Link to="/help#contact" className="hover:text-ink-200">
            {t.auth.contactSupport}
          </Link>
        </div>
      </footer>
    </div>
  )
}

export default Login
