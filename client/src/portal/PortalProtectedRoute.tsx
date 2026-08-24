import { Navigate, Outlet } from 'react-router-dom'
import { usePortalAuth } from './PortalAuthContext'

export default function PortalProtectedRoute() {
  const { customer, loading } = usePortalAuth()

  if (loading) return null
  if (!customer) return <Navigate to="/portal/login" replace />

  return <Outlet />
}
