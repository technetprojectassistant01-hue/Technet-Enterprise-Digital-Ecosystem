/**
 * Shared control styles. Buttons get a visible keyboard focus ring and a gentle press state on
 * top of the existing hover; the input/select classes are here so new forms can pull one
 * consistent style rather than re-declaring it (older forms still have their own local copies).
 */

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-accent'

export const primaryButtonClass = `${buttonBase} bg-cyan-accent text-ink-950 hover:bg-cyan-accent-dark`

export const secondaryButtonClass = `${buttonBase} border border-ink-600 text-ink-200 hover:border-cyan-accent hover:text-cyan-accent`

export const dangerButtonClass = `${buttonBase} border border-red-400/50 text-red-400 hover:bg-red-400/10`

/** Full-width text/select/number input, dark theme. */
export const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none transition focus:border-cyan-accent focus-visible:ring-2 focus-visible:ring-cyan-accent/40'

export const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'
