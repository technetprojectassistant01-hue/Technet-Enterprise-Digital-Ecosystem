import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  tone?: 'danger' | 'default'
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setPending({ ...options, resolve })
    })
  }, [])

  function settle(value: boolean) {
    resolver.current?.(value)
    resolver.current = null
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="animate-backdrop-in fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
          onClick={() => settle(false)}
        >
          <div
            className="animate-scale-in w-full max-w-sm rounded-xl border border-ink-700 bg-ink-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  pending.tone === 'danger' ? 'bg-red-400/15 text-red-400' : 'bg-cyan-accent/15 text-cyan-accent'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink-100">{pending.title || 'Are you sure?'}</h2>
                <p className="mt-1 text-sm text-ink-300">{pending.message}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => settle(false)}
                className="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-200 hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  pending.tone === 'danger'
                    ? 'bg-red-400 text-ink-950 hover:bg-red-300'
                    : 'bg-cyan-accent text-ink-950 hover:bg-cyan-accent-dark'
                }`}
              >
                {pending.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
