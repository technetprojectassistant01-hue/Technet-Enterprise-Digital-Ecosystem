import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, Download, FileWarning, Send, Trash2 } from 'lucide-react'
import * as api from '../lib/api'
import type { AttendanceValidation } from '../lib/api'
import { Badge, Modal } from './ui'
import { inputClass, labelClass, primaryButtonClass } from './buttonStyles'
import { useToast } from './ToastContext'
import { useT } from '../i18n'

const statusTone = { PENDING: 'warning', VALIDATED: 'success', REJECTED: 'danger' } as const

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * "Export PDF" on My Attendance: pick a date range, download the printable PDF, and ask Admin/HR to
 * validate those dates. The PDF carries a DRAFT mark until a validation covers the range — the
 * server decides that when it builds the PDF; the state line here is only a guide from the list.
 */
function AttendanceExportDialog({ month, onClose }: { month: Date; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const today = dayKey(new Date())

  const monthStart = dayKey(new Date(month.getFullYear(), month.getMonth(), 1))
  const monthEnd = dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(monthEnd < today ? monthEnd : today)
  const [validations, setValidations] = useState<AttendanceValidation[] | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [requesting, setRequesting] = useState(false)

  function load() {
    api
      .listMyAttendanceValidations()
      .then(({ validations }) => setValidations(validations))
      .catch(() => setValidations([]))
  }
  useEffect(load, [])

  const rangeError = !from || !to ? t.myAttendance.rangeInvalid : to < from ? t.myAttendance.rangeInvalid : to > today ? t.myAttendance.futureNotAllowed : null

  const covered = validations?.some((v) => v.status === 'VALIDATED' && !v.stale && v.fromDate <= from && v.toDate >= to)
  const pending = validations?.some((v) => v.status === 'PENDING' && v.fromDate === from && v.toDate === to)
  const state = covered ? 'validated' : pending ? 'pending' : 'none'

  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })
  const dayLabel = (day: string) => dateFormat.format(new Date(`${day}T12:00:00`))
  const periodLabel = (v: AttendanceValidation) =>
    v.fromDate === v.toDate ? dayLabel(v.fromDate) : `${dayLabel(v.fromDate)} – ${dayLabel(v.toDate)}`

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

  async function requestValidation() {
    if (rangeError) return toast.error(rangeError)
    setRequesting(true)
    try {
      await api.requestAttendanceValidation(from, to)
      toast.success(t.myAttendance.requested)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myAttendance.requestFailed)
    } finally {
      setRequesting(false)
    }
  }

  async function remove(v: AttendanceValidation) {
    try {
      await api.deleteMyAttendanceValidation(v.id)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myAttendance.removeFailed)
    }
  }

  const secondaryButton =
    'inline-flex items-center justify-center gap-2 rounded-lg border border-ink-600 px-4 py-2.5 text-sm font-semibold text-ink-100 transition hover:border-cyan-accent hover:text-cyan-accent disabled:cursor-not-allowed disabled:opacity-50'

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
                  : state === 'pending'
                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                    : 'border-red-400/30 bg-red-400/10 text-red-300'
              }`}
            >
              {state === 'validated' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : state === 'pending' ? (
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                {state === 'validated' ? t.myAttendance.stateValidated : state === 'pending' ? t.myAttendance.statePending : t.myAttendance.stateNone}
              </span>
            </div>
          )
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={download} disabled={downloading || !!rangeError} className={`justify-center py-2.5 ${primaryButtonClass}`}>
            <Download className="h-4 w-4" />
            {downloading ? t.myAttendance.downloading : t.myAttendance.downloadPdf}
          </button>
          <button
            type="button"
            onClick={requestValidation}
            disabled={requesting || !!rangeError || state !== 'none'}
            className={secondaryButton}
          >
            <Send className="h-4 w-4" />
            {requesting ? t.myAttendance.requesting : t.myAttendance.requestValidation}
          </button>
        </div>

        <div className="border-t border-ink-800 pt-4">
          <div className="mb-2 text-[11px] font-semibold tracking-widest text-ink-400">{t.myAttendance.myRequests}</div>
          {validations !== null && validations.length === 0 && <p className="text-sm text-ink-300">{t.myAttendance.noRequests}</p>}
          <ul className="flex flex-col gap-2">
            {validations?.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-800 bg-ink-950 px-3 py-2.5">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setFrom(v.fromDate)
                      setTo(v.toDate)
                    }}
                    title={t.myAttendance.useDates}
                    className="text-left text-sm font-medium text-ink-100 hover:text-cyan-accent"
                  >
                    {periodLabel(v)}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tone={v.stale ? 'warning' : statusTone[v.status]}>{t.myAttendance.validationStatus[v.status]}</Badge>
                    {v.stale && <span className="text-xs text-amber-300">{t.myAttendance.changedSince}</span>}
                  </div>
                  {v.status === 'REJECTED' && v.note && <div className="mt-1 text-xs text-ink-300">{v.note}</div>}
                </div>
                {v.status !== 'VALIDATED' && (
                  <button
                    type="button"
                    onClick={() => remove(v)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition hover:border-red-400 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {v.status === 'PENDING' ? t.myAttendance.withdraw : t.myAttendance.removeRequest}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  )
}

export default AttendanceExportDialog
