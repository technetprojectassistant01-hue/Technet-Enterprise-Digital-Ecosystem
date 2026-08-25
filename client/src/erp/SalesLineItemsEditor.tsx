import { Plus, Trash2 } from 'lucide-react'
import { formatMoney } from '../lib/format'

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

  function addRow(description = '') {
    onChange([...items, { ...EMPTY_SALES_LINE_ITEM, description }])
  }

  function removeRow(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold tracking-widest text-ink-400">LINE ITEMS</label>
      {items.map((row, i) => {
        const lineTotal = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0)
        return (
          <div key={i} className="rounded-md border border-ink-700 bg-ink-950 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 w-6 shrink-0 font-mono text-[10px] text-ink-500">{String(i + 1).padStart(2, '0')}</span>
              <div className="flex-1">
                <label className={fieldLabelClass}>DESCRIPTION</label>
                <textarea
                  value={row.description}
                  onChange={(e) => updateRow(i, { description: e.target.value })}
                  required
                  rows={2}
                  placeholder="e.g. Brand X 12,000 BTU Wall-Mounted Split AC&#10;• Model: AC-12345-INV&#10;• Inverter technology (R32 gas)"
                  className={`${fieldInputClass} resize-y`}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={items.length === 1}
                aria-label="Remove line item"
                className="mt-6 shrink-0 text-ink-400 hover:text-red-400 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-end gap-2 pl-8">
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
              <div className="flex-1 text-right">
                <span className={fieldLabelClass}>TOTAL AMOUNT</span>
                <div className="mt-1 text-sm font-semibold text-ink-100">{formatMoney(lineTotal)}</div>
              </div>
            </div>
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => addRow()}
          className="flex items-center gap-1.5 text-xs font-semibold text-cyan-accent hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Add line item
        </button>
        <button type="button" onClick={() => addRow('Labor')} className="text-xs text-ink-400 hover:text-ink-100 hover:underline">
          + Labor
        </button>
        <button type="button" onClick={() => addRow('Transport')} className="text-xs text-ink-400 hover:text-ink-100 hover:underline">
          + Transport
        </button>
      </div>
    </div>
  )
}

export default SalesLineItemsEditor
