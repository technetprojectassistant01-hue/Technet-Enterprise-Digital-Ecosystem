import { useCallback, useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import * as api from '../../lib/api'
import type { LeaveType } from '../../lib/api'
import { EmptyState, TableSkeleton } from '../../dashboard/ui'
import { useAuth } from '../../context/AuthContext'
import { hasRole, HR_ROLES } from '../../lib/permissions'
import LeaveRequestsTab from './LeaveRequestsTab'
import LeaveBalancesTab from './LeaveBalancesTab'
import LeaveTypesTab from './LeaveTypesTab'
import HolidaysTab from './HolidaysTab'

type View = 'requests' | 'balances' | 'types' | 'holidays'

const VIEWS: { key: View; label: string }[] = [
  { key: 'requests', label: 'Requests' },
  { key: 'balances', label: 'Balances' },
  { key: 'types', label: 'Leave Types' },
  { key: 'holidays', label: 'Public Holidays' },
]

function LeavePage() {
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, HR_ROLES)

  const [view, setView] = useState<View>('requests')
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)

  const loadTypes = useCallback(() => {
    if (!canAccess) return
    // Inactive types are included so the settings view can reactivate them.
    api
      .listLeaveTypes(true)
      .then(({ leaveTypes }) => setLeaveTypes(leaveTypes))
      .catch(() => setLeaveTypes([]))
      .finally(() => setLoading(false))
  }, [canAccess])

  useEffect(loadTypes, [loadTypes])

  if (!canAccess) {
    return <EmptyState icon={Lock} message="This section is restricted to HR staff." />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === v.key
                ? 'bg-cyan-accent/10 text-cyan-accent'
                : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : view === 'requests' ? (
        <LeaveRequestsTab leaveTypes={leaveTypes} />
      ) : view === 'balances' ? (
        <LeaveBalancesTab leaveTypes={leaveTypes} />
      ) : view === 'types' ? (
        <LeaveTypesTab leaveTypes={leaveTypes} onChanged={loadTypes} />
      ) : (
        <HolidaysTab />
      )}
    </div>
  )
}

export default LeavePage
