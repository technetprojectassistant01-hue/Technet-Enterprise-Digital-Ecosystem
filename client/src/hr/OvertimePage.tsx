import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Clock, Lock, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import * as api from '../lib/api'
import type { Employee, OvertimeItem, OvertimeItemStatus, OvertimeType } from '../lib/api'
import { OVERTIME_TYPES } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { inputClass, labelClass, primaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, HR_ROLES } from '../lib/permissions'
import { useT } from '../i18n'
import AttendanceDataIssuesPanel from './AttendanceDataIssuesPanel'

const STATUSES: OvertimeItemStatus[] = ['PENDING', 'APPROVED', 'REJECTED']
const statusTone = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const

const smallButton =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition'

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function todayKey(): string {
  const now = new Date()
  return `${monthKey(now)}-${String(now.getDate()).padStart(2, '0')}`
}

/** Minutes from start to end ("HH:MM"); an end at or before the start is the next day. Mirrors server lib/overtimeRecords.ts. */
function recordMinutes(start: string, end: string): number | null {
  const time = /^(\d{2}):(\d{2})$/
  const a = time.exec(start)
  const b = time.exec(end)
  if (!a || !b || start === end) return null
  const s = Number(a[1]) * 60 + Number(a[2])
  const e = Number(b[1]) * 60 + Number(b[2])
  return e > s ? e - s : e + 1440 - s
}

interface RecordForm {
  employeeId: string
  date: string
  type: OvertimeType
  startTime: string
  endTime: string
  reason: string
}

/** Sunday is a rest day; anything else defaults to Normal (HR picks Public holiday themselves). */
const defaultType = (date: string): OvertimeType => (new Date(`${date}T12:00:00`).getDay() === 0 ? 'REST_DAY' : 'NORMAL')

/**
 * HR's overtime queue (Technet Workforce → Overtime). Overtime is worked out on the server from
 * site attendance against the standard hours; each day stays pending until HR approves or rejects
 * it. Only approved overtime shows on the technician's own My Attendance. HR can also type a record
 * in by hand (AiFace "Overtime Records"): it replaces that day's calculated overtime, approved.
 */
function OvertimePage() {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, HR_ROLES)

  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [status, setStatus] = useState<OvertimeItemStatus | '' | 'MANUAL'>('PENDING')
  const [items, setItems] = useState<OvertimeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<OvertimeItem | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [recordForm, setRecordForm] = useState<RecordForm | null>(null)
  const [recordEditing, setRecordEditing] = useState(false)
  const [savingRecord, setSavingRecord] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])

  function load() {
    setLoading(true)
    setError(null)
    api
      .listOvertime(monthKey(cursor))
      .then(({ items }) => setItems(items))
      .catch((err) => setError(err instanceof Error ? err.message : t.workforce.overtime.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (canAccess) load()
  }, [cursor, canAccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // The employee picker for a new record: everyone still employed, loaded the first time it is needed.
  useEffect(() => {
    if (!recordForm || employees.length) return
    api
      .listEmployees()
      .then(({ employees }) =>
        setEmployees(
          employees
            .filter((e) => e.employmentStatus !== 'TERMINATED')
            .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
        ),
      )
      .catch(() => setEmployees([]))
  }, [recordForm, employees.length])

  if (!canAccess) return <EmptyState icon={Lock} message={t.shared.restrictedToHr} />

  const span = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    return h > 0 ? t.shared.hoursMinutes(h, minutes % 60) : t.shared.minutesOnly(minutes)
  }
  const keyOf = (i: OvertimeItem) => `${i.employeeId}|${i.date}`
  const personOf = (i: OvertimeItem) => (i.employee ? `${i.employee.firstName} ${i.employee.lastName}` : '—')
  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })

  async function decide(item: OvertimeItem, approve: boolean, note?: string) {
    setBusyKey(keyOf(item))
    try {
      await api.decideOvertime({ employeeId: item.employeeId, date: item.date, approve, note })
      toast.success(approve ? t.workforce.overtime.approved(personOf(item)) : t.workforce.overtime.rejected(personOf(item)))
      setRejecting(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.workforce.overtime.decideFailed)
    } finally {
      setBusyKey(null)
    }
  }

  function openRecord(item?: OvertimeItem) {
    const r = item?.decision?.manual ? item.decision : null
    const date = item?.date ?? (monthKey(cursor) === monthKey(new Date()) ? todayKey() : `${monthKey(cursor)}-01`)
    setRecordEditing(!!r)
    setRecordForm({
      employeeId: item?.employeeId ?? '',
      date,
      type: r?.type ?? defaultType(date),
      startTime: r?.startTime ?? '',
      endTime: r?.endTime ?? '',
      reason: r?.note ?? '',
    })
  }

  async function saveRecord(form: RecordForm) {
    setSavingRecord(true)
    try {
      await api.saveOvertimeRecord(form)
      const e = employees.find((x) => x.id === form.employeeId)
      const item = items.find((i) => i.employeeId === form.employeeId)
      const person = e ? `${e.firstName} ${e.lastName}` : item ? personOf(item) : ''
      toast.success(t.workforce.overtime.records.saved(person))
      setRecordForm(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.workforce.overtime.records.saveFailed)
    } finally {
      setSavingRecord(false)
    }
  }

  async function undo(item: OvertimeItem) {
    setBusyKey(keyOf(item))
    try {
      await api.undoOvertimeDecision(item.employeeId, item.date)
      toast.success(item.decision?.manual ? t.workforce.overtime.records.deleted : t.workforce.overtime.undone)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.workforce.overtime.decideFailed)
    } finally {
      setBusyKey(null)
    }
  }

  const shown =
    status === 'MANUAL' ? items.filter((i) => i.decision?.manual) : status ? items.filter((i) => i.status === status) : items
  const pendingCount = items.filter((i) => i.status === 'PENDING').length
  const approvedMinutes = items
    .filter((i) => i.status === 'APPROVED')
    .reduce((sum, i) => sum + (i.decision?.minutes ?? i.minutes), 0)
  const isCurrentMonth = monthKey(cursor) === monthKey(new Date())
  const monthLabel = `${t.shared.months[cursor.getMonth()]} ${cursor.getFullYear()}`

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-300">{t.workforce.overtime.intro}</p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label={t.workforce.overtime.statPending} value={loading ? '—' : pendingCount} icon={Clock} deltaTone="warning" />
        <StatCard label={t.workforce.overtime.statApproved} value={loading ? '—' : span(approvedMinutes)} icon={Check} />
      </div>

      <Panel
        title={t.workforce.overtime.panel}
        icon={Clock}
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openRecord()}
              className={`${smallButton} mr-2 hover:border-cyan-accent hover:text-cyan-accent`}
            >
              <Plus className="h-3.5 w-3.5" />
              {t.workforce.overtime.records.add}
            </button>
            <button
              type="button"
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              aria-label={t.myAttendance.previousMonth}
              className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-medium text-ink-100">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              disabled={isCurrentMonth}
              aria-label={t.myAttendance.nextMonth}
              className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t.shared.status}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as OvertimeItemStatus | '' | 'MANUAL')} className={inputClass}>
              <option value="">{t.shared.allStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.workforce.overtime.status[s]}
                </option>
              ))}
              <option value="MANUAL">{t.workforce.overtime.records.filterManual}</option>
            </select>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Clock} message={status === 'PENDING' ? t.workforce.overtime.emptyPending : t.workforce.overtime.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.shared.employeeCol}</th>
                  <th className="px-3 py-3 font-semibold">{t.myAttendance.colDate}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.overtime.colWorked}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.overtime.colOvertime}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const busy = busyKey === keyOf(i)
                  const minutes = i.status === 'PENDING' ? i.minutes : (i.decision?.minutes ?? i.minutes)
                  const record = i.decision?.manual ? i.decision : null
                  return (
                    <tr key={keyOf(i)} className="border-b border-ink-800 align-top last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-medium text-ink-100">{personOf(i)}</div>
                        {i.employee && <div className="font-mono text-xs text-ink-400">{i.employee.employeeCode}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-100">{dateFormat.format(new Date(`${i.date}T12:00:00`))}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-ink-100">
                        {record?.startTime && record.endTime
                          ? `${record.startTime} → ${record.endTime}`
                          : i.firstIn && i.lastOut
                            ? `${i.firstIn} → ${i.lastOut}`
                            : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-100">
                        <div className="font-semibold">{span(minutes)}</div>
                        {/* A record replaces the calculated figure; show what it replaced. */}
                        {record && i.minutes > 0 && i.minutes !== record.minutes && (
                          <div className="text-xs text-ink-400">{t.workforce.overtime.records.calculated(span(i.minutes))}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={statusTone[i.status]}>{t.workforce.overtime.status[i.status]}</Badge>
                          {record && <Badge tone="accent">{t.workforce.overtime.records.badge}</Badge>}
                        </div>
                        {record && (
                          <div className="mt-1 text-xs text-ink-300">
                            {record.type && `${t.workforce.overtime.records.types[record.type]} · `}
                            {t.workforce.overtime.records.by(record.decidedBy?.name || record.decidedBy?.email || '—')}
                          </div>
                        )}
                        {i.decision?.note && <div className="mt-1 max-w-xs text-xs text-ink-300">{i.decision.note}</div>}
                        {/* Spec section 6: a warning when the day has open or confirmed anomalies - never a block. */}
                        {(i.anomalyCount ?? 0) > 0 && (
                          <Link
                            to={`/dashboard/operations/anomalies?employeeId=${i.employeeId}&from=${i.date}&to=${i.date}`}
                            className="mt-1 block max-w-xs text-xs font-medium text-amber-400 hover:underline"
                          >
                            ⚠ {t.workforce.overtime.anomalyWarning(i.anomalyCount!)}
                          </Link>
                        )}
                        {/* A visit open 12h+ (checked out late) makes the overtime look bigger than it was. */}
                        {i.longVisitMinutes != null && (
                          <div className="mt-1 max-w-xs text-xs font-medium text-red-400">
                            ⚠ {t.workforce.overtime.longVisitWarning(span(i.longVisitMinutes))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {record ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => openRecord(i)}
                                className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent disabled:opacity-50`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                {t.workforce.overtime.records.edit}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => undo(i)}
                                className={`${smallButton} hover:border-red-400 hover:text-red-400 disabled:opacity-50`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t.workforce.overtime.records.delete}
                              </button>
                            </>
                          ) : i.status === 'PENDING' ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => decide(i, true)}
                                className={`${smallButton} hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-50`}
                              >
                                <Check className="h-3.5 w-3.5" />
                                {t.shared.approve}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setRejecting(i)
                                  setRejectNote('')
                                }}
                                className={`${smallButton} hover:border-red-400 hover:text-red-400 disabled:opacity-50`}
                              >
                                <X className="h-3.5 w-3.5" />
                                {t.shared.reject}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => openRecord(i)}
                                className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent disabled:opacity-50`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                {t.workforce.overtime.records.recordInstead}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => undo(i)}
                              className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent disabled:opacity-50`}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {t.workforce.overtime.undo}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-400">{t.workforce.overtime.rulesNote}</p>
      </Panel>

      <AttendanceDataIssuesPanel />

      {recordForm && (
        <RecordModal
          form={recordForm}
          editing={recordEditing}
          employees={employees}
          existing={items.find((i) => i.employeeId === recordForm.employeeId && i.date === recordForm.date) ?? null}
          saving={savingRecord}
          span={span}
          onChange={setRecordForm}
          onClose={() => setRecordForm(null)}
          onSave={saveRecord}
        />
      )}

      {rejecting && (
        <Modal title={t.workforce.overtime.rejectTitle(personOf(rejecting))} onClose={() => setRejecting(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              decide(rejecting, false, rejectNote || undefined)
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label className={labelClass}>{t.workforce.overtime.reason}</label>
              <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} className={`mt-2 ${inputClass}`} />
            </div>
            <button type="submit" disabled={busyKey !== null} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {t.shared.reject}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

/** Add or edit a manual overtime record (AiFace "Overtime Records"). */
function RecordModal({
  form,
  editing,
  employees,
  existing,
  saving,
  span,
  onChange,
  onClose,
  onSave,
}: {
  form: RecordForm
  editing: boolean
  employees: Employee[]
  /** What the month's list already holds for this employee-day, to say what the record replaces. */
  existing: OvertimeItem | null
  saving: boolean
  span: (minutes: number) => string
  onChange: (form: RecordForm) => void
  onClose: () => void
  onSave: (form: RecordForm) => void
}) {
  const t = useT()
  const r = t.workforce.overtime.records
  const set = (patch: Partial<RecordForm>) => onChange({ ...form, ...patch })
  const minutes = recordMinutes(form.startTime, form.endTime)
  const nextDay = minutes !== null && form.endTime <= form.startTime
  const chosen = employees.find((x) => x.id === form.employeeId)
  const person = existing?.employee
    ? `${existing.employee.firstName} ${existing.employee.lastName}`
    : chosen
      ? `${chosen.firstName} ${chosen.lastName}`
      : ''
  // Say what gets replaced - the user chose "replace that day's overtime" (2026-10-19).
  const replaces =
    existing && !existing.decision?.manual
      ? existing.status === 'PENDING' && existing.minutes > 0
        ? r.replaces(span(existing.minutes))
        : existing.decision
          ? r.replacesDecision
          : null
      : null
  const valid = !!form.employeeId && !!form.date && minutes !== null && form.reason.trim().length > 0

  return (
    <Modal title={editing ? r.editTitle(person) : r.addTitle} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSave({ ...form, reason: form.reason.trim() })
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-ink-300">{r.intro}</p>
        <div>
          <label className={labelClass}>{r.employee}</label>
          {editing ? (
            <div className={`mt-2 ${inputClass}`}>{person}</div>
          ) : (
            <select value={form.employeeId} onChange={(e) => set({ employeeId: e.target.value })} className={`mt-2 ${inputClass}`} required>
              <option value="">{r.chooseEmployee}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.employeeCode})
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{r.date}</label>
            <input
              type="date"
              value={form.date}
              max={todayKey()}
              disabled={editing}
              onChange={(e) => set({ date: e.target.value, ...(e.target.value ? { type: defaultType(e.target.value) } : {}) })}
              className={`mt-2 ${inputClass}`}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{r.type}</label>
            <select value={form.type} onChange={(e) => set({ type: e.target.value as OvertimeType })} className={`mt-2 ${inputClass}`}>
              {OVERTIME_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {r.types[ty]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{r.start}</label>
            <input type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} className={`mt-2 ${inputClass}`} required />
          </div>
          <div>
            <label className={labelClass}>{r.end}</label>
            <input type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} className={`mt-2 ${inputClass}`} required />
          </div>
        </div>
        {minutes !== null && (
          <p className="text-sm font-semibold text-ink-100">
            {r.duration(span(minutes))}
            {nextDay && <span className="font-normal text-ink-300"> ({r.nextDay})</span>}
          </p>
        )}
        <div>
          <label className={labelClass}>{r.reason}</label>
          <textarea
            value={form.reason}
            onChange={(e) => set({ reason: e.target.value })}
            rows={2}
            maxLength={500}
            className={`mt-2 ${inputClass}`}
            required
          />
        </div>
        {replaces && <p className="text-xs font-medium text-amber-400">{replaces}</p>}
        <button type="submit" disabled={!valid || saving} className={`justify-center py-2.5 ${primaryButtonClass} disabled:opacity-50`}>
          {r.save}
        </button>
      </form>
    </Modal>
  )
}

export default OvertimePage
