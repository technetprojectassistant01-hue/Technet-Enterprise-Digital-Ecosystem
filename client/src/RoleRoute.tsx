import { Outlet } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { EmptyState } from './dashboard/ui'
import { useAuth } from './context/AuthContext'
import { hasRole } from './lib/permissions'
import type { Role } from './lib/api'

function RoleRoute({ blockedRoles }: { blockedRoles: readonly Role[] }) {
  const { user } = useAuth()

  if (hasRole(user?.role, blockedRoles)) {
    return <EmptyState icon={Lock} message="This module isn't available for your role." />
  }

  return <Outlet />
}

export default RoleRoute
