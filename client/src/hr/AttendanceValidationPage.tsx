import { useEffect, useState } from 'react'
import { AlertTriangle, Check, CheckCheck, ChevronLeft, ChevronRight, FileCheck2, FileText, Lock, RotateCcw, Users } from 'lucide-react'
import * as api from '../lib/api'
import type { MonthValidationItem } from '../lib/api'
import { Panel, StatCard, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, HR_ROLES } from '../lib/permissions'
import { useT } from '../i18n'

const stateTone = { NOT_VALIDATED: 'warning', VALIDATED: 'success', CHANGED: 'danger' } as const

const smallButton =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition'

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Admin/HR's month-end attendance validation (Technet Workforce → Validations). Every employee
 * with attendance in the month is listed; HR opens their PDF and validates it, one by one or all at
 * once. Until validated, the employee's own PDF is marked DRAFT. A month can be validated from its
 * last day; a validated month whose attendance later changes shows as changed.
 */
function AttendanceValidationPage() {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, HR_ROLES)

  // Default to last month: validation happens at the end of a month, usually looked at just after.
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() - 1, 1)
  })
  const [items, setItems] = useState<MonthValidationItem[]>([])
  const [monthEnded, setMonthEnded] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [validatingAll, setValidatingAll] = useState(false)

  const month = monthKey(cursor)

  function load() {
    setLoading(true)
    setError(null)
    api
      .listMonthValidations(month)
      .then(({ items, monthEnded }) => {
        setItems(items)
        setMonthEnded(monthEnded)
      })
      .catch((err) => setError(err instanceof Error ? err.message : t.workforce.validations.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (canAccess) load()
  }, [month, canAccess]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!canAccess) return <EmptyState icon={Lock} message={t.shared.restrictedToHr} />

  const personOf = (i: MonthValidationItem) => `${i.employee.firstName} ${i.employee.lastName}`
  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })

  async function run(id: string, action: () => Promise<unknown>, success: string) {
    setBusyId(id)
    try {
      await action()
      toast.success(success)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.workforce.validations.actionFailed)
    } finally {
      setBusyId(null)
    }
  }

  async function viewPdf(i: MonthValidationItem) {
    setBusyId(i.employee.id)
    try {
      await api.downloadPdf(api.monthValidationPdfUrl(i.employee.id, month), `attendance-${i.employee.employeeCode}-${month}.pdf`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myAttendance.downloadFailed)
    } finally {
      setBusyId(null)
    }
  }

  async function validateAll() {
    setValidatingAll(true)
    try {
      const { validated } = await api.validateWholeMonth(month)
      toast.success(t.workforce.validations.validatedAll(validated))
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.workforce.validations.actionFailed)
    } finally {
      setValidatingAll(false)
    }
  }

  const validatedCount = items.filter((i) => i.state === 'VALIDATED').length
  const toDoCount = items.length - validatedCount
  const isCurrentMonth = month === monthKey(new Date())
  const monthLabel = `${t.shared.months[cursor.getMonth()]} ${cursor.getFullYear()}`

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-300">{t.workforce.validations.intro}</p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard label={t.workforce.validations.statEmployees} value={loading ? '—' : items.length} icon={Users} />
        <StatCard label={t.workforce.validations.statValidated} value={loading ? '—' : validatedCount} icon={FileCheck2} />
        <StatCard label={t.workforce.validations.statToDo} value={loading ? '—' : toDoCount} icon={FileText} deltaTone="warning" />
      </div>

      <Panel
        title={t.workforce.validations.panel}
        icon={FileCheck2}
        action={
          <div className="flex items-center gap-1">
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {!loading && !monthEnded ? <p className="text-sm text-amber-300">{t.workforce.validations.monthNotOver}</p> : <span />}
          <button
            type="button"
            onClick={validateAll}
            disabled={loading || !monthEnded || toDoCount === 0 || validatingAll}
            className={primaryButtonClass}
          >
            <CheckCheck className="h-4 w-4" />
            {validatingAll ? t.workforce.validations.validatingAll : t.workforce.validations.validateAll}
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : items.length === 0 ? (
          <EmptyState icon={FileCheck2} message={t.workforce.validations.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.shared.employeeCol}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.validations.colDays}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.validations.colCheckIns}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const busy = busyId === i.employee.id || validatingAll
                  return (
                    <tr key={i.employee.id} className="border-b border-ink-800 align-top last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-medium text-ink-100">{personOf(i)}</div>
                        <div className="font-mono text-xs text-ink-400">{i.employee.employeeCode}</div>
                      </td>
                      <td className="px-3 py-3 text-ink-100">{i.daysPresent}</td>
                      <td className="px-3 py-3 text-ink-100">{i.checkIns}</td>
                      <td className="px-3 py-3">
                        <Badge tone={stateTone[i.state]}>
                          {i.state === 'CHANGED' && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                          {t.workforce.validations.state[i.state]}
                        </Badge>
                        {i.validatedBy && i.validatedAt && (
                          <div className="mt-1 text-xs text-ink-400">
                            {t.workforce.validations.validatedBy(i.validatedBy.name || i.validatedBy.email, dateFormat.format(new Date(i.validatedAt)))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => viewPdf(i)}
                            className={`${smallButton} hover:border-cyan-accent hover:text-cyan-accent disabled:opacity-50`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {t.workforce.validations.viewPdf}
                          </button>
                          {i.state !== 'VALIDATED' && (
                            <button
                              type="button"
                              disabled={busy || !monthEnded}
                              onClick={() => run(i.employee.id, () => api.validateMonth(i.employee.id, month), t.workforce.validations.validated(personOf(i)))}
                              className={`${smallButton} hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-50`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {i.state === 'CHANGED' ? t.workforce.validations.validateAgain : t.workforce.validations.validate}
                            </button>
                          )}
                          {i.state !== 'NOT_VALIDATED' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => run(i.employee.id, () => api.unvalidateMonth(i.employee.id, month), t.workforce.validations.undone)}
                              className={`${smallButton} hover:border-red-400 hover:text-red-400 disabled:opacity-50`}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {t.workforce.validations.undo}
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
      </Panel>
    </div>
  )
}

export default AttendanceValidationPage
