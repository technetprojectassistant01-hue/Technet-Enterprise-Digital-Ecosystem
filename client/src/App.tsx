import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import Login from './Login'
import ForgotPassword from './ForgotPassword'
import ResetPassword from './ResetPassword'
import Dashboard from './Dashboard'
import DashboardHome from './DashboardHome'
import ErpLayout from './erp/ErpLayout'
import TechnetErpPage from './TechnetErpPage'
import InventoryPage from './erp/InventoryPage'
import FinanceLayout from './erp/FinanceLayout'
import CustomersPage from './erp/CustomersPage'
import InvoicesPage from './erp/InvoicesPage'
import InvoiceDetailPage from './erp/InvoiceDetailPage'
import ExpensesPage from './erp/ExpensesPage'
import QuotationsPage from './erp/QuotationsPage'
import QuotationDetailPage from './erp/QuotationDetailPage'
import QuotationFollowUpPage from './erp/QuotationFollowUpPage'
import ContractsPage from './erp/ContractsPage'
import HrLayout from './erp/hr/HrLayout'
import HrOverviewPage from './erp/hr/HrOverviewPage'
import EmployeesPage from './erp/hr/EmployeesPage'
import EmployeeDetailPage from './erp/hr/EmployeeDetailPage'
import LeavePage from './erp/hr/LeavePage'
import CertificationsPage from './erp/hr/CertificationsPage'
import ProjectsPage from './erp/ProjectsPage'
import ProjectDetailPage from './erp/ProjectDetailPage'
import ProcurementLayout from './erp/ProcurementLayout'
import SuppliersPage from './erp/SuppliersPage'
import RequisitionsPage from './erp/RequisitionsPage'
import RequisitionDetailPage from './erp/RequisitionDetailPage'
import PurchaseOrdersPage from './erp/PurchaseOrdersPage'
import PurchaseOrderDetailPage from './erp/PurchaseOrderDetailPage'
import DocumentsPage from './erp/DocumentsPage'
import OperationsLayout from './operations/OperationsLayout'
import WorkOrdersPage from './operations/WorkOrdersPage'
import WorkOrderDetailPage from './operations/WorkOrderDetailPage'
import DailyReportsPage from './operations/DailyReportsPage'
import InterventionReportsPage from './operations/InterventionReportsPage'
import InterventionReportFormPage from './operations/InterventionReportFormPage'
import InterventionReportDetailPage from './operations/InterventionReportDetailPage'
import TeamAttendancePage from './operations/TeamAttendancePage'
import FieldOperationsPage from './operations/FieldOperationsPage'
import MaintenanceLayout from './maintenance/MaintenanceLayout'
import AssetsPage from './maintenance/AssetsPage'
import AssetDetailPage from './maintenance/AssetDetailPage'
import MaintenanceContractsPage from './maintenance/ContractsPage'
import RequestsPage from './maintenance/RequestsPage'
import SchedulePage from './maintenance/SchedulePage'
import ScheduleDetailPage from './maintenance/ScheduleDetailPage'
import WorkforceLayout from './workforce/WorkforceLayout'
import AvailabilityTab from './workforce/AvailabilityTab'
import AttendancePage from './workforce/AttendancePage'
import PayrollPage from './workforce/PayrollPage'
import PayrollDetailPage from './workforce/PayrollDetailPage'
import ModuleStub from './dashboard/ModuleStub'
import ConnectInfoPage from './ConnectInfoPage'
import SecurityPage from './SecurityPage'
import { PortalAuthProvider } from './portal/PortalAuthContext'
import PortalProtectedRoute from './portal/PortalProtectedRoute'
import PortalLogin from './portal/PortalLogin'
import PortalLayout from './portal/PortalLayout'
import PortalQuotationsPage from './portal/PortalQuotationsPage'
import PortalInvoicesPage from './portal/PortalInvoicesPage'
import PortalWorkOrdersPage from './portal/PortalWorkOrdersPage'
import PortalRequestQuotePage from './portal/PortalRequestQuotePage'
import InsightDashboardPage from './insight/InsightDashboardPage'
import UsersPage from './UsersPage'
import SettingsPage from './SettingsPage'
import ProtectedRoute from './ProtectedRoute'
import AdminRoute from './AdminRoute'
import RoleRoute from './RoleRoute'
import { FIELD_ONLY_ROLES } from './lib/permissions'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<DashboardHome />} />
          <Route element={<RoleRoute blockedRoles={FIELD_ONLY_ROLES} />}>
            <Route path="erp" element={<ErpLayout />}>
              <Route index element={<TechnetErpPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="finance" element={<FinanceLayout />}>
                <Route index element={<Navigate to="customers" replace />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="invoices/:id" element={<InvoiceDetailPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="quotations" element={<QuotationsPage />} />
                <Route path="quotations/:id" element={<QuotationDetailPage />} />
                <Route path="follow-up" element={<QuotationFollowUpPage />} />
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
              <Route path="hr" element={<HrLayout />}>
                <Route index element={<HrOverviewPage />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="employees/:id" element={<EmployeeDetailPage />} />
                <Route path="leave" element={<LeavePage />} />
                <Route path="certifications" element={<CertificationsPage />} />
              </Route>
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="documents" element={<DocumentsPage />} />
            </Route>
          </Route>
          <Route path="maintenance" element={<MaintenanceLayout />}>
            <Route index element={<Navigate to="assets" replace />} />
            <Route path="assets" element={<AssetsPage />} />
            <Route path="assets/:id" element={<AssetDetailPage />} />
            <Route path="contracts" element={<MaintenanceContractsPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="schedule/:id" element={<ScheduleDetailPage />} />
          </Route>
          <Route element={<RoleRoute blockedRoles={FIELD_ONLY_ROLES} />}>
            <Route path="connect" element={<ConnectInfoPage />} />
          </Route>
          <Route path="operations" element={<OperationsLayout />}>
            <Route index element={<Navigate to="work-orders" replace />} />
            <Route path="work-orders" element={<WorkOrdersPage />} />
            <Route path="work-orders/:id" element={<WorkOrderDetailPage />} />
            <Route path="daily-reports" element={<DailyReportsPage />} />
            <Route path="intervention-reports" element={<InterventionReportsPage />} />
            <Route path="intervention-reports/new" element={<InterventionReportFormPage />} />
            <Route path="intervention-reports/:id" element={<InterventionReportDetailPage />} />
            <Route path="team-attendance" element={<TeamAttendancePage />} />
            <Route path="field-tracking" element={<FieldOperationsPage />} />
          </Route>
          <Route path="workforce" element={<WorkforceLayout />}>
            <Route index element={<Navigate to="availability" replace />} />
            <Route path="availability" element={<AvailabilityTab />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="payroll/:id" element={<PayrollDetailPage />} />
          </Route>
          <Route element={<RoleRoute blockedRoles={FIELD_ONLY_ROLES} />}>
            <Route
              path="marketing"
              element={<ModuleStub title="Technet Digital Marketing" icon={Megaphone} />}
            />
          </Route>
          <Route path="security" element={<SecurityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<AdminRoute />}>
            <Route path="users" element={<UsersPage />} />
            <Route path="insight" element={<InsightDashboardPage />} />
          </Route>
        </Route>
      </Route>
      {/* Technet Connect - separate auth domain from staff (AuthContext/ProtectedRoute above) */}
      <Route path="/portal" element={<PortalAuthProvider><Outlet /></PortalAuthProvider>}>
        <Route path="login" element={<PortalLogin />} />
        <Route element={<PortalProtectedRoute />}>
          <Route element={<PortalLayout />}>
            <Route index element={<Navigate to="quotations" replace />} />
            <Route path="quotations" element={<PortalQuotationsPage />} />
            <Route path="invoices" element={<PortalInvoicesPage />} />
            <Route path="jobs" element={<PortalWorkOrdersPage />} />
            <Route path="request-quote" element={<PortalRequestQuotePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
