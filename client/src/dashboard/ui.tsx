import { useEffect, useState, type ReactNode } from 'react'
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
      className={`animate-fade-in-up rounded-xl border border-ink-700 bg-ink-900 p-6 transition-colors duration-150 hover:border-ink-600 ${className}`}
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
    <div className="animate-fade-in-up rounded-xl border border-ink-700 bg-ink-900 p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-ink-600 hover:shadow-lg hover:shadow-black/20">
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
  const [grown, setGrown] = useState(false)

  useEffect(() => {
    setGrown(false)
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [data])

  return (
    <div>
      <div className="flex items-end gap-3" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t-sm transition-[height] duration-500 ease-out ${
              highlight?.(d.label, i) ? 'bg-cyan-accent' : 'bg-ink-600'
            }`}
            style={{
              height: grown ? `${(d.value / max) * 100}%` : '0%',
              transitionDelay: `${i * 30}ms`,
            }}
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
  size = 'md',
  children,
}: {
  title: string
  onClose: () => void
  size?: 'md' | 'lg'
  children: ReactNode
}) {
  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className={`animate-scale-in flex max-h-[90vh] w-full flex-col rounded-xl border border-ink-700 bg-ink-900 p-6 shadow-2xl ${
          size === 'lg' ? 'max-w-3xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
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
        <div className="-mr-2 overflow-y-auto pr-2">{children}</div>
      </div>
    </div>
  )
}

export type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'success'

const badgeToneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-ink-700 text-ink-300',
  accent: 'bg-cyan-accent/10 text-cyan-accent',
  warning: 'bg-amber-400/10 text-amber-400',
  danger: 'bg-red-400/10 text-red-400',
  success: 'bg-emerald-400/10 text-emerald-400',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded px-2 py-1 text-xs font-medium ${badgeToneClasses[tone]}`}
    >
      {children}
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: LucideIcon
  message: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-800 text-ink-500">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm text-ink-400">{message}</p>
      {action}
    </div>
  )
}

export function TableSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <span
              key={c}
              className="h-4 flex-1 rounded bg-[linear-gradient(90deg,var(--color-ink-800)_25%,var(--color-ink-700)_50%,var(--color-ink-800)_75%)] bg-[length:200%_100%] animate-shimmer"
              style={{ animationDelay: `${r * 60}ms` }}
            />
          ))}
        </div>
      ))}
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
