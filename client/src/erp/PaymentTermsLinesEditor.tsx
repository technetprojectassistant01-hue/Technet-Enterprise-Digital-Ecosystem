import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { PaymentTermsLine } from '../lib/api'

export const EMPTY_PAYMENT_TERMS_LINE: PaymentTermsLine = { label: '', percentage: '' }

const fieldInputClass =
  'mt-1 w-full rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-cyan-accent'
const fieldLabelClass = 'text-[10px] tracking-wide text-ink-500'

const NEW_LABEL_VALUE = '__new__'

/** Payment terms as a repeatable label+percentage table (must sum to 100), replacing the old fixed
 * 3-preset dropdown. Everyday use picks a label already used elsewhere; only ADMIN can introduce a
 * genuinely new one, to avoid free-text drift ("AC" vs "Ac" vs "A/C") in data the office wants to
 * report on later. */
function PaymentTermsLinesEditor({
  lines,
  onChange,
  knownLabels,
  isAdmin,
}: {
  lines: PaymentTermsLine[]
  onChange: (lines: PaymentTermsLine[]) => void
  knownLabels: string[]
  isAdmin: boolean
}) {
  // Rows currently showing a free-text input instead of the dropdown (admin "add new label" mode).
  const [newLabelRows, setNewLabelRows] = useState<Set<number>>(new Set())

  function updateRow(index: number, patch: Partial<PaymentTermsLine>) {
    onChange(lines.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addRow() {
    onChange([...lines, { ...EMPTY_PAYMENT_TERMS_LINE }])
  }

  function removeRow(index: number) {
    onChange(lines.filter((_, i) => i !== index))
    setNewLabelRows((s) => {
      const next = new Set(s)
      next.delete(index)
      return next
    })
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.percentage) || 0), 0)
  const totalOk = Math.round(total * 100) === 10000

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold tracking-widest text-ink-400">PAYMENT TERMS</label>
        <span className={`text-xs font-semibold ${totalOk ? 'text-cyan-accent' : 'text-red-400'}`}>
          Total: {total}% {totalOk ? '✓' : '— must equal 100'}
        </span>
      </div>
      {lines.map((row, i) => {
        const inNewLabelMode = newLabelRows.has(i) || (row.label !== '' && !knownLabels.includes(row.label))
        return (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <label className={fieldLabelClass}>LABEL</label>
              {inNewLabelMode ? (
                <input
                  value={row.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  placeholder="e.g. Delivery"
                  className={fieldInputClass}
                />
              ) : (
                <select
                  value={row.label}
                  onChange={(e) => {
                    if (e.target.value === NEW_LABEL_VALUE) {
                      setNewLabelRows((s) => new Set(s).add(i))
                      updateRow(i, { label: '' })
                    } else {
                      updateRow(i, { label: e.target.value })
                    }
                  }}
                  className={fieldInputClass}
                >
                  <option value="">Select a label</option>
                  {knownLabels.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                  {isAdmin && <option value={NEW_LABEL_VALUE}>+ Add new label</option>}
                </select>
              )}
            </div>
            <div className="w-24">
              <label className={fieldLabelClass}>%</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={row.percentage}
                onChange={(e) => updateRow(i, { percentage: e.target.value })}
                className={fieldInputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              disabled={lines.length === 1}
              aria-label="Remove payment terms line"
              className="mb-1.5 shrink-0 text-ink-400 hover:text-red-400 disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      })}
      <button
        type="button"
        onClick={addRow}
        className="flex w-fit items-center gap-1.5 text-xs font-semibold text-cyan-accent hover:underline"
      >
        <Plus className="h-3.5 w-3.5" />
        Add line
      </button>
    </div>
  )
}

export default PaymentTermsLinesEditor
