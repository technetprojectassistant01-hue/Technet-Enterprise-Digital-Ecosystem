import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import Logo from './components/Logo'
import LanguageSwitcher from './dashboard/LanguageSwitcher'
import { forgotPassword } from './lib/api'
import { useT } from './i18n'

function ForgotPassword() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.somethingWentWrong)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-ink-100">
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
              'radial-gradient(circle at 15% 30%, rgba(63,217,240,0.08), transparent 40%), radial-gradient(circle at 85% 65%, rgba(63,217,240,0.08), transparent 45%)',
          }}
        />

        <div className="relative w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-8 shadow-2xl shadow-black/40">
          <Logo size="lg" stacked className="mb-6" />

          {sent ? (
            <>
              <h1 className="text-center text-2xl font-semibold text-ink-100">{t.auth.checkInbox}</h1>
              <p className="mt-3 text-center text-sm text-ink-300">
                {t.auth.ifAccountExistsBefore}
                <span className="text-ink-100">{email}</span>
                {t.auth.ifAccountExistsAfter}
              </p>
              <Link
                to="/login"
                className="mt-8 flex items-center justify-center gap-2 text-sm text-cyan-accent hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                {t.auth.backToSignIn}
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-center text-2xl font-semibold text-ink-100">{t.auth.resetYourAccess}</h1>
              <p className="mt-2 text-center text-sm text-ink-300">{t.auth.resetSubtitle}</p>

              <form onSubmit={handleSubmit} className="mt-8">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold tracking-widest text-ink-300"
                >
                  {t.auth.userIdentifier}
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-ink-600 bg-ink-950 px-3 py-2.5 focus-within:border-cyan-accent">
                  <Mail className="h-4 w-4 text-ink-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.auth.emailPlaceholder}
                    required
                    className="w-full bg-transparent text-ink-100 placeholder-ink-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 w-full rounded-md bg-cyan-accent py-3 text-sm font-semibold tracking-widest text-ink-950 transition hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? t.auth.sending : t.auth.sendRecovery}
                </button>

                {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
              </form>

              <Link
                to="/login"
                className="mt-6 flex items-center justify-center gap-2 text-sm text-cyan-accent hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                {t.auth.backToSignIn}
              </Link>
            </>
          )}

          <div className="mt-8 flex justify-center">
            <span className="flex items-center gap-2 rounded-full border border-ink-700 px-4 py-1.5 text-[11px] tracking-wide text-ink-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-accent" />
              {t.auth.systemsOperational}
            </span>
          </div>
        </div>
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

export default ForgotPassword
