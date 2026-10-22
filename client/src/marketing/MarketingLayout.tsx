import { Outlet } from 'react-router-dom'
import { Lock } from 'lucide-react'
import ModuleHeader from '../dashboard/ModuleHeader'
import { EmptyState } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, MARKETING_ROLES } from '../lib/permissions'
import { navLabel, useT } from '../i18n'

function MarketingLayout() {
  const { user } = useAuth()
  const t = useT()
  const m = t.marketing

  // Narrower allow-list gate than the outer RoleRoute (FIELD_ONLY_ROLES) that already wraps this
  // route in App.tsx - Phase 1 ownership defaults to Admin + Sales (see roles.ts), not every
  // non-field role.
  if (!hasRole(user?.role, MARKETING_ROLES)) {
    return <EmptyState icon={Lock} message={t.shell.notAvailableForRole} />
  }

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title={navLabel(t, 'Technet Digital Marketing')}
        subtitle={m.subtitle}
        tabs={[
          { label: m.tabCampaigns, to: '/dashboard/marketing/campaigns' },
          { label: m.tabCalendar, to: '/dashboard/marketing/calendar' },
        ]}
        searchPlaceholder={m.searchPlaceholder}
      />
      <Outlet />
    </div>
  )
}

export default MarketingLayout
