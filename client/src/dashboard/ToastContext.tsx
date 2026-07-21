import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

type ToastTone = 'success' | 'error'

interface Toast {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneStyles: Record<ToastTone, string> = {
  success: 'border-cyan-accent/40 text-cyan-accent',
  error: 'border-red-400/40 text-red-400',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, tone, message }])
      setTimeout(() => remove(id), 4000)
    },
    [remove],
  )

  const value: ToastContextValue = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-6 top-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : XCircle
          return (
            <div
              key={t.id}
              className={`animate-toast-in pointer-events-auto flex items-center gap-3 rounded-lg border bg-ink-900 px-4 py-3 text-sm shadow-2xl shadow-black/40 ${toneStyles[t.tone]}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-ink-100">{t.message}</span>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Dismiss"
                className="ml-2 text-ink-500 hover:text-ink-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
