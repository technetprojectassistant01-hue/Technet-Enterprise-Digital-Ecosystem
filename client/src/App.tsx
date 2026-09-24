import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import Login from './Login'
import ForgotPassword from './ForgotPassword'
import ResetPassword from './ResetPassword'
import HelpCenterPage, { HelpCenterContent } from './HelpCenterPage'
import LegalPage, { LegalContent } from './LegalPage'
import Dashboard from './Dashboard'
import DashboardHome from './DashboardHome'
import MyLeavePage from './MyLeavePage'
import LeaveApprovalsPage from './LeaveApprovalsPage'
import MyDocumentsPage from './MyDocumentsPage'
import ErpLayout from './erp/ErpLayout'
import TechnetErpPage from './TechnetErpPage'
import InventoryPage from './erp/InventoryPage'
import CustomersLayout from './erp/CustomersLayout'
import CustomersPage from './erp/CustomersPage'
import QuotationsPage from './erp/QuotationsPage'
import QuotationDetailPage from './erp/QuotationDetailPage'
import QuotationFollowUpPage from './erp/QuotationFollowUpPage'
import ContractsPage from './erp/ContractsPage'
import HrModuleLayout from './hr/HrModuleLayout'
import HrOverviewPage from './hr/HrOverviewPage'
import EmployeesPage from './hr/EmployeesPage'
import EmployeeDetailPage from './hr/EmployeeDetailPage'
import LeavePage from './hr/LeavePage'
import CertificationsPage from './hr/CertificationsPage'
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
import AttendanceAnomaliesPage from './operations/AttendanceAnomaliesPage'
import AuditCheckPage from './operations/AuditCheckPage'
import StoreLayout from './store/StoreLayout'
import ToolsPage from './store/ToolsPage'
import ToolRequestsPage from './store/ToolRequestsPage'
import AvailabilityTab from './hr/AvailabilityTab'
import OvertimePage from './hr/OvertimePage'
import AttendanceValidationPage from './hr/AttendanceValidationPage'
import PayrollPage from './hr/PayrollPage'
import PayrollDetailPage from './hr/PayrollDetailPage'
import MarketingLayout from './marketing/MarketingLayout'
import CampaignsPage from './marketing/CampaignsPage'
import CampaignDetailPage from './marketing/CampaignDetailPage'
import ContentCalendarPage from './marketing/ContentCalendarPage'
import ConnectInfoPage from './ConnectInfoPage'
import SecurityPage from './SecurityPage'
import { PortalAuthProvider } from './portal/PortalAuthContext'
import PortalProtectedRoute from './portal/PortalProtectedRoute'
import PortalLogin from './portal/PortalLogin'
import PortalLayout from './portal/PortalLayout'
import PortalQuotationsPage from './portal/PortalQuotationsPage'
import PortalWorkOrdersPage from './portal/PortalWorkOrdersPage'
import PortalRequestQuotePage from './portal/PortalRequestQuotePage'
import InsightDashboardPage from './insight/InsightDashboardPage'
import UsersPage from './UsersPage'
import SettingsPage from './SettingsPage'
import ProtectedRoute from './ProtectedRoute'
import AdminRoute from './AdminRoute'
import RoleRoute from './RoleRoute'
import { hasRole, ERP_HIDDEN_ROLES, NON_COMMERCIAL_ROLES } from './lib/permissions'
import { useAuth } from './context/AuthContext'

/**
 * A moved detail page keeps its id: /dashboard/erp/hr/employees/abc becomes
 * /dashboard/hr/employees/abc, so a link in an old notification still opens the right record.
 */
/**
 * ERP's landing page is the commercial dashboard — revenue, quotations, customers. A storekeeper
 * reaches ERP for Inventory and Procurement only, so the module opens on Inventory for them
 * rather than on a page they are not allowed to see.
 */
function ErpIndex() {
  const { user } = useAuth()
  if (hasRole(user?.role, NON_COMMERCIAL_ROLES)) return <Navigate to="inventory" replace />
  return <TechnetErpPage />
}

function RedirectEmployee() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/dashboard/hr/employees/${id}`} replace />
}

function RedirectQuotation() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/dashboard/erp/customers/quotations/${id}`} replace />
}

function RedirectPayroll() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/dashboard/hr/payroll/${id}`} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/help" element={<HelpCenterPage />} />
      <Route path="/privacy" element={<LegalPage doc="privacy" />} />
      <Route path="/terms" element={<LegalPage doc="terms" />} />
      <Route path="/security" element={<LegalPage doc="security" />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<DashboardHome />} />
          <Route path="my-leave" element={<MyLeavePage />} />
          <Route path="my-documents" element={<MyDocumentsPage />} />
          <Route path="help" element={<HelpCenterContent />} />
          <Route path="privacy" element={<LegalContent doc="privacy" />} />
          <Route path="terms" element={<LegalContent doc="terms" />} />
          <Route element={<RoleRoute blockedRoles={ERP_HIDDEN_ROLES} />}>
            <Route path="erp" element={<ErpLayout />}>
              {/* Inventory and Procurement are the storekeeper's; the selling half is not. */}
              <Route index element={<ErpIndex />} />
              <Route element={<RoleRoute blockedRoles={NON_COMMERCIAL_ROLES} />}>
                {/* Finance became Customers (2026-09-17): invoices and expenses are kept in
                    QuickBooks, so only the customer side stays. */}
                <Route path="customers" element={<CustomersLayout />}>
                  <Route index element={<CustomersPage />} />
                  <Route path="quotations" element={<QuotationsPage />} />
                  <Route path="quotations/:id" element={<QuotationDetailPage />} />
                  <Route path="follow-up" element={<QuotationFollowUpPage />} />
                  <Route path="contracts" element={<ContractsPage />} />
                </Route>
                {/* Old Finance links, including those in notifications already sent. */}
                <Route path="finance/quotations/:id" element={<RedirectQuotation />} />
                <Route path="finance/quotations" element={<Navigate to="/dashboard/erp/customers/quotations" replace />} />
                <Route path="finance/follow-up" element={<Navigate to="/dashboard/erp/customers/follow-up" replace />} />
                <Route path="finance/contracts" element={<Navigate to="/dashboard/erp/customers/contracts" replace />} />
                <Route path="finance/*" element={<Navigate to="/dashboard/erp/customers" replace />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:id" element={<ProjectDetailPage />} />
                <Route path="documents" element={<DocumentsPage />} />
              </Route>
              {/* Inventory and Procurement stay open to the storekeeper. */}
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="procurement" element={<ProcurementLayout />}>
                <Route index element={<Navigate to="suppliers" replace />} />
                <Route path="suppliers" element={<SuppliersPage />} />
                <Route path="requisitions" element={<RequisitionsPage />} />
                <Route path="requisitions/:id" element={<RequisitionDetailPage />} />
                <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
                <Route path="purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
              </Route>
              {/* HR moved out of ERP into its own Technet HR module (2026-09-16). Old links,
                  including those in notifications already sent, follow it. */}
              <Route path="hr/employees/:id" element={<RedirectEmployee />} />
              <Route path="hr/employees" element={<Navigate to="/dashboard/hr/employees" replace />} />
              <Route path="hr/leave" element={<Navigate to="/dashboard/hr/leave" replace />} />
              <Route path="hr/certifications" element={<Navigate to="/dashboard/hr/certifications" replace />} />
              <Route path="hr/*" element={<Navigate to="/dashboard/hr" replace />} />
            </Route>
          </Route>
          <Route path="store" element={<StoreLayout />}>
            <Route index element={<Navigate to="tools" replace />} />
            <Route path="tools" element={<ToolsPage />} />
            <Route path="requests" element={<ToolRequestsPage />} />
            <Route path="*" element={<Navigate to="tools" replace />} />
          </Route>
          {/* Technet Store used to be Technet Maintenance. Older notifications still link to
              /dashboard/maintenance/... - tool request links keep their page, anything else
              (the removed assets/contracts/schedule screens) lands on the tool register. */}
          <Route path="maintenance/requests" element={<Navigate to="/dashboard/store/requests" replace />} />
          <Route path="maintenance/*" element={<Navigate to="/dashboard/store/tools" replace />} />
          <Route element={<RoleRoute blockedRoles={NON_COMMERCIAL_ROLES} />}>
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
            <Route path="anomalies" element={<AttendanceAnomaliesPage />} />
          </Route>
          <Route path="audit-check" element={<AuditCheckPage />} />
          {/* Technet HR: the people work that used to be split between ERP > HR and Technet
              Workforce. Each tab keeps the role gate its own API already enforces. */}
          <Route path="hr" element={<HrModuleLayout />}>
            <Route index element={<HrOverviewPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="employees/:id" element={<EmployeeDetailPage />} />
            <Route path="leave" element={<LeavePage />} />
            <Route path="overtime" element={<OvertimePage />} />
            <Route path="validations" element={<AttendanceValidationPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="payroll/:id" element={<PayrollDetailPage />} />
            <Route path="certifications" element={<CertificationsPage />} />
            <Route path="availability" element={<AvailabilityTab />} />
          </Route>
          {/* Technet Workforce was folded into Technet HR (2026-09-16). */}
          <Route path="workforce/payroll/:id" element={<RedirectPayroll />} />
          <Route path="workforce/availability" element={<Navigate to="/dashboard/hr/availability" replace />} />
          <Route path="workforce/attendance" element={<Navigate to="/dashboard/hr" replace />} />
          <Route path="workforce/overtime" element={<Navigate to="/dashboard/hr/overtime" replace />} />
          <Route path="workforce/validations" element={<Navigate to="/dashboard/hr/validations" replace />} />
          <Route path="workforce/payroll" element={<Navigate to="/dashboard/hr/payroll" replace />} />
          <Route path="workforce/*" element={<Navigate to="/dashboard/hr" replace />} />
          <Route element={<RoleRoute blockedRoles={NON_COMMERCIAL_ROLES} />}>
            <Route path="marketing" element={<MarketingLayout />}>
              <Route index element={<Navigate to="campaigns" replace />} />
              <Route path="campaigns" element={<CampaignsPage />} />
              <Route path="campaigns/:id" element={<CampaignDetailPage />} />
              <Route path="calendar" element={<ContentCalendarPage />} />
            </Route>
          </Route>
          <Route path="security" element={<SecurityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<AdminRoute />}>
            <Route path="users" element={<UsersPage />} />
            <Route path="insight" element={<InsightDashboardPage />} />
          </Route>
          <Route element={<AdminRoute allowHr />}>
            <Route path="leave-approvals" element={<LeaveApprovalsPage />} />
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
