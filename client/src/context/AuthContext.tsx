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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const { language, setLanguage } = useLanguage()
  const languageRef = useRef(language)
  languageRef.current = language

  /**
   * On sign-in: the account's saved language wins. If the account has never had one, the
   * choice already made on this device (e.g. on the sign-in page) is saved to it instead.
   */
  function adoptLanguage(signedIn: CurrentUser) {
    if (isLanguage(signedIn.language)) {
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
