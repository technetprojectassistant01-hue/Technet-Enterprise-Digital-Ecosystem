import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Logo from './components/Logo'
import LanguageSwitcher from './dashboard/LanguageSwitcher'
import { SUPPORT_PHONE_DISPLAY } from './HelpCenterPage'
import { useT } from './i18n'

/**
 * Privacy Policy, Terms of Service and Security. Like the Help Center, each is served inside the
 * app shell (/dashboard/privacy, /dashboard/terms) and as a public page (/privacy, /terms,
 * /security) for the sign-in pages' footer links. The text lives in the i18n dictionaries
 * (legal.*) and must describe how the app really behaves.
 */

export type LegalDoc = 'privacy' | 'terms' | 'security'

export function LegalContent({ doc }: { doc: LegalDoc }) {
  const t = useT()
  const page = t.legal[doc]

  // Moving between these pages from a footer link would otherwise keep the old scroll position.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [doc])

  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-ink-100">{page.title}</h1>
      <p className="mt-1 text-xs text-ink-400">{t.legal.lastUpdated}</p>
      <p className="mt-4 text-sm leading-relaxed text-ink-300">{page.intro}</p>

      <div className="mt-6 space-y-4">
        {page.sections.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-ink-800 bg-ink-900 p-4 shadow-sm shadow-black/20 sm:p-5"
          >
            <h2 className="text-base font-semibold text-ink-100">{section.title}</h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-300">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6 text-sm text-ink-400">
        {t.legal.questionsBefore}
        <a href="tel:+23058851000" className="font-semibold text-cyan-accent hover:underline">
          {SUPPORT_PHONE_DISPLAY}
        </a>
        {t.legal.questionsAfter}
      </p>
    </article>
  )
}

/** Standalone public version, for the sign-in pages' footer links. */
function LegalPage({ doc }: { doc: LegalDoc }) {
  const { user } = useAuth()
  const t = useT()

  const links: { to: string; label: string }[] = [
    { to: '/privacy', label: t.auth.privacyPolicy },
    { to: '/terms', label: t.auth.termsOfService },
    { to: '/security', label: t.legal.security.title },
    { to: '/help', label: t.auth.helpCenter },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-ink-100">
      <header className="flex items-center justify-between gap-4 border-b border-cyan-accent/30 px-4 py-4 sm:px-8">
        <Logo size="sm" />
        <div className="flex items-center gap-4 text-sm text-ink-200 sm:gap-6">
          <Link to={user ? '/dashboard' : '/login'} className="flex items-center gap-1.5 hover:text-ink-100">
            <ArrowLeft className="h-4 w-4" />
            {user ? t.help.backToApp : t.help.backToSignIn}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-8">
        <LegalContent doc={doc} />
      </main>

      <footer className="flex flex-col gap-3 border-t border-ink-800 px-4 py-5 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>{t.shell.copyright}</span>
        <div className="flex flex-wrap gap-5">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-ink-200">
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  )
}

export default LegalPage
