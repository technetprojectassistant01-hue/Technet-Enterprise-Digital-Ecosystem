import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { isAdminLike } from './lib/permissions'

export default function AdminRoute({ allowHr = false }: { allowHr?: boolean }) {
  const { user } = useAuth()

  if (!isAdminLike(user?.role) && !(allowHr && user?.role === 'HR_OFFICER')) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
