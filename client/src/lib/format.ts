export function formatMoney(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value
  return `MUR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
