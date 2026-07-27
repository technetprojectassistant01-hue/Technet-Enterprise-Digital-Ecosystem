import { useCallback, useEffect, useState } from 'react'
import * as api from '../../lib/api'
import type { LeaveType } from '../../lib/api'
import { TableSkeleton } from '../../dashboard/ui'
import LeaveRequestsTab from './LeaveRequestsTab'
import LeaveBalancesTab from './LeaveBalancesTab'
import LeaveTypesTab from './LeaveTypesTab'

type View = 'requests' | 'balances' | 'types'

const VIEWS: { key: View; label: string }[] = [
  { key: 'requests', label: 'Requests' },
  { key: 'balances', label: 'Balances' },
  { key: 'types', label: 'Leave Types' },
]

function LeavePage() {
  const [view, setView] = useState<View>('requests')
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)

  const loadTypes = useCallback(() => {
    // Inactive types are included so the settings view can reactivate them.
    api
      .listLeaveTypes(true)
      .then(({ leaveTypes }) => setLeaveTypes(leaveTypes))
      .catch(() => setLeaveTypes([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(loadTypes, [loadTypes])

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
      ) : (
        <LeaveTypesTab leaveTypes={leaveTypes} onChanged={loadTypes} />
      )}
    </div>
  )
}

export default LeavePage
