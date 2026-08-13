import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, HelpCircle, Plus, Search, Settings } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Logo from './components/Logo'
import { MAIN_NAV, SYSTEM_NAV, ADMIN_NAV } from './dashboard/nav'
import { Avatar } from './dashboard/ui'
import NavTree from './dashboard/NavTree'

function Dashboard() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const displayName = user?.name || user?.email || ''
  const systemNav = user?.role === 'ADMIN' ? [...SYSTEM_NAV, ADMIN_NAV] : SYSTEM_NAV
  const mainNav = MAIN_NAV.filter((item) => !user?.role || !item.hiddenFrom?.includes(user.role))

  return (
    <div className="flex min-h-screen bg-ink-950 text-ink-100">
      <aside className="flex w-64 shrink-0 flex-col border-r border-ink-800 px-4 py-6">
        <div className="px-2">
          <Logo size="sm" />
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-6">
          <div>
            <span className="px-2 text-[11px] font-semibold tracking-widest text-ink-500">
              MAIN MENU
            </span>
            <div className="mt-2">
              <NavTree items={mainNav} />
            </div>
          </div>

          <div>
            <span className="px-2 text-[11px] font-semibold tracking-widest text-ink-500">
              SYSTEM
            </span>
            <div className="mt-2 flex flex-col gap-1">
              {systemNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }: { isActive: boolean }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                      isActive
                        ? 'bg-cyan-accent/10 text-cyan-accent'
                        : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        <div className="mt-6 flex flex-col gap-3">
          <NavLink
            to="/dashboard/erp/projects"
            className="flex items-center justify-center gap-2 rounded-md bg-cyan-accent px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-cyan-accent-dark"
          >
            <Plus className="h-4 w-4" />
            New Project
          </NavLink>
          <a
            href="#"
            className="flex items-center gap-3 rounded-md px-3 py-1.5 text-sm text-ink-300 hover:text-ink-100"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            Support
          </a>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-ink-800 px-2 pt-4">
          <Avatar name={displayName} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink-100">{displayName}</div>
            <div className="text-xs text-ink-400">{user?.role}</div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="text-xs text-ink-400 hover:text-ink-100"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-ink-800 px-8 py-4">
          <div className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search orders, clients, invoices..."
              className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
            />
          </div>

          <div className="ml-auto flex items-center gap-5">
            <button type="button" className="text-ink-300 hover:text-ink-100" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </button>
            <NavLink to="/dashboard/settings" className="text-ink-300 hover:text-ink-100" aria-label="Settings">
              <Settings className="h-5 w-5" />
            </NavLink>
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <div className="text-sm font-medium text-ink-100">{displayName}</div>
                <div className="text-xs text-ink-400">{user?.role}</div>
              </div>
              <Avatar name={displayName} />
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-6">
          <div key={pathname} className="animate-fade-in">
            <Outlet />
          </div>
        </main>

        <footer className="flex flex-col gap-3 border-t border-ink-800 px-8 py-4 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Technet Engineering.</span>
          <div className="flex flex-wrap gap-5">
            <a href="#" className="hover:text-ink-200">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-ink-200">
              Terms of Service
            </a>
            <a href="#" className="hover:text-ink-200">
              Contact Support
            </a>
            <a href="#" className="hover:text-ink-200">
              Security Audit
            </a>
          </div>
          <span className="flex items-center gap-2 text-ink-300">
            SYSTEM STABLE:
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-accent" />
          </span>
        </footer>
      </div>
    </div>
  )
}

export default Dashboard
