/** Escapes a value for a CSV cell: wraps in quotes and doubles any embedded quotes. */
function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/**
 * Converts already-loaded rows into a CSV file and triggers a browser
 * download. Client-side only - list pages already fetch their full dataset,
 * so there's no need for a server export endpoint.
 */
export function downloadCsv<T>(filename: string, columns: { header: string; accessor: (row: T) => unknown }[], rows: T[]) {
  const lines = [
    columns.map((c) => toCsvCell(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => toCsvCell(c.accessor(row))).join(',')),
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
