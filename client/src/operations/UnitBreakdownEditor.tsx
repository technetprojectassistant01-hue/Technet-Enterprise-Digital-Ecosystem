import { Plus, Trash2 } from 'lucide-react'

export interface UnitBreakdownRow {
  label: string
  problem: string
  action: string
}

export const EMPTY_UNIT_ROW: UnitBreakdownRow = { label: '', problem: '', action: '' }

const fieldInputClass =
  'mt-1 w-full rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-cyan-accent'
const fieldLabelClass = 'text-[10px] tracking-wide text-ink-500'

function UnitBreakdownEditor({
  units,
  onChange,
}: {
  units: UnitBreakdownRow[]
  onChange: (units: UnitBreakdownRow[]) => void
}) {
  function updateRow(index: number, patch: Partial<UnitBreakdownRow>) {
    onChange(units.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addRow() {
    onChange([...units, { ...EMPTY_UNIT_ROW }])
  }

  function removeRow(index: number) {
    onChange(units.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-3">
      {units.map((row, i) => (
        <div key={i} className="flex items-end gap-2 rounded-md border border-ink-700 bg-ink-950 p-3">
          <div className="flex-[1.5]">
            <label className={fieldLabelClass}>LABEL</label>
            <input
              value={row.label}
              onChange={(e) => updateRow(i, { label: e.target.value })}
              placeholder="e.g. Unit 1"
              className={fieldInputClass}
            />
          </div>
          <div className="flex-[2]">
            <label className={fieldLabelClass}>PROBLEM</label>
            <input
              value={row.problem}
              onChange={(e) => updateRow(i, { problem: e.target.value })}
              placeholder="e.g. Leaking"
              className={fieldInputClass}
            />
          </div>
          <div className="flex-[2]">
            <label className={fieldLabelClass}>ACTION (OPTIONAL)</label>
            <input
              value={row.action}
              onChange={(e) => updateRow(i, { action: e.target.value })}
              placeholder="e.g. Sealed drain line"
              className={fieldInputClass}
            />
          </div>
          <button
            type="button"
            onClick={() => removeRow(i)}
            aria-label="Remove unit"
            className="mb-1.5 shrink-0 text-ink-400 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 self-start text-xs font-semibold text-cyan-accent hover:underline"
      >
        <Plus className="h-3.5 w-3.5" />
        Add unit
      </button>
    </div>
  )
}

export default UnitBreakdownEditor
