import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, X, Trash2, Banknote, Lock } from 'lucide-react'
import * as api from '../lib/api'
import type { PayrollRunDetail } from '../lib/api'
import { Panel, StatCard, EmptyState, TableSkeleton } from '../dashboard/ui'
import { dangerButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, HR_ROLES } from '../lib/permissions'
import { formatMoney } from '../lib/format'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function PayrollDetailPage() {
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, HR_ROLES)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [run, setRun] = useState<PayrollRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    if (!canAccess || !id) {
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .getPayrollRun(id)
      .then(({ run }) => setRun(run))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load payroll run'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [canAccess, id])

  async function handleDelete() {
    if (!run) return
    const ok = await confirm({
      title: 'Delete payroll run',
      message: `Delete the payroll run for ${MONTHS[run.month - 1]} ${run.year}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deletePayrollRun(run.id)
      toast.success('Payroll run deleted')
      navigate('/dashboard/workforce/payroll')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete payroll run')
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (!canAccess) return <EmptyState icon={Lock} message="This section is restricted to HR staff." />
  if (error || !run) return <EmptyState icon={X} message={error || 'Payroll run not found'} />

  const totalNetPay = run.lines.reduce((sum, l) => sum + Number(l.netPay), 0)

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/workforce/payroll"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Payroll
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">
            {MONTHS[run.month - 1]} {run.year}
          </h1>
          <p className="mt-1 text-sm text-ink-300">
            Processed by {run.createdBy.name || run.createdBy.email} on {run.createdAt.slice(0, 10)}
          </p>
        </div>
        <button type="button" onClick={handleDelete} className={dangerButtonClass}>
          <Trash2 className="h-4 w-4" />
          Delete Run
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="TOTAL NET PAY" value={formatMoney(totalNetPay)} icon={Banknote} />
        <StatCard label="EMPLOYEES" value={run.lines.length} icon={Banknote} />
      </div>

      <Panel title="Payroll Lines">
        {run.lines.length === 0 ? (
          <p className="text-sm text-ink-400">No employees had a basic salary set when this run was processed.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">EMPLOYEE</th>
                  <th className="px-3 py-3 font-semibold">BASIC SALARY</th>
                  <th className="px-3 py-3 font-semibold">HOURS</th>
                  <th className="px-3 py-3 font-semibold">OVERTIME</th>
                  <th className="px-3 py-3 font-semibold">UNPAID LEAVE</th>
                  <th className="px-3 py-3 font-semibold">DEDUCTION</th>
                  <th className="px-3 py-3 font-semibold">NET PAY</th>
                </tr>
              </thead>
              <tbody>
                {run.lines.map((line) => (
                  <tr key={line.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <div className="font-medium text-ink-100">
                        {line.employee.firstName} {line.employee.lastName}
                      </div>
                      <div className="font-mono text-xs text-ink-400">{line.employee.employeeCode}</div>
                    </td>
                    <td className="px-3 py-3 text-ink-300">{formatMoney(line.basicSalary)}</td>
                    <td className="px-3 py-3 text-ink-300">{line.hoursWorked}</td>
                    <td className="px-3 py-3 text-ink-300">{line.overtimeHours}</td>
                    <td className="px-3 py-3 text-ink-300">{line.unpaidLeaveDays}</td>
                    <td className="px-3 py-3 text-red-400">{Number(line.deduction) > 0 ? `-${formatMoney(line.deduction)}` : '—'}</td>
                    <td className="px-3 py-3 font-semibold text-ink-100">{formatMoney(line.netPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

export default PayrollDetailPage
