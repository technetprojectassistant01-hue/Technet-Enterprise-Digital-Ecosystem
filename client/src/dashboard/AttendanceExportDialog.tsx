import { useEffect, useState } from 'react'
import { CheckCircle2, Download, FileWarning } from 'lucide-react'
import * as api from '../lib/api'
import type { MyAttendanceValidation } from '../lib/api'
import { Modal } from './ui'
import { inputClass, labelClass, primaryButtonClass } from './buttonStyles'
import { useToast } from './ToastContext'
import { useT } from '../i18n'

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * "Export PDF" on My Attendance: pick a date range and download the printable PDF. It is marked
 * DRAFT until HR validates the month (Technet Workforce → Validations) — employees don't request
 * validation. The server decides DRAFT when it builds the PDF; the state line here is a guide.
 */
function AttendanceExportDialog({ month, onClose }: { month: Date; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const today = dayKey(new Date())

  const monthStart = dayKey(new Date(month.getFullYear(), month.getMonth(), 1))
  const monthEnd = dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(monthEnd < today ? monthEnd : today)
  const [validations, setValidations] = useState<MyAttendanceValidation[] | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    api
      .listMyAttendanceValidations()
      .then(({ validations }) => setValidations(validations))
      .catch(() => setValidations([]))
  }, [])

  const rangeError = !from || !to || to < from ? t.myAttendance.rangeInvalid : to > today ? t.myAttendance.futureNotAllowed : null

  const covering = validations?.filter((v) => v.fromDate <= from && v.toDate >= to) ?? []
  const state = covering.some((v) => !v.stale) ? 'validated' : covering.length ? 'changed' : 'none'

  async function download() {
    if (rangeError) return toast.error(rangeError)
    setDownloading(true)
    try {
      await api.downloadPdf(api.myAttendanceReportPdfUrl(from, to), `attendance-${from}-to-${to}.pdf`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myAttendance.downloadFailed)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal title={t.myAttendance.exportTitle} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-300">{t.myAttendance.exportIntro}</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="export-from" className={labelClass}>
              {t.myAttendance.fromLabel}
            </label>
            <input id="export-from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="export-to" className={labelClass}>
              {t.myAttendance.toLabel}
            </label>
            <input id="export-to" type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
        </div>

        {rangeError ? (
          <p className="text-sm text-red-400">{rangeError}</p>
        ) : (
          validations !== null && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                state === 'validated'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
              }`}
            >
              {state === 'validated' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                {state === 'validated' ? t.myAttendance.stateValidated : state === 'changed' ? t.myAttendance.stateChanged : t.myAttendance.stateNone}
              </span>
            </div>
          )
        )}

        <button type="button" onClick={download} disabled={downloading || !!rangeError} className={`justify-center py-2.5 ${primaryButtonClass}`}>
          <Download className="h-4 w-4" />
          {downloading ? t.myAttendance.downloading : t.myAttendance.downloadPdf}
        </button>
      </div>
    </Modal>
  )
}

export default AttendanceExportDialog
