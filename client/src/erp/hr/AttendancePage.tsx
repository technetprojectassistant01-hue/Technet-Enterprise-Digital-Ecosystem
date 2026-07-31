import { useState } from 'react'
import { Lock } from 'lucide-react'
import { EmptyState } from '../../dashboard/ui'
import { useAuth } from '../../context/AuthContext'
import { hasRole, HR_ROLES } from '../../lib/permissions'
import DailyRegisterTab from './DailyRegisterTab'
import TimesheetTab from './TimesheetTab'

type View = 'register' | 'timesheet'

const VIEWS: { key: View; label: string }[] = [
  { key: 'register', label: 'Daily Register' },
  { key: 'timesheet', label: 'Timesheets' },
]

function AttendancePage() {
  const { user } = useAuth()
  const [view, setView] = useState<View>('register')

  if (!hasRole(user?.role, HR_ROLES)) {
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

      {view === 'register' ? <DailyRegisterTab /> : <TimesheetTab />}
    </div>
  )
}

export default AttendancePage
