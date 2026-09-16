import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import * as api from '../lib/api'
import type { SiteAttendanceWithEmployee } from '../lib/api'
import { Modal } from './ui'
import { inputClass, labelClass, primaryButtonClass } from './buttonStyles'
import { downloadCsv } from '../lib/csv'
import { clockOf } from '../lib/siteAttendance'
import { useToast } from './ToastContext'
import { useT } from '../i18n'

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * "Export" on the admin's Staff Attendance panel: pick a range, then take it as a printable PDF
 * or as a spreadsheet. The spreadsheet is CSV rather than a real .xlsx — Excel opens it directly
 * and it needs no new dependency, the same call Work Orders and Intervention Reports already make
 * (CLAUDE.md §7a). Both carry the entered/recorded comparison the table is built around.
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

  const rangeError =
    !from || !to || to < from ? t.myAttendance.rangeInvalid : to > today ? t.myAttendance.futureNotAllowed : null

  function entered(declared: string | null, recordedIso: string | null): string {
    if (declared) return declared
    return recordedIso ? clockOf(new Date(recordedIso)) : ''
  }

  async function downloadPdf() {
    if (rangeError) return toast.error(rangeError)
    setBusy('pdf')
    try {
      await api.downloadPdf(api.staffAttendanceReportPdfUrl(from, to), `staff-attendance-${from}-to-${to}.pdf`)
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
      const { history } = await api.listTeamAttendance({ from, to })
      const rows = [...history].sort((a, b) => {
        const nameDiff = `${a.employee?.firstName} ${a.employee?.lastName}`.localeCompare(
          `${b.employee?.firstName} ${b.employee?.lastName}`,
        )
        if (nameDiff !== 0) return nameDiff
        return new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime()
      })
      const columns: { header: string; accessor: (v: SiteAttendanceWithEmployee) => unknown }[] = [
        { header: 'Staff', accessor: (v) => (v.employee ? `${v.employee.firstName} ${v.employee.lastName}` : '') },
        { header: 'Date', accessor: (v) => dayKey(new Date(v.checkInAt)) },
        { header: 'Time In (entered)', accessor: (v) => entered(v.checkInDeclaredTime, v.checkInAt) },
        { header: 'Time Out (entered)', accessor: (v) => (v.checkOutAt ? entered(v.checkOutDeclaredTime, v.checkOutAt) : '') },
        { header: 'Location In (entered)', accessor: (v) => [v.checkInSite, v.checkInNote].filter(Boolean).join(' — ') },
        { header: 'Location Out (entered)', accessor: (v) => [v.checkOutSite, v.checkOutNote].filter(Boolean).join(' — ') },
        { header: 'Time In (app)', accessor: (v) => clockOf(new Date(v.checkInAt)) },
        { header: 'Time Out (app)', accessor: (v) => (v.checkOutAt ? clockOf(new Date(v.checkOutAt)) : '') },
        { header: 'GPS In Latitude', accessor: (v) => v.checkInLat ?? '' },
        { header: 'GPS In Longitude', accessor: (v) => v.checkInLng ?? '' },
        { header: 'GPS Out Latitude', accessor: (v) => v.checkOutLat ?? '' },
        { header: 'GPS Out Longitude', accessor: (v) => v.checkOutLng ?? '' },
        { header: 'Location Check In', accessor: (v) => v.checkInLocationMatch ?? '' },
        { header: 'Location Check Out', accessor: (v) => v.checkOutLocationMatch ?? '' },
        {
          header: 'Transport (MUR)',
          accessor: (v) => (Number(v.checkInTransportCost ?? 0) + Number(v.checkOutTransportCost ?? 0)).toFixed(2),
        },
        { header: 'Closed By Manager', accessor: (v) => (v.checkOutByManager ? 'Yes' : 'No') },
      ]
      downloadCsv(`staff-attendance-${from}-to-${to}.csv`, columns, rows)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.staffAttendance.loadFailed)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal title={t.staffAttendance.exportTitle} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-300">{t.staffAttendance.exportIntro}</p>

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
              onChange={(e) => setFrom(e.target.value)}
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
              onChange={(e) => setTo(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {rangeError && <p className="text-sm text-red-400">{rangeError}</p>}

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
