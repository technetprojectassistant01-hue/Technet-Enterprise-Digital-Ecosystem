import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Globe, Mail } from 'lucide-react'
import Logo from './components/Logo'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    // TODO: wire up to a real password-reset endpoint once email delivery is available.
    await new Promise((resolve) => setTimeout(resolve, 600))
    setSubmitting(false)
    setSent(true)
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

          {sent ? (
            <>
              <h1 className="text-center text-2xl font-semibold text-ink-100">Check Your Inbox</h1>
              <p className="mt-3 text-center text-sm text-ink-300">
                If an account exists for <span className="text-ink-100">{email}</span>, a secure
                recovery link is on its way.
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
              <h1 className="text-center text-2xl font-semibold text-ink-100">Reset Your Access</h1>
              <p className="mt-2 text-center text-sm text-ink-300">
                Enter your user identifier to receive a secure recovery token.
              </p>

              <form onSubmit={handleSubmit} className="mt-8">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold tracking-widest text-ink-300"
                >
                  USER IDENTIFIER
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-ink-600 bg-ink-950 px-3 py-2.5 focus-within:border-cyan-accent">
                  <Mail className="h-4 w-4 text-ink-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full bg-transparent text-ink-100 placeholder-ink-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 w-full rounded-md bg-cyan-accent py-3 text-sm font-semibold tracking-widest text-ink-950 transition hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'SENDING…' : 'SEND RECOVERY TOKEN'}
                </button>
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

export default ForgotPassword
