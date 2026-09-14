import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Logo from './components/Logo'
import { InstallAppPrompt } from './dashboard/InstallAppDialog'
import { Modal } from './dashboard/ui'
import LanguageSwitcher from './dashboard/LanguageSwitcher'
import { useT } from './i18n'

/** Boxed field with room for the leading icon; the right padding is set per field. */
const inputBoxClass =
  'h-12 w-full rounded-lg border border-ink-600 bg-ink-950/70 pl-11 text-sm text-ink-100 placeholder-ink-500 shadow-inner shadow-black/20 outline-none transition hover:border-ink-500 focus:border-cyan-accent focus:bg-ink-950 focus:ring-4 focus:ring-cyan-accent/15'

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
  const [showForgot, setShowForgot] = useState(false)

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

          <div className="mt-8">
            <label
              htmlFor="email"
              className="text-xs font-semibold tracking-widest text-ink-300"
            >
              {t.auth.userIdentifier}
            </label>
            <div className="group relative mt-2">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition group-focus-within:text-cyan-accent" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.emailPlaceholder}
                required
                className={`${inputBoxClass} pr-3.5`}
              />
            </div>
          </div>

          <div className="mt-6">
            <label
              htmlFor="password"
              className="text-xs font-semibold tracking-widest text-ink-300"
            >
              {t.auth.accessToken}
            </label>
            <div className="group relative mt-2">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition group-focus-within:text-cyan-accent" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={`${inputBoxClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-accent"
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
            {/* Staff logins are created and reset by an admin, so this opens a dialog telling them
                to ask one. Nobody is signed in yet, so the page can't know who is an admin — the
                dialog offers them the email route rather than the app guessing. */}
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-cyan-accent hover:underline"
            >
              {t.auth.forgotPassword}
            </button>
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
          <Link to="/privacy" className="hover:text-ink-200">
            {t.auth.privacyPolicy}
          </Link>
          <Link to="/terms" className="hover:text-ink-200">
            {t.auth.termsOfService}
          </Link>
          <Link to="/security" className="hover:text-ink-200">
            {t.auth.securityAudit}
          </Link>
          <Link to="/help#contact" className="hover:text-ink-200">
            {t.auth.contactSupport}
          </Link>
        </div>
      </footer>

      {showForgot && (
        <Modal title={t.auth.forgotPassword} onClose={() => setShowForgot(false)}>
          <p className="text-sm text-ink-200">{t.auth.contactAdminBody}</p>
          <button
            type="button"
            onClick={() => setShowForgot(false)}
            className="mt-6 w-full rounded-md bg-cyan-accent py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-cyan-accent-dark"
          >
            {t.common.close}
          </button>
          <Link
            to="/forgot-password"
            className="mt-4 block text-center text-xs text-ink-500 hover:text-cyan-accent"
          >
            {t.auth.adminResetLink}
          </Link>
        </Modal>
      )}
    </div>
  )
}

export default Login
