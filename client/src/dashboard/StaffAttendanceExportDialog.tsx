import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import * as api from '../lib/api'
import { Modal } from './ui'
import { inputClass, labelClass, primaryButtonClass } from './buttonStyles'
import { useToast } from './ToastContext'
import { useT } from '../i18n'

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * "Export" on the admin's Staff Attendance panel: pick a range, then take it as a printable PDF
 * or as an Excel workbook (since 2026-10-05 a real .xlsx built on the server - Summary + Register
 * sheets with the letterhead - replacing the old client-side CSV). Both carry the entered/recorded
 * comparison the table is built around.
 */
function StaffAttendanceExportDialog({ month, onClose }: { month: Date; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const today = dayKey(new Date())

  const monthStart = dayKey(new Date(month.getFullYear(), month.getMonth(), 1))
  const monthEnd = dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(monthEnd < today ? monthEnd : today)
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null)
  // "All records": the server starts the PDF at the first check-in on file (?from=all).
  const [preset, setPreset] = useState<'yesterday' | 'month' | 'all' | null>(null)
  const allRecords = preset === 'all'

  const rangeError = allRecords
    ? null
    : !from || !to || to < from
      ? t.myAttendance.rangeInvalid
      : to > today
        ? t.myAttendance.futureNotAllowed
        : null

  function quick(kind: 'yesterday' | 'month' | 'all') {
    setPreset(kind)
    if (kind === 'yesterday') {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      setFrom(dayKey(y))
      setTo(dayKey(y))
    } else if (kind === 'month') {
      const now = new Date()
      setFrom(dayKey(new Date(now.getFullYear(), now.getMonth(), 1)))
      setTo(today)
    } else {
      setTo(today)
    }
  }

  async function downloadPdf() {
    if (rangeError) return toast.error(rangeError)
    setBusy('pdf')
    try {
      const pdfFrom = allRecords ? 'all' : from
      await api.downloadPdf(api.staffAttendanceReportPdfUrl(pdfFrom, to), `staff-attendance-${allRecords ? 'all-records' : from}-to-${to}.pdf`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myAttendance.downloadFailed)
    } finally {
      setBusy(null)
    }
  }

  async function downloadSpreadsheet() {
    if (rangeError) return toast.error(rangeError)
    setBusy('csv')
    try {
      const xlsxFrom = allRecords ? 'all' : from
      await api.downloadPdf(
        api.staffAttendanceReportXlsxUrl(xlsxFrom, to),
        `staff-attendance-${allRecords ? 'all-records' : from}-to-${to}.xlsx`,
      )
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myAttendance.downloadFailed)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal title={t.staffAttendance.exportTitle} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-300">{t.staffAttendance.exportIntro}</p>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['yesterday', t.staffAttendance.quickYesterday],
              ['month', t.staffAttendance.quickThisMonth],
              ['all', t.staffAttendance.quickAllRecords],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              onClick={() => quick(kind)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                preset === kind
                  ? 'border-cyan-accent text-cyan-accent'
                  : 'border-ink-600 text-ink-300 hover:border-cyan-accent hover:text-cyan-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="staff-export-from" className={labelClass}>
              {t.myAttendance.fromLabel}
            </label>
            <input
              id="staff-export-from"
              type="date"
              value={from}
              max={today}
              disabled={allRecords}
              onChange={(e) => {
                setPreset(null)
                setFrom(e.target.value)
              }}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="staff-export-to" className={labelClass}>
              {t.myAttendance.toLabel}
            </label>
            <input
              id="staff-export-to"
              type="date"
              value={to}
              max={today}
              onChange={(e) => {
                setPreset(preset === 'all' ? 'all' : null)
                setTo(e.target.value)
              }}
              className={inputClass}
            />
          </div>
        </div>

        {allRecords && <p className="text-xs text-ink-400">{t.staffAttendance.allRecordsNote}</p>}
        {rangeError && <p className="text-sm text-red-400">{rangeError}</p>}
        <p className="text-xs text-ink-400">{t.staffAttendance.pdfContents}</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={downloadPdf}
            disabled={busy !== null || !!rangeError}
            className={`flex-1 justify-center py-2.5 ${primaryButtonClass}`}
          >
            <Download className="h-4 w-4" />
            {busy === 'pdf' ? t.myAttendance.downloading : t.staffAttendance.downloadPdf}
          </button>
          <button
            type="button"
            onClick={downloadSpreadsheet}
            disabled={busy !== null || !!rangeError}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-ink-600 py-2.5 text-sm font-semibold text-ink-200 transition hover:border-cyan-accent hover:text-cyan-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {busy === 'csv' ? t.myAttendance.downloading : t.staffAttendance.downloadExcel}
          </button>
        </div>

        <p className="text-xs text-ink-400">{t.staffAttendance.excelNote}</p>
      </div>
    </Modal>
  )
}

export default StaffAttendanceExportDialog
