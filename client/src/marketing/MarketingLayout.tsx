import { Outlet } from 'react-router-dom'
import { Lock } from 'lucide-react'
import ModuleHeader from '../dashboard/ModuleHeader'
import { EmptyState } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, MARKETING_ROLES } from '../lib/permissions'

const TABS = [
  { label: 'Campaigns', to: '/dashboard/marketing/campaigns' },
  { label: 'Content Calendar', to: '/dashboard/marketing/calendar' },
]

function MarketingLayout() {
  const { user } = useAuth()

  // Narrower allow-list gate than the outer RoleRoute (FIELD_ONLY_ROLES) that already wraps this
  // route in App.tsx - Phase 1 ownership defaults to Admin + Sales (see roles.ts), not every
  // non-field role.
  if (!hasRole(user?.role, MARKETING_ROLES)) {
    return <EmptyState icon={Lock} message="This module isn't available for your role." />
  }

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Technet Digital Marketing" subtitle="Campaigns" tabs={TABS} searchPlaceholder="Search campaigns..." />
      <Outlet />
    </div>
  )
}

export default MarketingLayout
