import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Banknote, Trash2, Download, Lock } from 'lucide-react'
import * as api from '../lib/api'
import type { PayrollRun } from '../lib/api'
import { Panel, StatCard, Modal, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { downloadCsv } from '../lib/csv'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, HR_ROLES } from '../lib/permissions'
import { formatMoney } from '../lib/format'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function PayrollPage() {
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, HR_ROLES)
  const toast = useToast()
  const confirm = useConfirm()
  const now = new Date()
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showProcess, setShowProcess] = useState(false)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    if (!canAccess) {
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .listPayrollRuns()
      .then(({ runs }) => setRuns(runs))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load payroll runs'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [canAccess])

  function openProcess() {
    setYear(now.getFullYear())
    setMonth(now.getMonth() + 1)
    setFormError(null)
    setShowProcess(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    setSubmitting(true)
    try {
      await api.processPayroll(year, month)
      toast.success(`Payroll processed for ${MONTHS[month - 1]} ${year}`)
      setShowProcess(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to process payroll')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(r: PayrollRun) {
    const ok = await confirm({
      title: 'Delete payroll run',
      message: `Delete the payroll run for ${MONTHS[r.month - 1]} ${r.year}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deletePayrollRun(r.id)
      toast.success('Payroll run deleted')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete payroll run')
    }
  }

  const latestTotal = runs[0]?.totalNetPay ?? 0
  const latestCount = runs[0]?.employeeCount ?? 0

  function exportCsv() {
    downloadCsv(
      'payroll-runs',
      [
        { header: 'Period', accessor: (r: PayrollRun) => `${MONTHS[r.month - 1]} ${r.year}` },
        { header: 'Processed By', accessor: (r: PayrollRun) => r.createdBy.name || r.createdBy.email },
        { header: 'Date', accessor: (r: PayrollRun) => r.createdAt.slice(0, 10) },
        { header: 'Employees', accessor: (r: PayrollRun) => r.employeeCount },
        { header: 'Total Net Pay', accessor: (r: PayrollRun) => r.totalNetPay },
      ],
      runs,
    )
  }

  if (!canAccess) {
    return <EmptyState icon={Lock} message="This section is restricted to HR staff." />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Payroll</h1>
          <p className="mt-1 text-sm text-ink-300">Prepare monthly payroll from attendance and approved leave.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button type="button" onClick={openProcess} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            Process Payroll
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="LATEST RUN TOTAL" value={formatMoney(latestTotal)} icon={Banknote} />
        <StatCard label="EMPLOYEES COVERED" value={latestCount} icon={Banknote} />
      </div>

      <Panel title="Payroll Runs">
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : runs.length === 0 ? (
          <EmptyState icon={Banknote} message="No payroll runs yet. Process your first run to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">PERIOD</th>
                  <th className="px-3 py-3 font-semibold">PROCESSED BY</th>
                  <th className="px-3 py-3 font-semibold">DATE</th>
                  <th className="px-3 py-3 font-semibold">EMPLOYEES</th>
                  <th className="px-3 py-3 font-semibold">TOTAL NET PAY</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/workforce/payroll/${r.id}`}
                        className="font-medium text-ink-100 hover:text-cyan-accent hover:underline"
                      >
                        {MONTHS[r.month - 1]} {r.year}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{r.createdBy.name || r.createdBy.email}</td>
                    <td className="px-3 py-3 text-ink-400">{r.createdAt.slice(0, 10)}</td>
                    <td className="px-3 py-3 text-ink-300">{r.employeeCount}</td>
                    <td className="px-3 py-3 text-ink-100">{formatMoney(r.totalNetPay)}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        aria-label="Delete payroll run"
                        className="text-ink-400 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showProcess && (
        <Modal title="Process Payroll" onClose={() => setShowProcess(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>MONTH</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`mt-2 ${inputClass}`}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>YEAR</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>
            <p className="text-xs text-ink-500">
              Computes net pay for every active employee with a basic salary set, from their recorded hours and
              approved unpaid leave for the period.
            </p>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Processing…' : 'Process Payroll'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default PayrollPage
