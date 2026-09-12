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
import { useT } from '../i18n'

function PayrollDetailPage() {
  const t = useT()
  const months = t.shared.months
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
      .catch((err) => setError(err instanceof Error ? err.message : t.workforce.payrollDetail.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(load, [canAccess, id])

  async function handleDelete() {
    if (!run) return
    const ok = await confirm({
      title: t.workforce.payroll.deleteTitle,
      message: t.workforce.payroll.deleteMessage(`${months[run.month - 1]} ${run.year}`),
      confirmLabel: t.shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deletePayrollRun(run.id)
      toast.success(t.workforce.payroll.deleted)
      navigate('/dashboard/workforce/payroll')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.workforce.payroll.deleteFailed)
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (!canAccess) return <EmptyState icon={Lock} message={t.shared.restrictedToHr} />
  if (error || !run) return <EmptyState icon={X} message={error || t.workforce.payrollDetail.notFound} />

  const totalNetPay = run.lines.reduce((sum, l) => sum + Number(l.netPay), 0)

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/workforce/payroll"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.workforce.payrollDetail.back}
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">
            {months[run.month - 1]} {run.year}
          </h1>
          <p className="mt-1 text-sm text-ink-300">
            {t.workforce.payrollDetail.processedBy(
              run.createdBy.name || run.createdBy.email,
              run.createdAt.slice(0, 10),
            )}
          </p>
        </div>
        <button type="button" onClick={handleDelete} className={dangerButtonClass}>
          <Trash2 className="h-4 w-4" />
          {t.workforce.payrollDetail.deleteRun}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label={t.workforce.payrollDetail.totalNetPay} value={formatMoney(totalNetPay)} icon={Banknote} />
        <StatCard label={t.workforce.payrollDetail.employees} value={run.lines.length} icon={Banknote} />
      </div>

      <Panel title={t.workforce.payrollDetail.lines}>
        {run.lines.length === 0 ? (
          <p className="text-sm text-ink-400">{t.workforce.payrollDetail.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.shared.employeeCol}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.payrollDetail.colBasicSalary}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.payrollDetail.colHours}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.payrollDetail.colOvertime}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.payrollDetail.colUnpaidLeave}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.payrollDetail.colDeduction}</th>
                  <th className="px-3 py-3 font-semibold">{t.workforce.payrollDetail.colNetPay}</th>
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
