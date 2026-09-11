import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Phone, Search } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Logo from './components/Logo'
import LanguageSwitcher from './dashboard/LanguageSwitcher'
import { useT, type Dict } from './i18n'

/**
 * Help Center. The same content is served two ways: inside the app shell at /dashboard/help (so a
 * signed-in user keeps their navigation) and as a standalone public page at /help (linked from
 * the sign-in pages, for someone who can't get in at all). It's static, so it also opens offline.
 *
 * The questions and answers live in the i18n dictionaries (help.sections in en/fr/mfe). Every
 * answer describes how the app actually behaves today — if a feature changes, update them too.
 */

export const SUPPORT_PHONE_DISPLAY = '5885 1000'
const SUPPORT_PHONE_TEL = 'tel:+23058851000'

type Faq = Dict['help']['sections'][number]['faqs'][number]

function FaqItem({ faq }: { faq: Faq }) {
  return (
    <details className="group border-b border-ink-800 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-ink-100 hover:text-cyan-accent [&::-webkit-details-marker]:hidden">
        {faq.q}
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-400 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-2 pb-4 text-sm leading-relaxed text-ink-300">
        {faq.a.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </details>
  )
}

function ContactCard() {
  const t = useT()
  return (
    <div
      id="contact"
      className="scroll-mt-6 flex flex-col gap-4 rounded-xl border border-cyan-accent/30 bg-cyan-accent/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div>
        <h2 className="text-base font-semibold text-ink-100">{t.help.contactTitle}</h2>
        <p className="mt-1 text-sm text-ink-300">{t.help.contactBody}</p>
      </div>
      <a
        href={SUPPORT_PHONE_TEL}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-cyan-accent px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-cyan-accent-dark active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-accent"
      >
        <Phone className="h-4 w-4" />
        {SUPPORT_PHONE_DISPLAY}
      </a>
    </div>
  )
}

export function HelpCenterContent() {
  const t = useT()
  const { hash } = useLocation()
  const [query, setQuery] = useState('')

  // "Contact Support" links point at #contact; the router doesn't scroll to hashes by itself.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])

  const sections = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return t.help.sections
    return t.help.sections
      .map((section) => ({
        ...section,
        faqs: section.faqs.filter((faq) => {
          const text = `${section.title} ${faq.q} ${faq.a.join(' ')}`.toLowerCase()
          return words.every((word) => text.includes(word))
        }),
      }))
      .filter((section) => section.faqs.length > 0)
  }, [query, t])

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-ink-100">{t.help.title}</h1>
      <p className="mt-1 text-sm text-ink-400">{t.help.subtitle}</p>

      <div className="mt-6">
        <ContactCard />
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 focus-within:border-cyan-accent">
        <Search className="h-4 w-4 shrink-0 text-ink-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.help.searchPlaceholder}
          aria-label={t.help.searchLabel}
          className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
        />
      </div>

      <div className="mt-6 space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-1 text-[11px] font-semibold tracking-widest text-ink-500">
              {section.title.toUpperCase()}
            </h2>
            <div className="rounded-xl border border-ink-800 bg-ink-900 px-4 shadow-sm shadow-black/20 sm:px-5">
              {section.faqs.map((faq) => (
                <FaqItem key={faq.q} faq={faq} />
              ))}
            </div>
          </section>
        ))}

        {sections.length === 0 && (
          <p className="rounded-xl border border-ink-800 bg-ink-900 p-6 text-center text-sm text-ink-300">
            {t.help.noMatchBefore(query)}
            <a href={SUPPORT_PHONE_TEL} className="font-semibold text-cyan-accent hover:underline">
              {SUPPORT_PHONE_DISPLAY}
            </a>
            {t.help.noMatchAfter}
          </p>
        )}
      </div>
    </div>
  )
}

/** Standalone public version, for the sign-in pages' "Help Center" / "Contact Support" links. */
function HelpCenterPage() {
  const { user } = useAuth()
  const t = useT()

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
        <HelpCenterContent />
      </main>

      <footer className="border-t border-ink-800 px-4 py-5 text-xs text-ink-400 sm:px-8">{t.shell.copyright}</footer>
    </div>
  )
}

export default HelpCenterPage
