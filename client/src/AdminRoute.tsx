import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

export default function AdminRoute({ allowHr = false }: { allowHr?: boolean }) {
  const { user } = useAuth()

  if (user?.role !== 'ADMIN' && !(allowHr && user?.role === 'HR_OFFICER')) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
