import type { ReactNode } from 'react'
import { X, type LucideIcon } from 'lucide-react'

export function Panel({
  title,
  icon: Icon,
  action,
  className = '',
  children,
}: {
  title?: string
  icon?: LucideIcon
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={`rounded-xl border border-ink-700 bg-ink-900 p-6 ${className}`}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
            {Icon && <Icon className="h-4 w-4 text-ink-300" />}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  delta,
  deltaTone = 'positive',
  sub,
}: {
  label: string
  value: ReactNode
  delta?: string
  deltaTone?: 'positive' | 'warning'
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
      <span className="text-xs font-semibold tracking-widest text-ink-400">{label}</span>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-semibold text-ink-100">{value}</span>
        {delta && (
          <span
            className={`text-xs font-medium ${
              deltaTone === 'positive' ? 'text-cyan-accent' : 'text-amber-400'
            }`}
          >
            {delta}
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-400">{sub}</div>}
    </div>
  )
}

export function BarChart({
  data,
  highlight,
  height = 220,
}: {
  data: { label: string; value: number }[]
  highlight?: (label: string, index: number) => boolean
  height?: number
}) {
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div>
      <div className="flex items-end gap-3" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={d.label}
            className={`flex-1 rounded-t-sm ${
              highlight?.(d.label, i) ? 'bg-cyan-accent' : 'bg-ink-600'
            }`}
            style={{ height: `${(d.value / max) * 100}%` }}
            title={`${d.label}: ${d.value}`}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-3">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[10px] text-ink-400">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-ink-700 bg-ink-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-400 hover:text-ink-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-cyan-accent/20 font-semibold text-cyan-accent"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || '?'}
    </div>
  )
}
