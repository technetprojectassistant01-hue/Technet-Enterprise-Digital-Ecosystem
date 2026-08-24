import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { usePortalAuth } from './PortalAuthContext'
import Logo from '../components/Logo'

const TABS = [
  { label: 'Quotations', to: '/portal/quotations' },
  { label: 'Invoices', to: '/portal/invoices' },
  { label: 'Jobs', to: '/portal/jobs' },
  { label: 'Request a Quote', to: '/portal/request-quote' },
]

function PortalLayout() {
  const { customer, logout } = usePortalAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/portal/login')
  }

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100">
      <header className="border-b border-ink-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Logo size="sm" />
            <span className="hidden text-sm text-ink-400 sm:inline">Client Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-ink-300">{customer?.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-md border border-ink-600 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-800 hover:text-ink-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto mt-4 flex max-w-5xl gap-2">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  isActive ? 'bg-cyan-accent/10 text-cyan-accent' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default PortalLayout
