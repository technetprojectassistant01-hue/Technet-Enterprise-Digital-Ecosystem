import { secondaryButtonClass } from './buttonStyles'
import { useT } from '../i18n'

/**
 * The banner a new-record form shows when useFormDraft brought back what was typed before it was
 * closed. `files` adds the line that files and photos have to be added again.
 */
export function DraftNotice({ onDiscard, files = false }: { onDiscard: () => void; files?: boolean }) {
  const t = useT()
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-cyan-accent/40 bg-cyan-accent/10 px-4 py-3 text-sm text-ink-200">
      <p>
        {t.draft.restored}
        {files && <> {t.draft.filesNote}</>}
      </p>
      <button type="button" onClick={onDiscard} className={`shrink-0 ${secondaryButtonClass}`}>
        {t.draft.discard}
      </button>
    </div>
  )
}
