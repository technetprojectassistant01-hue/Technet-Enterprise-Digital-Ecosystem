import { NavLink } from 'react-router-dom'
import { HelpCircle, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import { MAIN_NAV, SYSTEM_NAV, ADMIN_NAV } from './nav'
import { Avatar } from './ui'
import NavTree from './NavTree'
import { navLabel, useT } from '../i18n'

/**
 * The navigation column shared by the always-on desktop sidebar and the slide-in drawer used at
 * tablet/phone width (see Dashboard.tsx). Same content in both places, so it lives here once.
 */
function SidebarContent() {
  const { user, logout } = useAuth()
  const t = useT()
  const displayName = user?.name || user?.email || ''
  const systemNav = user?.role === 'ADMIN' ? [...SYSTEM_NAV, ADMIN_NAV] : SYSTEM_NAV
  const mainNav = MAIN_NAV.filter((item) => !user?.role || !item.hiddenFrom?.includes(user.role))

  return (
    <div className="flex w-full flex-col px-4 py-6">
      <div className="px-2">
        <Logo size="sm" />
      </div>

      <nav className="mt-8 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
        <div>
          <span className="px-2 text-[11px] font-semibold tracking-widest text-ink-500">{t.shell.mainMenu}</span>
          <div className="mt-2">
            <NavTree items={mainNav} />
          </div>
        </div>

        <div>
          <span className="px-2 text-[11px] font-semibold tracking-widest text-ink-500">{t.shell.system}</span>
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
                {navLabel(t, item.label)}
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
          {t.shell.newProject}
        </NavLink>
        <NavLink
          to="/dashboard/help"
          className={({ isActive }: { isActive: boolean }) =>
            `flex items-center gap-3 rounded-md px-3 py-1.5 text-sm ${
              isActive ? 'text-cyan-accent' : 'text-ink-300 hover:text-ink-100'
            }`
          }
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          {t.shell.helpCenter}
        </NavLink>
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-ink-800 px-2 pt-4">
        <Avatar name={displayName} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink-100">{displayName}</div>
          <div className="text-xs text-ink-400">{user ? t.roles[user.role] : ''}</div>
        </div>
        <button type="button" onClick={() => logout()} className="text-xs text-ink-400 hover:text-ink-100">
          {t.shell.logOut}
        </button>
      </div>
    </div>
  )
}

export default SidebarContent
