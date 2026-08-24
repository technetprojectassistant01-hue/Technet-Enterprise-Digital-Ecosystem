import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import type { PortalCustomer } from '../lib/api'

interface PortalAuthContextValue {
  customer: PortalCustomer | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null)

/** Deliberately separate from AuthContext (staff) - a different cookie, a different backend
 * auth domain, and no shared state, so a customer session can never be confused with a staff one. */
export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<PortalCustomer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .portalFetchMe()
      .then(({ customer }) => setCustomer(customer))
      .catch(() => setCustomer(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const { customer } = await api.portalLogin(email, password)
    setCustomer(customer)
  }

  async function logout() {
    await api.portalLogout()
    setCustomer(null)
  }

  return (
    <PortalAuthContext.Provider value={{ customer, loading, login, logout }}>
      {children}
    </PortalAuthContext.Provider>
  )
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext)
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider')
  return ctx
}
