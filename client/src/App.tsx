import { Navigate, Route, Routes } from 'react-router-dom'
import {
  Wrench,
  Share2,
  Workflow,
  Users,
  Megaphone,
  LineChart,
  ShieldCheck,
  FileText,
} from 'lucide-react'
import Login from './Login'
import ForgotPassword from './ForgotPassword'
import Dashboard from './Dashboard'
import DashboardHome from './DashboardHome'
import ErpLayout from './erp/ErpLayout'
import TechnetErpPage from './TechnetErpPage'
import InventoryPage from './erp/InventoryPage'
import FinanceLayout from './erp/FinanceLayout'
import CustomersPage from './erp/CustomersPage'
import InvoicesPage from './erp/InvoicesPage'
import ExpensesPage from './erp/ExpensesPage'
import QuotationsPage from './erp/QuotationsPage'
import ContractsPage from './erp/ContractsPage'
import EmployeesPage from './erp/EmployeesPage'
import ProjectsPage from './erp/ProjectsPage'
import ProjectDetailPage from './erp/ProjectDetailPage'
import ProcurementLayout from './erp/ProcurementLayout'
import SuppliersPage from './erp/SuppliersPage'
import RequisitionsPage from './erp/RequisitionsPage'
import RequisitionDetailPage from './erp/RequisitionDetailPage'
import PurchaseOrdersPage from './erp/PurchaseOrdersPage'
import PurchaseOrderDetailPage from './erp/PurchaseOrderDetailPage'
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
          <Route path="erp" element={<ErpLayout />}>
            <Route index element={<TechnetErpPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="finance" element={<FinanceLayout />}>
              <Route index element={<Navigate to="customers" replace />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="quotations" element={<QuotationsPage />} />
              <Route path="contracts" element={<ContractsPage />} />
            </Route>
            <Route path="procurement" element={<ProcurementLayout />}>
              <Route index element={<Navigate to="suppliers" replace />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="requisitions" element={<RequisitionsPage />} />
              <Route path="requisitions/:id" element={<RequisitionDetailPage />} />
              <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
            </Route>
            <Route path="hr" element={<EmployeesPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route
              path="documents"
              element={<ModuleStub title="Document Management" icon={FileText} />}
            />
          </Route>
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
