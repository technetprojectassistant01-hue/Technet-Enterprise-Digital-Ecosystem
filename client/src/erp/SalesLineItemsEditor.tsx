import { Plus, Trash2 } from 'lucide-react'

export interface SalesLineItemRow {
  description: string
  quantity: string
  unitPrice: string
}

export const EMPTY_SALES_LINE_ITEM: SalesLineItemRow = { description: '', quantity: '1', unitPrice: '' }

const fieldInputClass =
  'mt-1 w-full rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-cyan-accent'
const fieldLabelClass = 'text-[10px] tracking-wide text-ink-500'

function SalesLineItemsEditor({
  items,
  onChange,
}: {
  items: SalesLineItemRow[]
  onChange: (items: SalesLineItemRow[]) => void
}) {
  function updateRow(index: number, patch: Partial<SalesLineItemRow>) {
    onChange(items.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addRow() {
    onChange([...items, { ...EMPTY_SALES_LINE_ITEM }])
  }

  function removeRow(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold tracking-widest text-ink-400">LINE ITEMS</label>
      {items.map((row, i) => (
        <div key={i} className="flex items-end gap-2 rounded-md border border-ink-700 bg-ink-950 p-3">
          <div className="flex-[3]">
            <label className={fieldLabelClass}>DESCRIPTION</label>
            <input
              value={row.description}
              onChange={(e) => updateRow(i, { description: e.target.value })}
              required
              className={fieldInputClass}
            />
          </div>
          <div className="w-20">
            <label className={fieldLabelClass}>QTY</label>
            <input
              type="number"
              min={1}
              value={row.quantity}
              onChange={(e) => updateRow(i, { quantity: e.target.value })}
              required
              className={fieldInputClass}
            />
          </div>
          <div className="w-28">
            <label className={fieldLabelClass}>UNIT PRICE</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={row.unitPrice}
              onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
              required
              className={fieldInputClass}
            />
          </div>
          <button
            type="button"
            onClick={() => removeRow(i)}
            disabled={items.length === 1}
            aria-label="Remove line item"
            className="mb-1.5 shrink-0 text-ink-400 hover:text-red-400 disabled:opacity-30"
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
        Add line item
      </button>
    </div>
  )
}

export default SalesLineItemsEditor
