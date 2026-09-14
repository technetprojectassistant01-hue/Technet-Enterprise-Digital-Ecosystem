import { useCallback, useEffect, useState } from 'react'
import * as api from './lib/api'
import type { LeaveType } from './lib/api'
import { TableSkeleton } from './dashboard/ui'
import LeaveRequestsTab from './erp/hr/LeaveRequestsTab'
import { useT } from './i18n'

type View = 'pending' | 'all'

/**
 * Admin's leave screen, in place of My Leave in the admin menu: requests awaiting approval, and
 * every leave request. Both reuse the HR requests table (approve, reject, edit, cancel), so the
 * rules are identical to Technet ERP → HR → Leave. Guarded by AdminRoute in App.tsx.
 */
function LeaveApprovalsPage() {
  const t = useT()
  const [view, setView] = useState<View>('pending')
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)

  const loadTypes = useCallback(() => {
    api
      .listLeaveTypes(true)
      .then(({ leaveTypes }) => setLeaveTypes(leaveTypes))
      .catch(() => setLeaveTypes([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(loadTypes, [loadTypes])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">{t.leaveApprovals.title}</h1>
        <p className="mt-1 text-sm text-ink-300">{t.leaveApprovals.subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['pending', 'all'] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === v ? 'bg-cyan-accent/10 text-cyan-accent' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
            }`}
          >
            {v === 'pending' ? t.leaveApprovals.pending : t.leaveApprovals.all}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : view === 'pending' ? (
        <LeaveRequestsTab key="pending" leaveTypes={leaveTypes} initialStatus="PENDING" lockStatus />
      ) : (
        <LeaveRequestsTab key="all" leaveTypes={leaveTypes} />
      )}
    </div>
  )
}

export default LeaveApprovalsPage
