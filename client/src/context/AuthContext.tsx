import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import type { CurrentUser, Language } from '../lib/api'
import { clearOfflineCaches } from '../lib/offlineCache'
import { isLanguage, useLanguage } from '../i18n'

interface AuthContextValue {
  user: CurrentUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Switches the UI language; also saves it to the account when someone is signed in. */
  changeLanguage: (language: Language) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Set when someone picks a language while signed out; kept in storage so a reload before signing in still counts. */
const PICKED_KEY = 'technet-language-picked'

function readPickedWhileSignedOut(): boolean {
  try {
    return localStorage.getItem(PICKED_KEY) === '1'
  } catch {
    return false
  }
}

function setPickedWhileSignedOut(picked: boolean) {
  try {
    if (picked) localStorage.setItem(PICKED_KEY, '1')
    else localStorage.removeItem(PICKED_KEY)
  } catch {
    // Blocked storage: the account's language will apply on sign-in, as before.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const { language, setLanguage } = useLanguage()
  const languageRef = useRef(language)
  languageRef.current = language

  /**
   * On sign-in: a language picked on this device while signed out (e.g. on the sign-in page) is
   * the person's latest choice, so it wins and is saved to the account. Otherwise the account's
   * saved language is applied — that's what makes the choice follow them to a new device. If the
   * account has never had one, this device's language is saved to it.
   */
  function adoptLanguage(signedIn: CurrentUser) {
    if (readPickedWhileSignedOut()) {
      setPickedWhileSignedOut(false)
      if (signedIn.language !== languageRef.current) {
        api.updateMyLanguage(languageRef.current).catch(() => {})
      }
    } else if (isLanguage(signedIn.language)) {
      setLanguage(signedIn.language)
    } else if (languageRef.current !== 'en') {
      api.updateMyLanguage(languageRef.current).catch(() => {})
    }
  }

  useEffect(() => {
    // Technet Connect (/portal/*) is a separate auth domain (its own cookie, see PortalAuthContext)
    // and never has a staff session - skip the staff /api/auth/me check there entirely.
    if (window.location.pathname.startsWith('/portal')) {
      setLoading(false)
      return
    }
    api
      .fetchMe()
      .then(({ user }) => {
        setUser(user)
        adoptLanguage(user)
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(email: string, password: string) {
    const { user } = await api.login(email, password)
    setUser(user)
    adoptLanguage(user)
  }

  async function logout() {
    await api.logout()
    await clearOfflineCaches()
    setUser(null)
  }

  function changeLanguage(next: Language) {
    setLanguage(next)
    setPickedWhileSignedOut(!user)
    if (user) {
      setUser({ ...user, language: next })
      // Best effort: offline, the change still applies on this device.
      api.updateMyLanguage(next).catch(() => {})
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changeLanguage }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
