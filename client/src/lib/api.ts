const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE'

export interface CurrentUser {
  id: string
  email: string
  name: string | null
  role: Role
}

export interface ManagedUser extends CurrentUser {
  createdAt: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }

  return data as T
}

export function login(email: string, password: string) {
  return request<{ user: CurrentUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function logout() {
  return request<{ ok: true }>('/api/auth/logout', { method: 'POST' })
}

export function fetchMe() {
  return request<{ user: CurrentUser }>('/api/auth/me')
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ ok: true }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function listUsers() {
  return request<{ users: ManagedUser[] }>('/api/users')
}

export function createUser(input: { email: string; password: string; name?: string; role: Role }) {
  return request<{ user: ManagedUser }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateUser(
  id: string,
  input: Partial<{ name: string; role: Role; password: string }>,
) {
  return request<{ user: ManagedUser }>(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteUser(id: string) {
  return request<null>(`/api/users/${id}`, { method: 'DELETE' })
}

export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT'

export interface InventoryItem {
  id: string
  sku: string
  name: string
  category: string | null
  unitOfMeasure: string
  quantity: number
  minStockLevel: number
  unitCost: string | null
  location: string | null
  supplierId: string | null
  createdAt: string
  updatedAt: string
}

export interface StockMovement {
  id: string
  inventoryItemId: string
  type: MovementType
  quantity: number
  reason: string | null
  createdById: string
  createdAt: string
}

export function listInventory(params: { search?: string; lowStock?: boolean } = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.lowStock) query.set('lowStock', 'true')
  const qs = query.toString()
  return request<{ items: InventoryItem[] }>(`/api/inventory${qs ? `?${qs}` : ''}`)
}

export function getInventoryItem(id: string) {
  return request<{ item: InventoryItem & { movements: StockMovement[] } }>(`/api/inventory/${id}`)
}

export interface InventoryItemInput {
  sku: string
  name: string
  category?: string
  unitOfMeasure?: string
  quantity?: number
  minStockLevel?: number
  unitCost?: number | null
  location?: string
}

export function createInventoryItem(input: InventoryItemInput) {
  return request<{ item: InventoryItem }>('/api/inventory', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateInventoryItem(id: string, input: Partial<InventoryItemInput>) {
  return request<{ item: InventoryItem }>(`/api/inventory/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteInventoryItem(id: string) {
  return request<null>(`/api/inventory/${id}`, { method: 'DELETE' })
}

export function adjustStock(id: string, input: { type: MovementType; quantity: number; reason?: string }) {
  return request<{ item: InventoryItem }>(`/api/inventory/${id}/adjust`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface CustomerSummary {
  id: string
  name: string
  company: string | null
}

export interface Customer extends CustomerSummary {
  email: string | null
  phone: string | null
  address: string | null
  vatNumber: string | null
  taxNumber: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomerInput {
  name: string
  email?: string
  phone?: string
  company?: string
  address?: string
  vatNumber?: string
  taxNumber?: string
}

export function listCustomers(params: { search?: string } = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  const qs = query.toString()
  return request<{ customers: Customer[] }>(`/api/customers${qs ? `?${qs}` : ''}`)
}

export function createCustomer(input: CustomerInput) {
  return request<{ customer: Customer }>('/api/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateCustomer(id: string, input: Partial<CustomerInput>) {
  return request<{ customer: Customer }>(`/api/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteCustomer(id: string) {
  return request<null>(`/api/customers/${id}`, { method: 'DELETE' })
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'

export interface SalesDocumentCustomer extends CustomerSummary {
  address: string | null
  email: string | null
  phone: string | null
  vatNumber: string | null
  taxNumber: string | null
}

export interface SalesLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: string
}

export interface Invoice {
  id: string
  customerId: string
  customer: SalesDocumentCustomer
  projectId: string | null
  invoiceNumber: string
  status: InvoiceStatus
  vatRate: string
  subtotal: string
  vatAmount: string
  total: string
  poReference: string | null
  terms: string | null
  items: SalesLineItem[]
  issueDate: string
  dueDate: string | null
  paidAt: string | null
  createdAt: string
}

export interface SalesLineItemInput {
  description: string
  quantity: number
  unitPrice: number
}

export interface InvoiceInput {
  customerId: string
  projectId?: string | null
  invoiceNumber: string
  vatRate?: number
  status?: InvoiceStatus
  issueDate?: string
  dueDate?: string
  poReference?: string
  terms?: string
  items: SalesLineItemInput[]
}

export function listInvoices(params: { status?: InvoiceStatus; projectId?: string } = {}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.projectId) query.set('projectId', params.projectId)
  const qs = query.toString()
  return request<{ invoices: Invoice[] }>(`/api/invoices${qs ? `?${qs}` : ''}`)
}

export function getInvoice(id: string) {
  return request<{ invoice: Invoice }>(`/api/invoices/${id}`)
}

export function createInvoice(input: InvoiceInput) {
  return request<{ invoice: Invoice }>('/api/invoices', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface InvoiceUpdateInput {
  status?: InvoiceStatus
  dueDate?: string | null
  projectId?: string | null
  poReference?: string | null
  terms?: string | null
}

export function updateInvoice(id: string, input: InvoiceUpdateInput) {
  return request<{ invoice: Invoice }>(`/api/invoices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteInvoice(id: string) {
  return request<null>(`/api/invoices/${id}`, { method: 'DELETE' })
}

export function invoicePdfUrl(id: string) {
  return `${API_URL}/api/invoices/${id}/pdf`
}

export interface Expense {
  id: string
  category: string
  description: string | null
  amount: string
  date: string
  supplierId: string | null
  supplier: SupplierSummary | null
  projectId: string | null
  createdAt: string
}

export interface ExpenseInput {
  category: string
  description?: string
  amount: number
  date?: string
  projectId?: string | null
  supplierId?: string | null
}

export function listExpenses(params: { category?: string; projectId?: string } = {}) {
  const query = new URLSearchParams()
  if (params.category) query.set('category', params.category)
  if (params.projectId) query.set('projectId', params.projectId)
  const qs = query.toString()
  return request<{ expenses: Expense[] }>(`/api/expenses${qs ? `?${qs}` : ''}`)
}

export function createExpense(input: ExpenseInput) {
  return request<{ expense: Expense }>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateExpense(id: string, input: Partial<ExpenseInput>) {
  return request<{ expense: Expense }>(`/api/expenses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteExpense(id: string) {
  return request<null>(`/api/expenses/${id}`, { method: 'DELETE' })
}

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'

export interface Quotation {
  id: string
  customerId: string
  customer: SalesDocumentCustomer
  quotationNumber: string
  title: string
  status: QuotationStatus
  vatRate: string
  subtotal: string
  vatAmount: string
  total: string
  items: SalesLineItem[]
  issuedAt: string
  expiresAt: string | null
  createdAt: string
}

export interface QuotationInput {
  customerId: string
  quotationNumber: string
  title: string
  vatRate?: number
  status?: QuotationStatus
  expiresAt?: string
  items: SalesLineItemInput[]
}

export function listQuotations(params: { status?: QuotationStatus } = {}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  return request<{ quotations: Quotation[] }>(`/api/quotations${qs ? `?${qs}` : ''}`)
}

export function getQuotation(id: string) {
  return request<{ quotation: Quotation }>(`/api/quotations/${id}`)
}

export function createQuotation(input: QuotationInput) {
  return request<{ quotation: Quotation }>('/api/quotations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface QuotationUpdateInput {
  title?: string
  status?: QuotationStatus
  expiresAt?: string | null
}

export function updateQuotation(id: string, input: QuotationUpdateInput) {
  return request<{ quotation: Quotation }>(`/api/quotations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteQuotation(id: string) {
  return request<null>(`/api/quotations/${id}`, { method: 'DELETE' })
}

export function quotationPdfUrl(id: string) {
  return `${API_URL}/api/quotations/${id}/pdf`
}

export type ContractStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface Contract {
  id: string
  customerId: string
  customer: CustomerSummary
  service: string
  value: string
  status: ContractStatus
  startDate: string | null
  endDate: string | null
  createdAt: string
}

export interface ContractInput {
  customerId: string
  service: string
  value: number
  status?: ContractStatus
  startDate?: string
  endDate?: string
}

export function listContracts(params: { status?: ContractStatus } = {}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  return request<{ contracts: Contract[] }>(`/api/contracts${qs ? `?${qs}` : ''}`)
}

export function createContract(input: ContractInput) {
  return request<{ contract: Contract }>('/api/contracts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateContract(id: string, input: Partial<Omit<ContractInput, 'customerId'>>) {
  return request<{ contract: Contract }>(`/api/contracts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteContract(id: string) {
  return request<null>(`/api/contracts/${id}`, { method: 'DELETE' })
}

export type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED'

export interface EmployeeSummary {
  id: string
  firstName: string
  lastName: string
  position: string | null
}

export interface Employee extends EmployeeSummary {
  employeeCode: string
  email: string | null
  phone: string | null
  department: string | null
  employmentStatus: EmploymentStatus
  hireDate: string | null
  userId: string | null
  createdAt: string
  updatedAt: string
}

export interface EmployeeInput {
  employeeCode: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  position?: string
  department?: string
  employmentStatus?: EmploymentStatus
  hireDate?: string
}

export function listEmployees(params: { search?: string } = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  const qs = query.toString()
  return request<{ employees: Employee[] }>(`/api/employees${qs ? `?${qs}` : ''}`)
}

export function createEmployee(input: EmployeeInput) {
  return request<{ employee: Employee }>('/api/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateEmployee(id: string, input: Partial<EmployeeInput>) {
  return request<{ employee: Employee }>(`/api/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteEmployee(id: string) {
  return request<null>(`/api/employees/${id}`, { method: 'DELETE' })
}

export type ProjectStatus =
  | 'QUOTED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CLOSED'
  | 'CANCELLED'

export type ServiceCategory = 'ELECTRICAL' | 'ELV_SECURITY' | 'MECHANICAL' | 'PLUMBING' | 'SAFETY' | 'OTHER'

export interface ProjectSummary {
  id: string
  name: string
}

export interface Project extends ProjectSummary {
  customerId: string | null
  customer: CustomerSummary | null
  contractId: string | null
  description: string | null
  serviceCategory: ServiceCategory
  status: ProjectStatus
  startDate: string | null
  endDate: string | null
  budget: string | null
  managerId: string | null
  manager: EmployeeSummary | null
  createdAt: string
  updatedAt: string
}

export interface ProjectAssignment {
  id: string
  projectId: string
  employeeId: string
  employee: EmployeeSummary
  roleOnProject: string | null
  assignedAt: string
}

export interface ProjectStatusHistoryEntry {
  id: string
  projectId: string
  fromStatus: ProjectStatus | null
  toStatus: ProjectStatus
  note: string | null
  createdAt: string
  changedBy: { id: string; name: string | null; email: string }
}

export interface ProjectDetail extends Project {
  assignments: ProjectAssignment[]
  invoices: Invoice[]
  expenses: Expense[]
  statusHistory: ProjectStatusHistoryEntry[]
}

export interface ProjectInput {
  name: string
  customerId?: string | null
  contractId?: string | null
  description?: string
  serviceCategory?: ServiceCategory
  budget?: number | null
  startDate?: string
  endDate?: string
  managerId?: string | null
}

export function listProjects(params: { search?: string; status?: ProjectStatus } = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  return request<{ projects: Project[] }>(`/api/projects${qs ? `?${qs}` : ''}`)
}

export function getProject(id: string) {
  return request<{ project: ProjectDetail }>(`/api/projects/${id}`)
}

export function createProject(input: ProjectInput) {
  return request<{ project: Project }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateProject(id: string, input: Partial<ProjectInput>) {
  return request<{ project: Project }>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function updateProjectStatus(id: string, status: ProjectStatus, note?: string) {
  return request<{ project: Project }>(`/api/projects/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  })
}

export function assignToProject(id: string, employeeId: string, roleOnProject?: string) {
  return request<{ assignment: ProjectAssignment }>(`/api/projects/${id}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ employeeId, roleOnProject }),
  })
}

export function unassignFromProject(id: string, employeeId: string) {
  return request<null>(`/api/projects/${id}/assignments/${employeeId}`, { method: 'DELETE' })
}

export interface SupplierSummary {
  id: string
  name: string
}

export interface Supplier extends SupplierSummary {
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  paymentTerms: string | null
  createdAt: string
  updatedAt: string
}

export interface SupplierInput {
  name: string
  contactName?: string
  email?: string
  phone?: string
  address?: string
  paymentTerms?: string
}

export function listSuppliers(params: { search?: string } = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  const qs = query.toString()
  return request<{ suppliers: Supplier[] }>(`/api/suppliers${qs ? `?${qs}` : ''}`)
}

export function createSupplier(input: SupplierInput) {
  return request<{ supplier: Supplier }>('/api/suppliers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateSupplier(id: string, input: Partial<SupplierInput>) {
  return request<{ supplier: Supplier }>(`/api/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteSupplier(id: string) {
  return request<null>(`/api/suppliers/${id}`, { method: 'DELETE' })
}

export type RequisitionStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED'

export interface RequisitionLineItem {
  id: string
  description: string
  quantity: number
  inventoryItemId: string | null
  inventoryItem?: { id: string; sku: string; name: string } | null
}

export interface Requisition {
  id: string
  requisitionNumber: string
  projectId: string | null
  project: ProjectSummary | null
  requestedById: string
  requestedBy: { id: string; name: string | null; email: string }
  status: RequisitionStatus
  neededByDate: string | null
  notes: string | null
  items: RequisitionLineItem[]
  createdAt: string
  updatedAt: string
}

export interface RequisitionStatusHistoryEntry {
  id: string
  fromStatus: RequisitionStatus | null
  toStatus: RequisitionStatus
  note: string | null
  createdAt: string
  changedBy: { id: string; name: string | null; email: string }
}

export interface RequisitionDetail extends Requisition {
  statusHistory: RequisitionStatusHistoryEntry[]
  purchaseOrders: { id: string; poNumber: string; status: PurchaseOrderStatus }[]
}

export interface RequisitionItemInput {
  description: string
  quantity: number
  inventoryItemId?: string
}

export interface RequisitionInput {
  requisitionNumber: string
  projectId?: string
  neededByDate?: string
  notes?: string
  items: RequisitionItemInput[]
}

export function listRequisitions(params: { search?: string; status?: RequisitionStatus; projectId?: string } = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.projectId) query.set('projectId', params.projectId)
  const qs = query.toString()
  return request<{ requisitions: Requisition[] }>(`/api/requisitions${qs ? `?${qs}` : ''}`)
}

export function getRequisition(id: string) {
  return request<{ requisition: RequisitionDetail }>(`/api/requisitions/${id}`)
}

export function createRequisition(input: RequisitionInput) {
  return request<{ requisition: Requisition }>('/api/requisitions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function approveRequisition(id: string, note?: string) {
  return request<{ requisition: Requisition }>(`/api/requisitions/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function rejectRequisition(id: string, note: string) {
  return request<{ requisition: Requisition }>(`/api/requisitions/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function convertRequisitionToPO(
  id: string,
  input: { supplierId: string; poNumber: string; expectedDate?: string; items: { requisitionItemId: string; unitCost: number }[] },
) {
  return request<{ purchaseOrder: PurchaseOrder }>(`/api/requisitions/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteRequisition(id: string) {
  return request<null>(`/api/requisitions/${id}`, { method: 'DELETE' })
}

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CLOSED' | 'CANCELLED'

export interface PurchaseOrderLineItem {
  id: string
  description: string
  quantity: number
  unitCost: string
  inventoryItemId: string | null
  inventoryItem?: { id: string; sku: string; name: string } | null
  goodsReceiptItems?: { id: string; quantityReceived: number }[]
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  supplierId: string
  supplier: SupplierSummary
  requisitionId: string | null
  status: PurchaseOrderStatus
  orderDate: string
  expectedDate: string | null
  totalAmount: string
  items: PurchaseOrderLineItem[]
  createdAt: string
  updatedAt: string
}

export interface GoodsReceiptItem {
  id: string
  purchaseOrderItemId: string
  quantityReceived: number
}

export interface GoodsReceipt {
  id: string
  purchaseOrderId: string
  receivedBy: { id: string; name: string | null; email: string }
  notes: string | null
  items: GoodsReceiptItem[]
  createdAt: string
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  requisition: { id: string; requisitionNumber: string } | null
  goodsReceipts: GoodsReceipt[]
}

export interface PurchaseOrderItemInput {
  description: string
  quantity: number
  unitCost: number
  inventoryItemId?: string
}

export interface PurchaseOrderInput {
  supplierId: string
  poNumber: string
  expectedDate?: string
  items: PurchaseOrderItemInput[]
}

export function listPurchaseOrders(params: { search?: string; status?: PurchaseOrderStatus; supplierId?: string } = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.supplierId) query.set('supplierId', params.supplierId)
  const qs = query.toString()
  return request<{ purchaseOrders: PurchaseOrder[] }>(`/api/purchase-orders${qs ? `?${qs}` : ''}`)
}

export function getPurchaseOrder(id: string) {
  return request<{ purchaseOrder: PurchaseOrderDetail }>(`/api/purchase-orders/${id}`)
}

export function createPurchaseOrder(input: PurchaseOrderInput) {
  return request<{ purchaseOrder: PurchaseOrder }>('/api/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function sendPurchaseOrder(id: string) {
  return request<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}/send`, { method: 'POST' })
}

export function cancelPurchaseOrder(id: string) {
  return request<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}/cancel`, { method: 'POST' })
}

export function closePurchaseOrder(id: string) {
  return request<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}/close`, { method: 'POST' })
}

export function receivePurchaseOrder(
  id: string,
  input: { items: { purchaseOrderItemId: string; quantityReceived: number }[]; notes?: string },
) {
  return request<{ goodsReceipt: GoodsReceipt }>(`/api/purchase-orders/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deletePurchaseOrder(id: string) {
  return request<null>(`/api/purchase-orders/${id}`, { method: 'DELETE' })
}

// ---------- Field Service Operations ----------

export type JobCategory =
  | 'INSTALLATION'
  | 'START_UP_COMMISSIONING'
  | 'OUTDOOR_REPAIR'
  | 'WORKSHOP_REPAIR'
  | 'SERVICING'
  | 'MAINTENANCE_CONTRACT'
  | 'SURVEY'
  | 'OTHERS'

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  INSTALLATION: 'Installation',
  START_UP_COMMISSIONING: 'Start Up & Commissioning',
  OUTDOOR_REPAIR: 'Outdoor Repair',
  WORKSHOP_REPAIR: 'Workshop Repair',
  SERVICING: 'Servicing',
  MAINTENANCE_CONTRACT: 'Maintenance Contract',
  SURVEY: 'Survey',
  OTHERS: 'Others',
}

export type WorkOrderStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type WarrantyStatus = 'YES' | 'NO' | 'UNKNOWN'
export type ReportStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export interface WorkOrderCustomer extends CustomerSummary {
  address: string | null
}

export interface WorkOrder {
  id: string
  workOrderNumber: string
  customerId: string
  customer: WorkOrderCustomer
  projectId: string | null
  title: string
  jobCategory: JobCategory
  description: string | null
  status: WorkOrderStatus
  scheduledDate: string
  technicians: { id: string; employee: EmployeeSummary }[]
  createdAt: string
  updatedAt: string
}

export interface WorkOrderDetail extends WorkOrder {
  project: { id: string; name: string } | null
  interventionReports: {
    id: string
    interventionNumber: string
    status: ReportStatus
    workCompleted: boolean
    createdAt: string
  }[]
}

export interface WorkOrderInput {
  customerId: string
  projectId?: string | null
  workOrderNumber: string
  title: string
  jobCategory: JobCategory
  description?: string
  scheduledDate: string
  technicianIds: string[]
}

export function listWorkOrders(params: { status?: WorkOrderStatus; customerId?: string; technicianId?: string } = {}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.technicianId) query.set('technicianId', params.technicianId)
  const qs = query.toString()
  return request<{ workOrders: WorkOrder[] }>(`/api/work-orders${qs ? `?${qs}` : ''}`)
}

export function getWorkOrder(id: string) {
  return request<{ workOrder: WorkOrderDetail }>(`/api/work-orders/${id}`)
}

export function createWorkOrder(input: WorkOrderInput) {
  return request<{ workOrder: WorkOrder }>('/api/work-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface WorkOrderUpdateInput {
  title?: string
  description?: string | null
  scheduledDate?: string
  status?: WorkOrderStatus
  technicianIds?: string[]
}

export function updateWorkOrder(id: string, input: WorkOrderUpdateInput) {
  return request<{ workOrder: WorkOrder }>(`/api/work-orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteWorkOrder(id: string) {
  return request<null>(`/api/work-orders/${id}`, { method: 'DELETE' })
}

export interface DailyWorkReport {
  id: string
  date: string
  summary: string
  hours: string | null
  status: ReportStatus
  submittedBy: { id: string; name: string | null; email: string }
  reviewedBy: { id: string; name: string | null; email: string } | null
  reviewedAt: string | null
  reviewNote: string | null
  technicians: { id: string; employee: EmployeeSummary }[]
  workOrders: { id: string; workOrder: { id: string; workOrderNumber: string; title: string } }[]
  createdAt: string
}

export interface DailyWorkReportInput {
  date: string
  summary: string
  hours?: number
  technicianIds: string[]
  workOrderIds: string[]
}

export function listDailyReports(params: { status?: ReportStatus } = {}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  return request<{ dailyWorkReports: DailyWorkReport[] }>(`/api/daily-reports${qs ? `?${qs}` : ''}`)
}

export function createDailyReport(input: DailyWorkReportInput) {
  return request<{ dailyWorkReport: DailyWorkReport }>('/api/daily-reports', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function approveDailyReport(id: string, note?: string) {
  return request<{ dailyWorkReport: DailyWorkReport }>(`/api/daily-reports/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function rejectDailyReport(id: string, note?: string) {
  return request<{ dailyWorkReport: DailyWorkReport }>(`/api/daily-reports/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function deleteDailyReport(id: string) {
  return request<null>(`/api/daily-reports/${id}`, { method: 'DELETE' })
}

export const WORK_TYPE_LABELS: Record<ServiceCategory, string> = {
  ELECTRICAL: 'Electrical',
  ELV_SECURITY: 'ELV & Security',
  MECHANICAL: 'Mechanical',
  PLUMBING: 'Plumbing',
  SAFETY: 'Safety',
  OTHER: 'Other',
}

export type ReminderInterval = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL'

export const REMINDER_INTERVAL_LABELS: Record<ReminderInterval, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Every 3 Months',
  SEMI_ANNUAL: 'Every 6 Months',
}

export type PhotoKind = 'EQUIPMENT' | 'WORK_DONE'

export interface InterventionReportPhoto {
  id: string
  kind: PhotoKind
  fileName: string
  mimeType: string
  createdAt: string
}

export interface InterventionReport {
  id: string
  interventionNumber: string
  customerId: string
  customer: WorkOrderCustomer
  workOrderId: string | null
  workOrder: { id: string; workOrderNumber: string; title: string } | null
  date: string
  contactPerson: string | null
  contactPhone: string | null
  contactEmail: string | null
  jobCategory: JobCategory
  workType: ServiceCategory
  equipment: string | null
  make: string | null
  model: string | null
  serialNo: string | null
  dateInstalled: string | null
  natureOfIntervention: string
  actionTaken: string
  workCompleted: boolean
  incompleteDetails: string | null
  timeIn: string | null
  timeOut: string | null
  warrantyStatus: WarrantyStatus | null
  technicianReport: string | null
  comments: string | null
  additionalInfo: string | null
  reminderInterval: ReminderInterval | null
  nextReminderAt: string | null
  signedByName: string | null
  signedAt: string | null
  attachmentFileName: string | null
  attachmentMimeType: string | null
  status: ReportStatus
  createdBy: { id: string; name: string | null; email: string }
  reviewedBy: { id: string; name: string | null; email: string } | null
  reviewedAt: string | null
  reviewNote: string | null
  technicians: { id: string; employee: EmployeeSummary }[]
  photos: InterventionReportPhoto[]
  createdAt: string
  updatedAt: string
}

export interface InterventionReportInput {
  customerId: string
  workOrderId?: string
  date?: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  jobCategory: JobCategory
  workType: ServiceCategory
  equipment?: string
  make?: string
  model?: string
  serialNo?: string
  dateInstalled?: string
  natureOfIntervention: string
  actionTaken: string
  workCompleted: boolean
  incompleteDetails?: string
  timeIn?: string
  timeOut?: string
  warrantyStatus?: WarrantyStatus
  technicianReport?: string
  comments?: string
  additionalInfo?: string
  technicianIds: string[]
  signedByName?: string
  signatureData?: string
  attachmentData?: string
  attachmentFileName?: string
}

export function listInterventionReports(
  params: { status?: ReportStatus; workOrderId?: string; customerId?: string; dueRemindersOnly?: boolean } = {},
) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.workOrderId) query.set('workOrderId', params.workOrderId)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.dueRemindersOnly) query.set('dueRemindersOnly', 'true')
  const qs = query.toString()
  return request<{ interventionReports: InterventionReport[] }>(`/api/intervention-reports${qs ? `?${qs}` : ''}`)
}

export function getInterventionReport(id: string) {
  return request<{ interventionReport: InterventionReport }>(`/api/intervention-reports/${id}`)
}

export function createInterventionReport(input: InterventionReportInput) {
  return request<{ interventionReport: InterventionReport }>('/api/intervention-reports', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function linkWorkOrderToInterventionReport(id: string, workOrderId: string | null) {
  return request<{ interventionReport: InterventionReport }>(`/api/intervention-reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ workOrderId }),
  })
}

export function setInterventionReportReminder(id: string, interval: ReminderInterval | null) {
  return request<{ interventionReport: InterventionReport }>(`/api/intervention-reports/${id}/reminder`, {
    method: 'POST',
    body: JSON.stringify({ interval }),
  })
}

export function approveInterventionReport(id: string, note?: string) {
  return request<{ interventionReport: InterventionReport }>(`/api/intervention-reports/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function rejectInterventionReport(id: string, note?: string) {
  return request<{ interventionReport: InterventionReport }>(`/api/intervention-reports/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function deleteInterventionReport(id: string) {
  return request<null>(`/api/intervention-reports/${id}`, { method: 'DELETE' })
}

export function interventionSignatureUrl(id: string) {
  return `${API_URL}/api/intervention-reports/${id}/signature`
}

export function interventionAttachmentUrl(id: string) {
  return `${API_URL}/api/intervention-reports/${id}/attachment`
}

export function uploadInterventionReportPhoto(id: string, input: { kind: PhotoKind; fileData: string; fileName: string }) {
  return request<{ photo: InterventionReportPhoto }>(`/api/intervention-reports/${id}/photos`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteInterventionReportPhoto(id: string, photoId: string) {
  return request<null>(`/api/intervention-reports/${id}/photos/${photoId}`, { method: 'DELETE' })
}

export function interventionPhotoUrl(id: string, photoId: string) {
  return `${API_URL}/api/intervention-reports/${id}/photos/${photoId}`
}

// ---------- Document Management ----------

export type DocumentCategory = 'CONTRACT' | 'INVOICE' | 'HR' | 'PROJECT' | 'GENERAL'

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  CONTRACT: 'Contract',
  INVOICE: 'Invoice',
  HR: 'HR',
  PROJECT: 'Project',
  GENERAL: 'General',
}

export interface Document {
  id: string
  title: string
  category: DocumentCategory
  fileName: string
  mimeType: string
  sizeBytes: number
  projectId: string | null
  project: { id: string; name: string } | null
  customerId: string | null
  customer: CustomerSummary | null
  uploadedBy: { id: string; name: string | null; email: string }
  createdAt: string
}

export interface DocumentInput {
  title: string
  category?: DocumentCategory
  projectId?: string | null
  customerId?: string | null
  fileData: string
  fileName: string
}

export function listDocuments(params: { category?: DocumentCategory; projectId?: string; customerId?: string; search?: string } = {}) {
  const query = new URLSearchParams()
  if (params.category) query.set('category', params.category)
  if (params.projectId) query.set('projectId', params.projectId)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.search) query.set('search', params.search)
  const qs = query.toString()
  return request<{ documents: Document[] }>(`/api/documents${qs ? `?${qs}` : ''}`)
}

export function createDocument(input: DocumentInput) {
  return request<{ document: Document }>('/api/documents', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface DocumentUpdateInput {
  title?: string
  category?: DocumentCategory
  projectId?: string | null
  customerId?: string | null
}

export function updateDocument(id: string, input: DocumentUpdateInput) {
  return request<{ document: Document }>(`/api/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteDocument(id: string) {
  return request<null>(`/api/documents/${id}`, { method: 'DELETE' })
}

export function documentDownloadUrl(id: string) {
  return `${API_URL}/api/documents/${id}/download`
}
