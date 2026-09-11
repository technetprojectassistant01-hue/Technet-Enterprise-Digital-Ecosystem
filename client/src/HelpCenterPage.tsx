import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Phone, Search } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Logo from './components/Logo'

/**
 * Help Center. The same content is served two ways: inside the app shell at /dashboard/help (so a
 * signed-in user keeps their navigation) and as a standalone public page at /help (linked from
 * the sign-in pages, for someone who can't get in at all). It's static, so it also opens offline.
 *
 * Every answer describes how the app actually behaves today — if a feature changes, update the
 * matching answer here too.
 */

export const SUPPORT_PHONE_DISPLAY = '5885 1000'
const SUPPORT_PHONE_TEL = 'tel:+23058851000'

interface Faq {
  q: string
  a: string[]
}

const SECTIONS: { title: string; faqs: Faq[] }[] = [
  {
    title: 'Signing in',
    faqs: [
      {
        q: 'I forgot my password',
        a: [
          'On the sign-in page, tap "Forgot Password?" and enter your email address. You\'ll receive an email with a link to set a new password.',
          `If the email doesn't arrive after a few minutes (check your spam folder too), call support on ${SUPPORT_PHONE_DISPLAY}.`,
        ],
      },
      {
        q: 'How long do I stay signed in?',
        a: [
          'You stay signed in for 30 days, and the 30 days restart every time you use the app — so if you use it regularly you won\'t be asked to sign in again. Tapping "Log out" signs you out straight away.',
        ],
      },
      {
        q: 'How do I change my password?',
        a: ['Tap the gear icon at the top right to open Settings, then use the "Change password" box.'],
      },
    ],
  },
  {
    title: 'Installing the app',
    faqs: [
      {
        q: 'How do I install the app on my phone?',
        a: [
          'Android (Chrome or Samsung Internet): tap "Install now" when the install pop-up appears, then confirm. The Technet icon is added to your home screen.',
          'iPhone or iPad: open the site in Safari, tap the Share button, then "Add to Home Screen", then "Add". (On newer iPhones, Share is inside the ⋯ button at the bottom right.)',
          'Computer (Chrome or Edge): tap "Install now" on the pop-up.',
        ],
      },
      {
        q: 'I tapped "Not now" on the install pop-up',
        a: ['You can still install it any time from Settings (gear icon, top right) → "Install app".'],
      },
    ],
  },
  {
    title: 'Attendance',
    faqs: [
      {
        q: 'How do I check in and check out?',
        a: [
          'Use the "My Attendance" card on the Overview page. Check the arrival time (it\'s filled in for you), type where you are, enter your transport cost (enter 0 if you had none), then tap "Check In".',
          'When you leave, do the same with "Check Out". You can check in and out several times a day if you visit more than one site.',
        ],
      },
      {
        q: 'Why does the app ask for my location?',
        a: [
          'Each check-in and check-out records your location along with the time, and your managers can see it. Check-in can\'t work without it.',
          'If you declined the location request by mistake, allow location for this site in your phone or browser settings, then try again.',
        ],
      },
      {
        q: 'I don\'t see the "My Attendance" card',
        a: ['Your login needs to be linked to your employee record. Contact HR and ask them to link your account.'],
      },
      {
        q: 'Can the app remind me to check in?',
        a: [
          'Yes. Tap "Remind me" on the "My Attendance" card and allow notifications. On weekdays you\'ll get a reminder at 8:15 if you haven\'t checked in yet.',
          'On an iPhone, install the app to your home screen first — iPhones only allow reminders from installed apps.',
        ],
      },
    ],
  },
  {
    title: 'Working without signal',
    faqs: [
      {
        q: 'What happens if I lose signal while submitting something?',
        a: [
          'Check-ins, check-outs, daily reports, maintenance reports and intervention reports are saved on your phone and uploaded automatically as soon as the signal comes back. There\'s no need to submit them again.',
          'While something is waiting, the top bar shows "waiting to sync". Tap it and then "Try now" to retry straight away.',
          'On an iPhone, saved items upload the next time you open the app with signal.',
        ],
      },
      {
        q: 'Can I see my jobs without signal?',
        a: [
          'Yes — your work orders, schedule and reports show the last version your phone loaded while it had signal. Open them once while connected so they\'re saved on your phone.',
        ],
      },
    ],
  },
  {
    title: 'Leave',
    faqs: [
      {
        q: 'How do I request leave?',
        a: [
          'Open "My Leave" from the menu and tap "Request Leave". HR reviews the request and you\'ll get a notification when it\'s approved or rejected.',
          'While a request is still pending you can withdraw it from the same page.',
        ],
      },
    ],
  },
  {
    title: 'Access',
    faqs: [
      {
        q: 'I can\'t see a page or module I need',
        a: [
          'What you can see depends on your role. If you need access to something, ask your manager or the system administrator.',
        ],
      },
    ],
  },
]

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
  return (
    <div
      id="contact"
      className="scroll-mt-6 flex flex-col gap-4 rounded-xl border border-cyan-accent/30 bg-cyan-accent/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div>
        <h2 className="text-base font-semibold text-ink-100">Having an issue? Call us.</h2>
        <p className="mt-1 text-sm text-ink-300">
          Tell us what you were doing, which page you were on, and any error message you saw.
        </p>
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
  const { hash } = useLocation()
  const [query, setQuery] = useState('')

  // "Contact Support" links point at #contact; the router doesn't scroll to hashes by itself.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])

  const sections = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return SECTIONS
    return SECTIONS.map((section) => ({
      ...section,
      faqs: section.faqs.filter((faq) => {
        const text = `${section.title} ${faq.q} ${faq.a.join(' ')}`.toLowerCase()
        return words.every((word) => text.includes(word))
      }),
    })).filter((section) => section.faqs.length > 0)
  }, [query])

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-ink-100">Help Center</h1>
      <p className="mt-1 text-sm text-ink-400">Answers to common questions about Technet Digital.</p>

      <div className="mt-6">
        <ContactCard />
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 focus-within:border-cyan-accent">
        <Search className="h-4 w-4 shrink-0 text-ink-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help — e.g. password, check in, leave"
          aria-label="Search help"
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
            No answers match "{query}". Call support on{' '}
            <a href={SUPPORT_PHONE_TEL} className="font-semibold text-cyan-accent hover:underline">
              {SUPPORT_PHONE_DISPLAY}
            </a>{' '}
            and we'll help.
          </p>
        )}
      </div>
    </div>
  )
}

/** Standalone public version, for the sign-in pages' "Help Center" / "Contact Support" links. */
function HelpCenterPage() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-ink-100">
      <header className="flex items-center justify-between gap-4 border-b border-cyan-accent/30 px-4 py-4 sm:px-8">
        <Logo size="sm" />
        <Link
          to={user ? '/dashboard' : '/login'}
          className="flex items-center gap-1.5 text-sm text-ink-200 hover:text-ink-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {user ? 'Back to app' : 'Back to sign in'}
        </Link>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-8">
        <HelpCenterContent />
      </main>

      <footer className="border-t border-ink-800 px-4 py-5 text-xs text-ink-400 sm:px-8">
        © 2026 Technet Engineering.
      </footer>
    </div>
  )
}

export default HelpCenterPage
