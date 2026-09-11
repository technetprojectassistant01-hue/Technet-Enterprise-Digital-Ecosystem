import { NavLink } from 'react-router-dom'
import { LayoutList } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { MAIN_NAV } from './nav'
import { navLabel, useT } from '../i18n'

/**
 * The quick-nav strip (Option D from the design mockups): a horizontally scrollable row of the
 * top-level sections for one-tap access, plus an "All" button that opens the full navigation
 * drawer. Shown below `lg` — phone and tablet, where the permanent sidebar is gone.
 */
function MobileNav({ onOpenAll }: { onOpenAll: () => void }) {
  const { user } = useAuth()
  const t = useT()
  const items = MAIN_NAV.filter((item) => !user?.role || !item.hiddenFrom?.includes(user.role))

  return (
    <div className="flex items-stretch gap-1 border-b border-ink-800 bg-ink-900 px-2 py-1.5 lg:hidden">
      <div className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }: { isActive: boolean }) =>
              `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? 'bg-cyan-accent/15 text-cyan-accent'
                  : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
              }`
            }
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            {navLabel(t, item.label).replace('Technet ', '')}
          </NavLink>
        ))}
      </div>
      <button
        type="button"
        onClick={onOpenAll}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-200 hover:bg-ink-800"
      >
        <LayoutList className="h-3.5 w-3.5" />
        {t.shell.all}
      </button>
    </div>
  )
}

export default MobileNav
