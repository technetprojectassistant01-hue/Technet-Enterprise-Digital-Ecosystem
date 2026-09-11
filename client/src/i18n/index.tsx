import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Language } from '../lib/api'
import { en, type Dict } from './en'
import { fr } from './fr'
import { mfe } from './mfe'

/**
 * App translations: English (master), French, Mauritian Creole. No library — each language is a
 * typed object (see en.ts), and components read it with `const t = useT()`, then `t.auth.signIn`.
 *
 * The choice lives in two places: this device (localStorage — so the sign-in page is already in
 * the right language) and the user's account (User.language — so it follows them to any device).
 * AuthContext reconciles the two on sign-in and saves changes made from the switcher.
 */

export type { Dict, Language }

/** Kept in sync with SUPPORTED_LANGUAGES in server/src/routes/auth.ts. */
export const LANGUAGES: { code: Language; name: string; short: string }[] = [
  { code: 'en', name: 'English', short: 'English' },
  { code: 'fr', name: 'Français', short: 'Français' },
  { code: 'mfe', name: 'Kreol Morisien', short: 'Kreol' },
]

const DICTIONARIES: Record<Language, Dict> = { en, fr, mfe }
const STORAGE_KEY = 'technet-language'

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'fr' || value === 'mfe'
}

function readDeviceLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    // Blocked storage (private mode): fall back to English.
  }
  return 'en'
}

let currentLanguage: Language = readDeviceLanguage()

/** For code that runs outside a component (lib helpers building user-facing text). */
export function getT(): Dict {
  return DICTIONARIES[currentLanguage]
}

/** Nav items are keyed by their English label (dashboard/nav.ts). */
export function navLabel(t: Dict, label: string): string {
  return (t.nav as Record<string, string>)[label] ?? label
}

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: Dict
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    document.documentElement.lang = currentLanguage
    return currentLanguage
  })

  const setLanguage = useCallback((next: Language) => {
    currentLanguage = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Still applies for this visit.
    }
    document.documentElement.lang = next
    setLanguageState(next)
  }, [])

  const value = useMemo(() => ({ language, setLanguage, t: DICTIONARIES[language] }), [language, setLanguage])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

export function useT(): Dict {
  return useLanguage().t
}
