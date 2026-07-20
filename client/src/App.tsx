import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './Login'
import Dashboard from './Dashboard'
import DashboardHome from './DashboardHome'
import UsersPage from './UsersPage'
import SettingsPage from './SettingsPage'
import ProtectedRoute from './ProtectedRoute'
import AdminRoute from './AdminRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<DashboardHome />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<AdminRoute />}>
            <Route path="users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
