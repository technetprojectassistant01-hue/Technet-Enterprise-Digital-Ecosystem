import { Outlet } from 'react-router-dom'
import { Lock } from 'lucide-react'
import ModuleHeader from '../dashboard/ModuleHeader'
import { EmptyState } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, NON_HR_ROLES, HR_ROLES, WORKFORCE_VIEW_ROLES } from '../lib/permissions'
import type { Role } from '../lib/api'
import { navLabel, useT } from '../i18n'

/**
 * Technet HR — everything about people in one module (2026-09-16).
 *
 * Employees, Leave and Certifications used to sit under Technet ERP while Attendance, Overtime,
 * Validations, Payroll and Availability sat under Technet Workforce, so one HR officer’s job was
 * split across two unrelated top-level menus. Nothing about who may do what changed in the move:
 * each tab keeps the role group its own API already enforces, and a tab a person cannot use is
 * left out rather than shown as a dead link.
 */
const TABS: { label: string; to: string; end?: boolean; visible: (role?: Role) => boolean }[] = [
  // Overview and Employees read at the same breadth the API allows, minus the roles with no
  // business in HR at all.
  { label: 'Overview', to: '/dashboard/hr', end: true, visible: (r) => !hasRole(r, NON_HR_ROLES) },
  { label: 'Employees', to: '/dashboard/hr/employees', visible: (r) => !hasRole(r, NON_HR_ROLES) },
  { label: 'Leave', to: '/dashboard/hr/leave', visible: (r) => hasRole(r, HR_ROLES) },
  { label: 'Overtime', to: '/dashboard/hr/overtime', visible: (r) => hasRole(r, HR_ROLES) },
  { label: 'Validations', to: '/dashboard/hr/validations', visible: (r) => hasRole(r, HR_ROLES) },
  { label: 'Payroll', to: '/dashboard/hr/payroll', visible: (r) => hasRole(r, HR_ROLES) },
  { label: 'Certifications', to: '/dashboard/hr/certifications', visible: (r) => hasRole(r, HR_ROLES) },
  // Operations consults this before assigning a job, which is why it is not HR-only.
  { label: 'Availability', to: '/dashboard/hr/availability', visible: (r) => hasRole(r, WORKFORCE_VIEW_ROLES) },
]

function HrModuleLayout() {
  const t = useT()
  const { user } = useAuth()
  const tabs = TABS.filter((tab) => tab.visible(user?.role))

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Technet HR"
        subtitle={t.hr.subtitle}
        tabs={tabs.map((tab) => ({ label: navLabel(t, tab.label), to: tab.to, end: tab.end }))}
        searchPlaceholder={t.hr.searchPlaceholder}
      />
      {tabs.length > 0 ? <Outlet /> : <EmptyState icon={Lock} message={t.workforce.restricted} />}
    </div>
  )
}

export default HrModuleLayout
