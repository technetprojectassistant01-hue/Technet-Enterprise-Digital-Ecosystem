import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { NavItem } from './nav'

function NavNode({ item, depth }: { item: NavItem; depth: number }) {
  const { pathname } = useLocation()
  const hasChildren = !!item.children?.length
  const [open, setOpen] = useState(() => hasChildren && pathname.startsWith(item.to))

  return (
    <div>
      <div className="flex items-center">
        <NavLink
          to={item.to}
          end={item.end}
          style={{ paddingLeft: 12 + depth * 16 }}
          className={({ isActive }: { isActive: boolean }) =>
            `relative flex flex-1 items-center gap-3 rounded-md py-2 pr-3 text-sm transition-colors duration-150 ${
              isActive
                ? 'bg-cyan-accent/10 font-medium text-cyan-accent before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-cyan-accent'
                : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
            }`
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </NavLink>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
            className="mr-1 shrink-0 rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {hasChildren && (
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-1 pt-1">
              {item.children!.map((child) => (
                <NavNode key={child.to} item={child} depth={depth + 1} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NavTree({ items }: { items: NavItem[] }) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <NavNode key={item.to} item={item} depth={0} />
      ))}
    </div>
  )
}

export default NavTree
