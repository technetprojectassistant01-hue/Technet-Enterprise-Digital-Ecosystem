import { Navigate, Route, Routes } from 'react-router-dom'
import { Wrench, Share2, Workflow, Users, Megaphone, LineChart, ShieldCheck } from 'lucide-react'
import Login from './Login'
import ForgotPassword from './ForgotPassword'
import Dashboard from './Dashboard'
import DashboardHome from './DashboardHome'
import TechnetErpPage from './TechnetErpPage'
import ModuleStub from './dashboard/ModuleStub'
import UsersPage from './UsersPage'
import SettingsPage from './SettingsPage'
import ProtectedRoute from './ProtectedRoute'
import AdminRoute from './AdminRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<DashboardHome />} />
          <Route path="erp" element={<TechnetErpPage />} />
          <Route
            path="maintenance"
            element={<ModuleStub title="Technet Maintenance" icon={Wrench} />}
          />
          <Route
            path="connect"
            element={<ModuleStub title="Technet Connect" icon={Share2} />}
          />
          <Route
            path="operations"
            element={<ModuleStub title="Technet Operations" icon={Workflow} />}
          />
          <Route
            path="workforce"
            element={<ModuleStub title="Technet Workforce" icon={Users} />}
          />
          <Route
            path="marketing"
            element={<ModuleStub title="Technet Digital Marketing" icon={Megaphone} />}
          />
          <Route
            path="insight"
            element={<ModuleStub title="Technet Insight" icon={LineChart} />}
          />
          <Route
            path="security"
            element={<ModuleStub title="Security" icon={ShieldCheck} />}
          />
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
