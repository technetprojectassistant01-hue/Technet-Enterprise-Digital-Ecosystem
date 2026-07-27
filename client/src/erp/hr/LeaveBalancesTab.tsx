import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Scale, RefreshCw, Pencil } from 'lucide-react'
import * as api from '../../lib/api'
import type { LeaveBalance, LeaveType } from '../../lib/api'
import { Panel, Modal, EmptyState, TableSkeleton } from '../../dashboard/ui'
import { useToast } from '../../dashboard/ToastContext'
import { useEmployees } from '../useEmployees'
import { inputClass, labelClass, primaryButtonClass } from './formStyles'

function remainingOf(balance: LeaveBalance): number {
  return Number(balance.entitledDays) + Number(balance.carriedOverDays) - Number(balance.usedDays)
}

function LeaveBalancesTab({ leaveTypes }: { leaveTypes: LeaveType[] }) {
  const toast = useToast()
  const employees = useEmployees()

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [employeeId, setEmployeeId] = useState('')

  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)

  const [editing, setEditing] = useState<LeaveBalance | null>(null)
  const [entitled, setEntitled] = useState('')
  const [carried, setCarried] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    (overrides: { year?: number; employeeId?: string } = {}) => {
      const nextYear = overrides.year ?? year
      const nextEmployee = overrides.employeeId ?? employeeId
      setLoading(true)
      setError(null)
      api
        .listLeaveBalances({ year: nextYear, employeeId: nextEmployee || undefined })
        .then(({ balances }) => setBalances(balances))
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load balances'))
        .finally(() => setLoading(false))
    },
    [year, employeeId],
  )

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleInitialize() {
    setInitializing(true)
    try {
      const { created } = await api.initializeLeaveBalances(year)
      toast.success(
        created === 0
          ? `Every employee already has ${year} balances`
          : `Created ${created} balance record${created === 1 ? '' : 's'} for ${year}`,
      )
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to initialize balances')
    } finally {
      setInitializing(false)
    }
  }

  function openEdit(balance: LeaveBalance) {
    setEditing(balance)
    setEntitled(balance.entitledDays)
    setCarried(balance.carriedOverDays)
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setFormError(null)

    const entitledDays = Number(entitled)
    const carriedOverDays = Number(carried || 0)
    if (!Number.isFinite(entitledDays) || entitledDays < 0) {
      return setFormError('Entitled days must be zero or more')
    }
    if (!Number.isFinite(carriedOverDays) || carriedOverDays < 0) {
      return setFormError('Carried-over days must be zero or more')
    }

    setSubmitting(true)
    try {
      await api.setLeaveBalance({
        employeeId: editing.employeeId,
        leaveTypeId: editing.leaveTypeId,
        year: editing.year,
        entitledDays,
        carriedOverDays,
      })
      toast.success('Balance updated')
      setEditing(null)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update balance')
    } finally {
      setSubmitting(false)
    }
  }

  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={year}
            onChange={(e) => {
              const next = Number(e.target.value)
              setYear(next)
              load({ year: next })
            }}
            className={`max-w-[8rem] ${inputClass}`}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value)
              load({ employeeId: e.target.value })
            }}
            className={`max-w-[16rem] ${inputClass}`}
          >
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleInitialize}
            disabled={initializing || leaveTypes.length === 0}
            className="ml-auto flex items-center gap-2 rounded-md border border-ink-600 px-4 py-2 text-sm font-medium text-ink-100 hover:border-ink-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${initializing ? 'animate-spin' : ''}`} />
            Generate {year} balances
          </button>
        </div>

        <p className="mb-4 text-xs text-ink-400">
          Generating creates any missing balance rows from each leave type's yearly entitlement. Existing
          rows keep their adjusted values.
        </p>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : balances.length === 0 ? (
          <EmptyState
            icon={Scale}
            message={`No ${year} balances yet. Use "Generate ${year} balances" to create them.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">EMPLOYEE</th>
                  <th className="px-3 py-3 font-semibold">LEAVE TYPE</th>
                  <th className="px-3 py-3 font-semibold">ENTITLED</th>
                  <th className="px-3 py-3 font-semibold">CARRIED OVER</th>
                  <th className="px-3 py-3 font-semibold">USED</th>
                  <th className="px-3 py-3 font-semibold">REMAINING</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => {
                  const remaining = remainingOf(b)
                  return (
                    <tr key={b.id} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-3 font-medium text-ink-100">
                        {b.employee ? `${b.employee.firstName} ${b.employee.lastName}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-ink-300">{b.leaveType.name}</td>
                      <td className="px-3 py-3 text-ink-300">{b.entitledDays}</td>
                      <td className="px-3 py-3 text-ink-300">{b.carriedOverDays}</td>
                      <td className="px-3 py-3 text-ink-300">{b.usedDays}</td>
                      <td
                        className={`px-3 py-3 font-medium ${
                          remaining < 0 ? 'text-red-400' : 'text-ink-100'
                        }`}
                      >
                        {remaining.toFixed(1)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end text-ink-400">
                          <button
                            type="button"
                            onClick={() => openEdit(b)}
                            aria-label="Adjust balance"
                            className="hover:text-ink-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
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

      {editing && (
        <Modal
          title={`Adjust ${editing.leaveType.name} — ${editing.employee?.firstName ?? ''} ${
            editing.employee?.lastName ?? ''
          }`}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>ENTITLED DAYS ({editing.year})</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={entitled}
                  onChange={(e) => setEntitled(e.target.value)}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>CARRIED OVER</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={carried}
                  onChange={(e) => setCarried(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            <p className="text-xs text-ink-400">
              {editing.usedDays} day(s) already used. Used days only change when leave is approved or
              cancelled.
            </p>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={primaryButtonClass}>
              {submitting ? 'Saving…' : 'Save Balance'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default LeaveBalancesTab
