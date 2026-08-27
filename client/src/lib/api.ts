const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export type Role =
  | 'ADMIN'
  | 'SALES_OFFICER'
  | 'FINANCE_OFFICER'
  | 'STOREKEEPER'
  | 'HR_OFFICER'
  | 'OPERATIONS_MANAGER'
  | 'FIELD_TECHNICIAN'
  | 'EMPLOYEE'

export interface CurrentUser {
  id: string
  email: string
  name: string | null
  role: Role
  employeeId: string | null
}

export interface ManagedUser extends CurrentUser {
  createdAt: string
}

/** Carries the response body so callers can branch on a server error code. */
export class ApiError extends Error {
  status: number
  data: Record<string, unknown> | null

  constructor(message: string, status: number, data: Record<string, unknown> | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
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
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data)
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

export function forgotPassword(email: string) {
  return request<{ ok: true }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(token: string, newPassword: string) {
  return request<{ ok: true }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
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

export type SecurityEventType =
  | 'LOGIN_SUCCEEDED'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'ADMIN_PASSWORD_RESET_FORCED'
  | 'USER_CREATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_DELETED'

export interface SecurityEvent {
  id: string
  type: SecurityEventType
  actorEmail: string
  actor: { id: string; email: string; name: string | null } | null
  targetUserId: string | null
  target: { id: string; email: string; name: string | null } | null
  detail: string | null
  createdAt: string
}

export interface MySecurityEvent {
  id: string
  type: SecurityEventType
  createdAt: string
}

export function listSecurityEvents(
  params: { type?: SecurityEventType; actorUserId?: string; from?: string; to?: string; take?: number; skip?: number } = {},
) {
  const query = new URLSearchParams()
  if (params.type) query.set('type', params.type)
  if (params.actorUserId) query.set('actorUserId', params.actorUserId)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.take) query.set('take', String(params.take))
  if (params.skip) query.set('skip', String(params.skip))
  const qs = query.toString()
  return request<{ events: SecurityEvent[]; total: number }>(`/api/security/audit-log${qs ? `?${qs}` : ''}`)
}

export function listMySecurityEvents() {
  return request<{ events: MySecurityEvent[] }>('/api/security/audit-log/me')
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
  portalUser?: { id: string; email: string } | null
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
export type QuotationAvailability = 'IN_STOCK' | 'ORDER_PENDING'

// Internal-only categorization, never printed in the PDF - kept in sync manually with
// PRODUCT_LINE_OPTIONS in server/src/routes/quotations.ts, same pattern as REQUEST_CATEGORY_OPTIONS.
export const PRODUCT_LINE_OPTIONS = ['Air Conditioning Unit', 'Plumbing', 'Electrical', 'Tools', 'Other'] as const
export type ProductLine = (typeof PRODUCT_LINE_OPTIONS)[number]

export interface PaymentTermsLine {
  label: string
  percentage: string
}

export function getPaymentTermLabels() {
  return request<{ labels: string[] }>('/api/quotations/payment-term-labels')
}

export interface Quotation {
  id: string
  customerId: string
  customer: SalesDocumentCustomer
  quotationNumber: string
  title: string
  productLine: string | null
  contactPerson: string | null
  status: QuotationStatus
  vatRate: string
  subtotal: string
  vatAmount: string
  total: string
  paymentTermsLines: PaymentTermsLine[]
  availabilityStatus: QuotationAvailability | null
  orderDays: number | null
  poReference: string | null
  items: SalesLineItem[]
  issuedAt: string
  validityDays: number
  createdAt: string
}

export interface QuotationInput {
  customerId: string
  title: string
  productLine?: string
  contactPerson?: string
  vatRate?: number
  validityDays?: number
  paymentTermsLines: PaymentTermsLine[]
  availabilityStatus?: QuotationAvailability | null
  orderDays?: number | null
  items: SalesLineItemInput[]
}

export function listQuotations(
  params: { status?: QuotationStatus; from?: string; to?: string; customerId?: string; search?: string } = {},
) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.search) query.set('search', params.search)
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
  productLine?: string | null
  contactPerson?: string | null
  status?: QuotationStatus
  poReference?: string | null
  // Draft-only fields - the server rejects these once the quotation has been sent.
  customerId?: string
  vatRate?: number
  validityDays?: number
  paymentTermsLines?: PaymentTermsLine[]
  availabilityStatus?: QuotationAvailability | null
  orderDays?: number | null
  items?: SalesLineItemInput[]
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

export type QuotationFollowUpOutcome =
  | 'CALL_BACK'
  | 'DECISION_NOT_YET_TAKEN'
  | 'DECISION_MAKER_OUT_OF_COUNTRY'
  | 'PRICE_NOT_COMPETITIVE'
  | 'REVIEW_OTHER_FEATURES'
  | 'REVIEW_PRICE'
  | 'DELIVERY_DATE_NOT_ACCEPTED'
  | 'QUOTATION_NOT_APPROVED'
  | 'NOT_IN_BUDGET'

export const QUOTATION_FOLLOWUP_OUTCOMES: { value: QuotationFollowUpOutcome; label: string }[] = [
  { value: 'CALL_BACK', label: 'To call back' },
  { value: 'DECISION_NOT_YET_TAKEN', label: 'Decision not yet taken' },
  { value: 'DECISION_MAKER_OUT_OF_COUNTRY', label: 'Decision maker out of the country' },
  { value: 'PRICE_NOT_COMPETITIVE', label: 'Price not competitive' },
  { value: 'REVIEW_OTHER_FEATURES', label: 'To review our quotation with other features' },
  { value: 'REVIEW_PRICE', label: 'To review our quotation with regards to the price' },
  { value: 'DELIVERY_DATE_NOT_ACCEPTED', label: 'Delivery date not accepted' },
  { value: 'QUOTATION_NOT_APPROVED', label: 'Quotation not approved' },
  { value: 'NOT_IN_BUDGET', label: 'Not in budget' },
]

export interface QuotationFollowUp {
  id: string
  quotationId: string
  calledAt: string
  spokenTo: string
  outcome: QuotationFollowUpOutcome
  callScheduledOn: string | null
  createdBy: { id: string; name: string | null; email: string }
  createdAt: string
}

export interface QuotationFollowUpInput {
  calledAt?: string
  spokenTo: string
  outcome: QuotationFollowUpOutcome
  callScheduledOn?: string | null
}

export function listQuotationFollowUps(quotationId: string) {
  return request<{ followUps: QuotationFollowUp[] }>(`/api/quotations/${quotationId}/follow-ups`)
}

export function createQuotationFollowUp(quotationId: string, input: QuotationFollowUpInput) {
  return request<{ followUp: QuotationFollowUp }>(`/api/quotations/${quotationId}/follow-ups`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
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
export type Gender = 'MALE' | 'FEMALE' | 'OTHER'
export type ContractType = 'PERMANENT' | 'FIXED_TERM' | 'CASUAL' | 'INTERN' | 'CONSULTANT'

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

  nationalId: string | null
  dateOfBirth: string | null
  gender: Gender | null
  address: string | null

  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null

  contractType: ContractType | null
  jobGrade: string | null
  probationEndDate: string | null
  contractEndDate: string | null
  exitDate: string | null
  exitReason: string | null

  basicSalary: string | null
  bankName: string | null
  bankAccountNumber: string | null

  notes: string | null
}

export interface EmployeeDetail extends Employee {
  user: { id: string; email: string; role: Role } | null
  managedProjects: { id: string; name: string; status: ProjectStatus }[]
  projectAssignments: {
    id: string
    role: string | null
    assignedAt: string
    project: { id: string; name: string; status: ProjectStatus }
  }[]
}

export interface EmployeeInput {
  employeeCode: string
  firstName: string
  lastName: string
  userId?: string
  email?: string
  phone?: string
  position?: string
  department?: string
  employmentStatus?: EmploymentStatus
  hireDate?: string

  nationalId?: string
  dateOfBirth?: string
  gender?: Gender | ''
  address?: string

  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string

  contractType?: ContractType | ''
  jobGrade?: string
  probationEndDate?: string
  contractEndDate?: string
  exitDate?: string
  exitReason?: string

  basicSalary?: string
  bankName?: string
  bankAccountNumber?: string

  notes?: string
}

export function listEmployees(
  params: { search?: string; department?: string; status?: EmploymentStatus } = {},
) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.department) query.set('department', params.department)
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  return request<{ employees: Employee[] }>(`/api/employees${qs ? `?${qs}` : ''}`)
}

export function getEmployee(id: string) {
  return request<{ employee: EmployeeDetail }>(`/api/employees/${id}`)
}

export function listDepartments() {
  return request<{ departments: string[] }>('/api/employees/departments')
}

export interface LinkableUser {
  id: string
  email: string
  name: string | null
  role: Role
  linkedEmployeeId: string | null
}

export function listLinkableUsers() {
  return request<{ users: LinkableUser[] }>('/api/employees/linkable-users')
}

/* ---------------------------------------------------------------- *
 * Leave
 * ---------------------------------------------------------------- */

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface LeaveType {
  id: string
  code: string
  name: string
  daysPerYear: string
  paid: boolean
  requiresDocs: boolean
  active: boolean
}

export interface LeaveTypeSummary {
  id: string
  name: string
  code: string
  paid: boolean
}

export interface LeaveBalance {
  id: string
  employeeId: string
  leaveTypeId: string
  year: number
  entitledDays: string
  carriedOverDays: string
  usedDays: string
  leaveType: LeaveTypeSummary
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string }
}

export interface LeaveRequest {
  id: string
  employeeId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  days: string
  halfDay: boolean
  reason: string | null
  status: LeaveRequestStatus
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    department: string | null
  }
  leaveType: LeaveTypeSummary
  reviewedBy: { id: string; name: string | null; email: string } | null
}

export interface LeaveTypeInput {
  code: string
  name: string
  daysPerYear: number
  paid: boolean
  requiresDocs: boolean
  active?: boolean
}

export interface LeaveRequestInput {
  employeeId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  days?: string
  halfDay?: boolean
  reason?: string
}

export function listLeaveTypes(includeInactive = false) {
  const qs = includeInactive ? '?includeInactive=true' : ''
  return request<{ leaveTypes: LeaveType[] }>(`/api/leave/types${qs}`)
}

export function seedLeaveTypes() {
  return request<{ leaveTypes: LeaveType[] }>('/api/leave/types/seed-defaults', { method: 'POST' })
}

export function createLeaveType(input: LeaveTypeInput) {
  return request<{ leaveType: LeaveType }>('/api/leave/types', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateLeaveType(id: string, input: Partial<LeaveTypeInput>) {
  return request<{ leaveType: LeaveType }>(`/api/leave/types/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteLeaveType(id: string) {
  return request<null>(`/api/leave/types/${id}`, { method: 'DELETE' })
}

export interface PublicHoliday {
  id: string
  date: string
  name: string
}

export function listPublicHolidays(year?: number) {
  const qs = year ? `?year=${year}` : ''
  return request<{ holidays: PublicHoliday[] }>(`/api/public-holidays${qs}`)
}

export function createPublicHoliday(input: { date: string; name: string }) {
  return request<{ holiday: PublicHoliday }>('/api/public-holidays', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updatePublicHoliday(id: string, input: Partial<{ date: string; name: string }>) {
  return request<{ holiday: PublicHoliday }>(`/api/public-holidays/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deletePublicHoliday(id: string) {
  return request<null>(`/api/public-holidays/${id}`, { method: 'DELETE' })
}

export function listLeaveBalances(params: { year?: number; employeeId?: string } = {}) {
  const query = new URLSearchParams()
  if (params.year) query.set('year', String(params.year))
  if (params.employeeId) query.set('employeeId', params.employeeId)
  const qs = query.toString()
  return request<{ balances: LeaveBalance[] }>(`/api/leave/balances${qs ? `?${qs}` : ''}`)
}

export function initializeLeaveBalances(year: number) {
  return request<{ created: number; year: number }>('/api/leave/balances/initialize', {
    method: 'POST',
    body: JSON.stringify({ year }),
  })
}

export function setLeaveBalance(input: {
  employeeId: string
  leaveTypeId: string
  year: number
  entitledDays: number
  carriedOverDays?: number
}) {
  return request<{ balance: LeaveBalance }>('/api/leave/balances', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function listLeaveRequests(
  params: { status?: LeaveRequestStatus; employeeId?: string; from?: string; to?: string } = {},
) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.employeeId) query.set('employeeId', params.employeeId)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  const qs = query.toString()
  return request<{ requests: LeaveRequest[] }>(`/api/leave/requests${qs ? `?${qs}` : ''}`)
}

export function getLeaveWorkingDays(startDate: string, endDate: string) {
  const query = new URLSearchParams({ startDate, endDate })
  return request<{ days: number }>(`/api/leave/requests/working-days?${query.toString()}`)
}

export function createLeaveRequest(input: LeaveRequestInput) {
  return request<{ request: LeaveRequest }>('/api/leave/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateLeaveRequest(id: string, input: Partial<LeaveRequestInput>) {
  return request<{ request: LeaveRequest }>(`/api/leave/requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function approveLeaveRequest(id: string, options: { note?: string; override?: boolean } = {}) {
  return request<{ request: LeaveRequest }>(`/api/leave/requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(options),
  })
}

export function rejectLeaveRequest(id: string, note?: string) {
  return request<{ request: LeaveRequest }>(`/api/leave/requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function cancelLeaveRequest(id: string, note?: string) {
  return request<{ request: LeaveRequest }>(`/api/leave/requests/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function deleteLeaveRequest(id: string) {
  return request<null>(`/api/leave/requests/${id}`, { method: 'DELETE' })
}

export function getLeaveSummary() {
  return request<{
    pendingCount: number
    onLeaveToday: LeaveRequest[]
    upcoming: LeaveRequest[]
  }>('/api/leave/summary')
}

export function syncLeaveStatuses() {
  return request<{ onLeave: number; returned: number }>('/api/leave/sync-statuses', { method: 'POST' })
}

/* ---------------------------------------------------------------- *
 * Self-service leave (an employee requesting their own leave) -
 * mirrors the HR-entry functions above but hits /api/my-leave, which
 * resolves the employee from the logged-in user rather than taking
 * employeeId as input.
 * ---------------------------------------------------------------- */

export interface MyLeaveRequestInput {
  leaveTypeId: string
  startDate: string
  endDate: string
  days?: string
  halfDay?: boolean
  reason?: string
}

export function getMyLeaveTypes() {
  return request<{ leaveTypes: LeaveType[] }>('/api/my-leave/leave-types')
}

export function getMyLeaveBalances(year?: number) {
  const qs = year ? `?year=${year}` : ''
  return request<{ balances: LeaveBalance[] }>(`/api/my-leave/balances${qs}`)
}

export function listMyLeaveRequests() {
  return request<{ requests: LeaveRequest[] }>('/api/my-leave/requests')
}

export function getMyLeaveWorkingDays(startDate: string, endDate: string) {
  const query = new URLSearchParams({ startDate, endDate })
  return request<{ days: number }>(`/api/my-leave/requests/working-days?${query.toString()}`)
}

export function createMyLeaveRequest(input: MyLeaveRequestInput) {
  return request<{ request: LeaveRequest }>('/api/my-leave/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function cancelMyLeaveRequest(id: string) {
  return request<{ request: LeaveRequest }>(`/api/my-leave/requests/${id}/cancel`, { method: 'POST' })
}

/* ---------------------------------------------------------------- *
 * Attendance
 * ---------------------------------------------------------------- */

export type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'ON_LEAVE'
  | 'PUBLIC_HOLIDAY'
  | 'REST_DAY'

export interface AttendanceEmployee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  department: string | null
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  status: AttendanceStatus
  clockIn: string | null
  clockOut: string | null
  breakMinutes: number
  hoursWorked: string | null
  overtimeHours: string
  note: string | null
  employee?: AttendanceEmployee
}

export interface AttendanceRosterRow {
  employee: AttendanceEmployee
  record: AttendanceRecord | null
  onLeaveType: string | null
  suggestedStatus: AttendanceStatus
}

export interface AttendanceRecordInput {
  employeeId: string
  status: AttendanceStatus
  clockIn?: string | null
  clockOut?: string | null
  breakMinutes?: number
  overtimeHours?: string
  note?: string | null
}

export interface Timesheet {
  employee: { id: string; firstName: string; lastName: string; employeeCode: string; position: string | null }
  year: number
  month: number
  daysInMonth: number
  records: AttendanceRecord[]
  totals: { hours: number; overtime: number; byStatus: Record<string, number> }
}

export function listAttendance(
  params: { employeeId?: string; from?: string; to?: string; status?: AttendanceStatus } = {},
) {
  const query = new URLSearchParams()
  if (params.employeeId) query.set('employeeId', params.employeeId)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  return request<{ records: AttendanceRecord[] }>(`/api/attendance${qs ? `?${qs}` : ''}`)
}

export function getAttendanceDay(date: string) {
  return request<{ date: string; isWeekend: boolean; roster: AttendanceRosterRow[] }>(
    `/api/attendance/day?date=${date}`,
  )
}

export function saveAttendanceDay(date: string, records: AttendanceRecordInput[]) {
  return request<{ saved: number; records: AttendanceRecord[] }>('/api/attendance/bulk', {
    method: 'POST',
    body: JSON.stringify({ date, records }),
  })
}

export function saveAttendanceRecord(date: string, input: AttendanceRecordInput) {
  return request<{ record: AttendanceRecord }>('/api/attendance', {
    method: 'POST',
    body: JSON.stringify({ date, ...input }),
  })
}

export function deleteAttendanceRecord(id: string) {
  return request<null>(`/api/attendance/${id}`, { method: 'DELETE' })
}

export function getTimesheet(employeeId: string, year: number, month: number) {
  const query = new URLSearchParams({ employeeId, year: String(year), month: String(month) })
  return request<Timesheet>(`/api/attendance/timesheet?${query.toString()}`)
}

/* ---------------------------------------------------------------- *
 * Certifications & training
 * ---------------------------------------------------------------- */

export interface CertificationEmployee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  position: string | null
}

export interface Certification {
  id: string
  employeeId: string
  name: string
  category: string | null
  issuingBody: string | null
  certificateNumber: string | null
  issueDate: string | null
  expiryDate: string | null
  notes: string | null
  documentId: string | null
  employee: CertificationEmployee
}

export interface CertificationInput {
  employeeId: string
  name: string
  category?: string
  issuingBody?: string
  certificateNumber?: string
  issueDate?: string
  expiryDate?: string
  notes?: string
}

export interface TrainingRecord {
  id: string
  employeeId: string
  title: string
  provider: string | null
  completedDate: string | null
  durationHours: string | null
  cost: string | null
  notes: string | null
  employee: CertificationEmployee
}

export interface TrainingRecordInput {
  employeeId: string
  title: string
  provider?: string
  completedDate?: string
  durationHours?: string
  cost?: string
  notes?: string
}

export function listCertifications(
  params: { employeeId?: string; search?: string; status?: 'valid' | 'expiring' | 'expired' } = {},
) {
  const query = new URLSearchParams()
  if (params.employeeId) query.set('employeeId', params.employeeId)
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  return request<{ certifications: Certification[]; expiringSoonDays: number }>(
    `/api/certifications${qs ? `?${qs}` : ''}`,
  )
}

export function listExpiringCertifications(days?: number) {
  const qs = days ? `?days=${days}` : ''
  return request<{ days: number; expiring: Certification[]; expired: Certification[] }>(
    `/api/certifications/expiring${qs}`,
  )
}

export function createCertification(input: CertificationInput) {
  return request<{ certification: Certification }>('/api/certifications', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateCertification(id: string, input: Partial<CertificationInput>) {
  return request<{ certification: Certification }>(`/api/certifications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteCertification(id: string) {
  return request<null>(`/api/certifications/${id}`, { method: 'DELETE' })
}

export function listTrainingRecords(params: { employeeId?: string; search?: string } = {}) {
  const query = new URLSearchParams()
  if (params.employeeId) query.set('employeeId', params.employeeId)
  if (params.search) query.set('search', params.search)
  const qs = query.toString()
  return request<{ records: TrainingRecord[] }>(`/api/training${qs ? `?${qs}` : ''}`)
}

export function createTrainingRecord(input: TrainingRecordInput) {
  return request<{ record: TrainingRecord }>('/api/training', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTrainingRecord(id: string, input: Partial<TrainingRecordInput>) {
  return request<{ record: TrainingRecord }>(`/api/training/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteTrainingRecord(id: string) {
  return request<null>(`/api/training/${id}`, { method: 'DELETE' })
}

export function getAttendanceSummary(date: string) {
  return request<{
    date: string
    headcount: number
    recorded: number
    byStatus: Record<string, number>
  }>(`/api/attendance/summary?date=${date}`)
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

export type WorkOrderStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_PARTS'
  | 'COMPLETED'
  | 'REOPENED'
  | 'CANCELLED'
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
  siteLat: string | null
  siteLng: string | null
  siteAddress: string | null
  technicians: { id: string; employee: EmployeeSummary }[]
  createdAt: string
  updatedAt: string
}

export type SiteVerificationStatus = 'ON_SITE' | 'OUTSIDE_SITE'
export type SiteExitReason = 'MATERIALS' | 'ANOTHER_SITE' | 'SUPERVISOR_INSTRUCTION' | 'EMERGENCY' | 'OTHER'

export const SITE_EXIT_REASON_LABELS: Record<SiteExitReason, string> = {
  MATERIALS: 'Collecting materials',
  ANOTHER_SITE: 'Travelling to another site',
  SUPERVISOR_INSTRUCTION: 'Supervisor instruction',
  EMERGENCY: 'Emergency',
  OTHER: 'Other',
}

export interface SiteVerification {
  id: string
  siteAttendanceId: string
  checkedAt: string
  lat: string
  lng: string
  distanceMeters: number
  status: SiteVerificationStatus
  exitReason: SiteExitReason | null
  exitReasonNote: string | null
}

export interface SiteAttendanceWorkOrderSummary {
  id: string
  workOrderNumber: string
  title: string
  siteLat: string | null
  siteLng: string | null
  siteAddress: string | null
}

export interface SiteAttendance {
  id: string
  workOrderId: string | null
  workOrder: SiteAttendanceWorkOrderSummary | null
  employeeId: string
  employee?: EmployeeSummary
  checkInAt: string
  checkInLat: string
  checkInLng: string
  checkInNote: string | null
  checkOutAt: string | null
  checkOutLat: string | null
  checkOutLng: string | null
  checkOutNote: string | null
  verifications: SiteVerification[]
}

/** Endpoints that return a whole team's visits always include the technician. */
export interface SiteAttendanceWithEmployee extends SiteAttendance {
  employee: EmployeeSummary
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
  siteAttendance: SiteAttendanceWithEmployee[]
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
  siteQuery?: string
}

export function listWorkOrders(
  params: { status?: WorkOrderStatus; customerId?: string; technicianId?: string; from?: string; to?: string } = {},
) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.technicianId) query.set('technicianId', params.technicianId)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
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
  siteQuery?: string
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

export function verifyMyLocation(coords: { lat: number; lng: number }) {
  return request<{ skipped: true } | { verification: SiteVerification }>('/api/site-attendance/verify-location', {
    method: 'POST',
    body: JSON.stringify(coords),
  })
}

export function submitMyExitReason(input: { reason: SiteExitReason; note?: string }) {
  return request<{ verification: SiteVerification }>('/api/site-attendance/exit-reason', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface SiteTrackingEntry extends SiteAttendanceWithEmployee {
  workOrder: {
    id: string
    workOrderNumber: string
    title: string
    siteLat: string | null
    siteLng: string | null
    siteAddress: string | null
    customer: WorkOrderCustomer
  }
}

export function getSiteTracking() {
  return request<{ current: SiteTrackingEntry[]; recentlyCompleted: SiteTrackingEntry[] }>(
    '/api/work-orders/site-tracking',
  )
}

export function getMyAttendance() {
  return request<{ current: SiteAttendance | null; history: SiteAttendance[] }>('/api/site-attendance/me')
}

export function requestLocationVerification(siteAttendanceId: string) {
  return request<{ ok: true }>(`/api/site-attendance/${siteAttendanceId}/request-verification`, { method: 'POST' })
}

export interface TechnicianAttendanceSummary {
  employee: EmployeeSummary
  daysPresent: number
  totalCheckIns: number
  totalHoursOnSite: number
  onSiteCount: number
  outsideSiteCount: number
}

export function listTeamAttendance(params: { month?: string; employeeId?: string } = {}) {
  const query = new URLSearchParams()
  if (params.month) query.set('month', params.month)
  if (params.employeeId) query.set('employeeId', params.employeeId)
  const qs = query.toString()
  return request<{
    current: SiteAttendanceWithEmployee[]
    history: SiteAttendanceWithEmployee[]
    summary: TechnicianAttendanceSummary[]
  }>(`/api/site-attendance${qs ? `?${qs}` : ''}`)
}

export function checkInAttendance(coords: { lat: number; lng: number; note?: string }) {
  return request<{ siteAttendance: SiteAttendance }>('/api/site-attendance/check-in', {
    method: 'POST',
    body: JSON.stringify(coords),
  })
}

export function checkOutAttendance(coords: { lat: number; lng: number; note?: string }) {
  return request<{ siteAttendance: SiteAttendance }>('/api/site-attendance/check-out', {
    method: 'POST',
    body: JSON.stringify(coords),
  })
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

export function listDailyReports(params: { status?: ReportStatus; from?: string; to?: string } = {}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
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

export type PhotoKind = 'EQUIPMENT' | 'WORK_DONE' | 'BEFORE' | 'AFTER'

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
  workTypeOther: string | null
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
  materialsUsed: string | null
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
  units: InterventionReportUnit[]
  createdAt: string
  updatedAt: string
}

export interface InterventionReportUnit {
  id: string
  label: string
  problem: string
  action: string | null
  order: number
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
  workTypeOther?: string
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
  materialsUsed?: string
  comments?: string
  additionalInfo?: string
  technicianIds: string[]
  units?: { label: string; problem: string; action?: string }[]
  signedByName?: string
  signatureData?: string
  attachmentData?: string
  attachmentFileName?: string
}

export function listInterventionReports(
  params: {
    status?: ReportStatus
    workOrderId?: string
    customerId?: string
    dueRemindersOnly?: boolean
    jobCategory?: JobCategory
    workType?: ServiceCategory
    from?: string
    to?: string
  } = {},
) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.workOrderId) query.set('workOrderId', params.workOrderId)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.dueRemindersOnly) query.set('dueRemindersOnly', 'true')
  if (params.jobCategory) query.set('jobCategory', params.jobCategory)
  if (params.workType) query.set('workType', params.workType)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
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

export type DocumentCategory = 'CONTRACT' | 'INVOICE' | 'HR' | 'PROJECT' | 'GENERAL' | 'QUOTATION'

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  CONTRACT: 'Contract',
  INVOICE: 'Invoice',
  HR: 'HR',
  PROJECT: 'Project',
  GENERAL: 'General',
  QUOTATION: 'Quotation',
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
  quotationId: string | null
  quotation: { id: string; quotationNumber: string } | null
  uploadedBy: { id: string; name: string | null; email: string }
  createdAt: string
}

export interface DocumentInput {
  title: string
  category?: DocumentCategory
  projectId?: string | null
  customerId?: string | null
  quotationId?: string | null
  fileData: string
  fileName: string
}

export function listDocuments(
  params: { category?: DocumentCategory; projectId?: string; customerId?: string; quotationId?: string; search?: string } = {},
) {
  const query = new URLSearchParams()
  if (params.category) query.set('category', params.category)
  if (params.projectId) query.set('projectId', params.projectId)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.quotationId) query.set('quotationId', params.quotationId)
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
  quotationId?: string | null
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

// ---------- Maintenance ----------

export type AssetStatus = 'ACTIVE' | 'DECOMMISSIONED'
export type MaintenanceFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'
export type MaintenanceContractStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
export type MaintenanceRequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type MaintenanceRequestStatus = 'SUBMITTED' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
export type MaintenanceScheduleStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'

export interface AssetCustomer extends CustomerSummary {
  address: string | null
}

export interface Asset {
  id: string
  sequenceNumber: number
  assetNumber: string
  name: string
  category: string | null
  serialNumber: string | null
  location: string | null
  customerId: string
  customer: AssetCustomer
  status: AssetStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface AssetInput {
  name: string
  category?: string
  serialNumber?: string
  location?: string
  customerId: string
  notes?: string
}

export interface AssetUpdateInput {
  name?: string
  category?: string | null
  serialNumber?: string | null
  location?: string | null
  status?: AssetStatus
  notes?: string | null
}

/** The trimmed asset reference embedded in a standalone contract/request/schedule. */
export interface MaintenanceAssetRef {
  id: string
  sequenceNumber: number
  assetNumber: string
  name: string
  customer: CustomerSummary
}

/** A contract row as it appears nested under Asset.contracts (no asset back-reference). */
export interface AssetHistoryContract {
  id: string
  sequenceNumber: number
  contractNumber: string
  assetId: string
  frequency: MaintenanceFrequency
  startDate: string
  expiryDate: string
  status: MaintenanceContractStatus
  notes: string | null
  createdById: string
  createdAt: string
  updatedAt: string
}

/** A request row as it appears nested under Asset.requests (no asset back-reference). */
export interface AssetHistoryRequest {
  id: string
  sequenceNumber: number
  requestNumber: string
  assetId: string
  contractId: string | null
  description: string
  priority: MaintenanceRequestPriority
  status: MaintenanceRequestStatus
  requestedById: string
  createdAt: string
}

export interface MaintenanceContract extends AssetHistoryContract {
  asset: MaintenanceAssetRef
}

export interface MaintenanceContractInput {
  assetId: string
  frequency: MaintenanceFrequency
  startDate: string
  expiryDate: string
  notes?: string
}

export interface MaintenanceContractUpdateInput {
  frequency?: MaintenanceFrequency
  startDate?: string
  expiryDate?: string
  status?: MaintenanceContractStatus
  notes?: string | null
}

export interface MaintenanceContractDetail extends MaintenanceContract {
  schedules: MaintenanceSchedule[]
}

export interface MaintenanceRequest extends AssetHistoryRequest {
  asset: MaintenanceAssetRef
  requestedBy: { id: string; name: string | null; email: string }
}

export interface MaintenanceRequestDetail extends MaintenanceRequest {
  schedule: MaintenanceSchedule | null
}

export interface MaintenanceRequestInput {
  assetId: string
  contractId?: string
  description: string
  priority?: MaintenanceRequestPriority
}

/** Bare report fields, without the reviewer/submitter expansion — used inside Asset history. */
export interface AssetHistoryReport {
  id: string
  scheduleId: string
  remarks: string
  workCompleted: boolean
  recommendations: string | null
  status: ReportStatus
  submittedById: string
  reviewedById: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
}

export interface MaintenanceReport extends AssetHistoryReport {
  submittedBy: { id: string; name: string | null; email: string }
  reviewedBy: { id: string; name: string | null; email: string } | null
}

export interface MaintenanceReportInput {
  remarks: string
  workCompleted: boolean
  recommendations?: string
}

export interface MaintenanceSchedule {
  id: string
  contractId: string | null
  contract: { id: string; sequenceNumber: number; contractNumber: string; asset: MaintenanceAssetRef } | null
  requestId: string | null
  request:
    | { id: string; sequenceNumber: number; requestNumber: string; description: string; priority: MaintenanceRequestPriority; asset: MaintenanceAssetRef }
    | null
  scheduledDate: string
  status: MaintenanceScheduleStatus
  createdById: string
  createdAt: string
  updatedAt: string
  technicians: { id: string; employee: EmployeeSummary }[]
  report: MaintenanceReport | null
}

export interface MaintenanceScheduleInput {
  contractId: string
  scheduledDate: string
  technicianIds: string[]
}

export interface MaintenanceScheduleUpdateInput {
  scheduledDate?: string
  technicianIds?: string[]
}

/** A schedule row as it appears nested under Asset.schedules — trimmed contract/request refs, bare report. */
export interface AssetHistorySchedule {
  id: string
  contractId: string | null
  contract: { id: string; sequenceNumber: number; contractNumber: string } | null
  requestId: string | null
  request: { id: string; sequenceNumber: number; requestNumber: string } | null
  scheduledDate: string
  status: MaintenanceScheduleStatus
  createdById: string
  createdAt: string
  updatedAt: string
  technicians: { id: string; employee: EmployeeSummary }[]
  report: AssetHistoryReport | null
}

export interface AssetDetail extends Asset {
  contracts: AssetHistoryContract[]
  requests: AssetHistoryRequest[]
  schedules: AssetHistorySchedule[]
}

export function listAssets(
  params: { search?: string; customerId?: string; status?: AssetStatus; category?: string } = {},
) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.status) query.set('status', params.status)
  if (params.category) query.set('category', params.category)
  const qs = query.toString()
  return request<{ assets: Asset[] }>(`/api/maintenance-assets${qs ? `?${qs}` : ''}`)
}

export function getAsset(id: string) {
  return request<{ asset: AssetDetail }>(`/api/maintenance-assets/${id}`)
}

export function createAsset(input: AssetInput) {
  return request<{ asset: Asset }>('/api/maintenance-assets', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateAsset(id: string, input: AssetUpdateInput) {
  return request<{ asset: Asset }>(`/api/maintenance-assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteAsset(id: string) {
  return request<null>(`/api/maintenance-assets/${id}`, { method: 'DELETE' })
}

export function listMaintenanceContracts(
  params: {
    assetId?: string
    status?: MaintenanceContractStatus
    expiringSoon?: boolean
    customerId?: string
    frequency?: MaintenanceFrequency
  } = {},
) {
  const query = new URLSearchParams()
  if (params.assetId) query.set('assetId', params.assetId)
  if (params.status) query.set('status', params.status)
  if (params.expiringSoon) query.set('expiringSoon', 'true')
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.frequency) query.set('frequency', params.frequency)
  const qs = query.toString()
  return request<{ contracts: MaintenanceContract[] }>(`/api/maintenance-contracts${qs ? `?${qs}` : ''}`)
}

export function getMaintenanceContract(id: string) {
  return request<{ contract: MaintenanceContractDetail }>(`/api/maintenance-contracts/${id}`)
}

export function createMaintenanceContract(input: MaintenanceContractInput) {
  return request<{ contract: MaintenanceContract }>('/api/maintenance-contracts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateMaintenanceContract(id: string, input: MaintenanceContractUpdateInput) {
  return request<{ contract: MaintenanceContract }>(`/api/maintenance-contracts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteMaintenanceContract(id: string) {
  return request<null>(`/api/maintenance-contracts/${id}`, { method: 'DELETE' })
}

export function listMaintenanceRequests(
  params: {
    status?: MaintenanceRequestStatus
    assetId?: string
    customerId?: string
    priority?: MaintenanceRequestPriority
    from?: string
    to?: string
  } = {},
) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.assetId) query.set('assetId', params.assetId)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.priority) query.set('priority', params.priority)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  const qs = query.toString()
  return request<{ requests: MaintenanceRequest[] }>(`/api/maintenance-requests${qs ? `?${qs}` : ''}`)
}

export function getMaintenanceRequest(id: string) {
  return request<{ request: MaintenanceRequestDetail }>(`/api/maintenance-requests/${id}`)
}

export function createMaintenanceRequest(input: MaintenanceRequestInput) {
  return request<{ request: MaintenanceRequest }>('/api/maintenance-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function scheduleMaintenanceRequest(id: string, input: { scheduledDate: string; technicianIds: string[] }) {
  return request<{ request: MaintenanceRequestDetail }>(`/api/maintenance-requests/${id}/schedule`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function cancelMaintenanceRequest(id: string) {
  return request<{ request: MaintenanceRequest }>(`/api/maintenance-requests/${id}/cancel`, { method: 'POST' })
}

export function deleteMaintenanceRequest(id: string) {
  return request<null>(`/api/maintenance-requests/${id}`, { method: 'DELETE' })
}

export function listMaintenanceSchedules(
  params: {
    status?: MaintenanceScheduleStatus
    technicianId?: string
    contractId?: string
    customerId?: string
    from?: string
    to?: string
  } = {},
) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.technicianId) query.set('technicianId', params.technicianId)
  if (params.contractId) query.set('contractId', params.contractId)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  const qs = query.toString()
  return request<{ schedules: MaintenanceSchedule[] }>(`/api/maintenance-schedules${qs ? `?${qs}` : ''}`)
}

export function getMaintenanceSchedule(id: string) {
  return request<{ schedule: MaintenanceSchedule }>(`/api/maintenance-schedules/${id}`)
}

export function createMaintenanceSchedule(input: MaintenanceScheduleInput) {
  return request<{ schedule: MaintenanceSchedule }>('/api/maintenance-schedules', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateMaintenanceSchedule(id: string, input: MaintenanceScheduleUpdateInput) {
  return request<{ schedule: MaintenanceSchedule }>(`/api/maintenance-schedules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteMaintenanceSchedule(id: string) {
  return request<null>(`/api/maintenance-schedules/${id}`, { method: 'DELETE' })
}

export function submitMaintenanceReport(scheduleId: string, input: MaintenanceReportInput) {
  return request<{ schedule: MaintenanceSchedule }>(`/api/maintenance-schedules/${scheduleId}/report`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function approveMaintenanceReport(scheduleId: string, note?: string) {
  return request<{ schedule: MaintenanceSchedule }>(`/api/maintenance-schedules/${scheduleId}/report/approve`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function rejectMaintenanceReport(scheduleId: string, note?: string) {
  return request<{ schedule: MaintenanceSchedule }>(`/api/maintenance-schedules/${scheduleId}/report/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

// ---------- Payroll ----------

export interface PayrollRun {
  id: string
  year: number
  month: number
  createdBy: { id: string; name: string | null; email: string }
  createdAt: string
  employeeCount: number
  totalNetPay: number
}

export interface PayrollEmployeeRef extends EmployeeSummary {
  employeeCode: string
}

export interface PayrollLine {
  id: string
  payrollRunId: string
  employeeId: string
  employee: PayrollEmployeeRef
  basicSalary: string
  hoursWorked: string
  overtimeHours: string
  unpaidLeaveDays: string
  deduction: string
  netPay: string
}

export interface PayrollRunDetail {
  id: string
  year: number
  month: number
  createdBy: { id: string; name: string | null; email: string }
  createdAt: string
  lines: PayrollLine[]
}

export function listPayrollRuns() {
  return request<{ runs: PayrollRun[] }>('/api/payroll')
}

export function getPayrollRun(id: string) {
  return request<{ run: PayrollRunDetail }>(`/api/payroll/${id}`)
}

export function processPayroll(year: number, month: number) {
  return request<{ run: PayrollRunDetail }>('/api/payroll/process', {
    method: 'POST',
    body: JSON.stringify({ year, month }),
  })
}

export function deletePayrollRun(id: string) {
  return request<null>(`/api/payroll/${id}`, { method: 'DELETE' })
}

export interface InsightSummary {
  monthlyRevenue: number
  activeProjects: number
  activeWorkOrders: number
  overdueInvoices: { count: number; total: number }
  openMaintenanceRequests: number
  lowStockItems: number
  techniciansOnSite: number
  generatedAt: string
}

export function getInsightSummary() {
  return request<{ summary: InsightSummary }>('/api/insight/summary')
}

export type NotificationType =
  | 'LEAVE_REQUEST_APPROVED'
  | 'LEAVE_REQUEST_REJECTED'
  | 'REQUISITION_APPROVED'
  | 'REQUISITION_REJECTED'
  | 'WORK_ORDER_ASSIGNED'
  | 'QUOTATION_ACCEPTED'
  | 'QUOTATION_REJECTED'
  | 'INTERVENTION_REPORT_SUBMITTED'
  | 'INTERVENTION_REPORT_APPROVED'
  | 'INTERVENTION_REPORT_REJECTED'
  | 'MAINTENANCE_REQUEST_SCHEDULED'
  | 'MAINTENANCE_REQUEST_CANCELLED'
  | 'MAINTENANCE_REQUEST_COMPLETED'
  | 'MAINTENANCE_REPORT_SUBMITTED'
  | 'MAINTENANCE_REPORT_APPROVED'
  | 'MAINTENANCE_REPORT_REJECTED'
  | 'PROJECT_ASSIGNED'
  | 'LOCATION_CHECK_REQUESTED'
  | 'DAILY_REPORT_SUBMITTED'
  | 'DAILY_REPORT_APPROVED'
  | 'DAILY_REPORT_REJECTED'
  | 'WORK_ORDER_STATUS_CHANGED'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

export function listNotifications() {
  return request<{ notifications: Notification[]; unreadCount: number }>('/api/notifications')
}

export function markNotificationRead(id: string) {
  return request<{ ok: true }>(`/api/notifications/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsRead() {
  return request<{ ok: true }>('/api/notifications/read-all', { method: 'POST' })
}

/* ------------------------------------------------------------------ *
 * Technet Connect - customer portal access (staff side)
 * ------------------------------------------------------------------ */

export function grantPortalAccess(customerId: string, email?: string) {
  return request<{ email: string; password: string }>(`/api/customers/${customerId}/portal-access`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function resetPortalAccess(customerId: string) {
  return request<{ email: string; password: string }>(`/api/customers/${customerId}/portal-access/reset`, {
    method: 'POST',
  })
}

export function revokePortalAccess(customerId: string) {
  return request<null>(`/api/customers/${customerId}/portal-access`, { method: 'DELETE' })
}

export type QuotationRequestStatus = 'PENDING' | 'CONVERTED' | 'DECLINED'
export type RequestSource = 'EMAIL' | 'PHONE_CALL' | 'REFERRER' | 'PORTAL'
export type RequestCategory =
  | 'NEW_EQUIPMENT_INSTALL'
  | 'AC_INSTALL'
  | 'PLUMBING_INSTALL'
  | 'ELECTRICAL_INSTALL'
  | 'SERVICING'
  | 'REPAIRS'
  | 'OTHER'

export const REQUEST_SOURCE_OPTIONS: { value: Exclude<RequestSource, 'PORTAL'>; label: string }[] = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE_CALL', label: 'Phone call' },
  { value: 'REFERRER', label: 'Referrer' },
]

export const REQUEST_CATEGORY_OPTIONS: { value: RequestCategory; label: string }[] = [
  { value: 'NEW_EQUIPMENT_INSTALL', label: 'Installation of new equipment' },
  { value: 'AC_INSTALL', label: 'Installation of AC units' },
  { value: 'PLUMBING_INSTALL', label: 'Installation of plumbing' },
  { value: 'ELECTRICAL_INSTALL', label: 'Installation of electrical' },
  { value: 'SERVICING', label: 'Servicing' },
  { value: 'REPAIRS', label: 'Repairs' },
  { value: 'OTHER', label: 'Other' },
]

export interface QuotationRequest {
  id: string
  customerId: string | null
  customer: SalesDocumentCustomer | null
  companyName: string | null
  contactEmail: string | null
  contactPhone: string | null
  contactTitle: string | null
  otherContactName: string | null
  otherContactPhone: string | null
  source: RequestSource
  requestFor: RequestCategory | null
  requestForOther: string | null
  description: string
  remarks: string | null
  status: QuotationRequestStatus
  convertedQuotation: { id: string; quotationNumber: string } | null
  reviewNote: string | null
  loggedBy: { id: string; name: string | null; email: string } | null
  statusNote: string | null
  ackEmailBody: string | null
  ackDraftSavedAt: string | null
  acknowledgedAt: string | null
  createdAt: string
}

export interface QuotationRequestInput {
  customerId?: string
  companyName?: string
  contactEmail?: string
  contactPhone?: string
  contactTitle?: string
  otherContactName?: string
  otherContactPhone?: string
  source: Exclude<RequestSource, 'PORTAL'>
  requestFor?: RequestCategory
  requestForOther?: string
  description: string
  remarks?: string
}

export function listQuoteRequests(params: { status?: QuotationRequestStatus; loggedById?: string } = {}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.loggedById) query.set('loggedById', params.loggedById)
  const qs = query.toString()
  return request<{ requests: QuotationRequest[]; slaHours: number }>(
    `/api/quotations/quote-requests${qs ? `?${qs}` : ''}`,
  )
}

export function createQuoteRequest(input: QuotationRequestInput) {
  return request<{ request: QuotationRequest }>('/api/quotations/quote-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function convertQuoteRequest(id: string, input: Omit<QuotationInput, 'customerId'> & { customerId?: string }) {
  return request<{ quotation: Quotation }>(`/api/quotations/quote-requests/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function declineQuoteRequest(id: string, note?: string) {
  return request<{ request: QuotationRequest }>(`/api/quotations/quote-requests/${id}/decline`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export function setQuoteRequestNote(id: string, note: string) {
  return request<{ request: QuotationRequest }>(`/api/quotations/quote-requests/${id}/note`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  })
}

export function saveQuoteRequestAcknowledgement(id: string, body: string, action: 'draft' | 'send') {
  return request<{ request: QuotationRequest }>(`/api/quotations/quote-requests/${id}/acknowledgement`, {
    method: 'PATCH',
    body: JSON.stringify({ body, action }),
  })
}

/* ------------------------------------------------------------------ *
 * Technet Connect - customer-facing portal (separate auth domain)
 * ------------------------------------------------------------------ */

export interface PortalCustomer {
  id: string
  name: string
  email: string
}

export function portalLogin(email: string, password: string) {
  return request<{ customer: PortalCustomer }>('/api/portal-auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function portalLogout() {
  return request<{ ok: true }>('/api/portal-auth/logout', { method: 'POST' })
}

export function portalFetchMe() {
  return request<{ customer: PortalCustomer }>('/api/portal-auth/me')
}

export function portalListQuotations() {
  return request<{ quotations: Quotation[] }>('/api/portal/quotations')
}

export function portalListInvoices() {
  return request<{ invoices: Invoice[] }>('/api/portal/invoices')
}

export interface PortalWorkOrder {
  id: string
  workOrderNumber: string
  title: string
  jobCategory: JobCategory
  description: string | null
  status: WorkOrderStatus
  scheduledDate: string
  siteAddress: string | null
}

export function portalListWorkOrders() {
  return request<{ workOrders: PortalWorkOrder[] }>('/api/portal/work-orders')
}

export function portalListQuoteRequests() {
  return request<{ requests: QuotationRequest[] }>('/api/portal/quote-requests')
}

export function portalSubmitQuoteRequest(description: string) {
  return request<{ request: QuotationRequest }>('/api/portal/quote-requests', {
    method: 'POST',
    body: JSON.stringify({ description }),
  })
}

export function portalQuotationPdfUrl(id: string) {
  return `${API_URL}/api/portal/quotations/${id}/pdf`
}

export function portalInvoicePdfUrl(id: string) {
  return `${API_URL}/api/portal/invoices/${id}/pdf`
}

// ---- Technet Digital Marketing (Phase 1: campaigns + content calendar, no AI, no auto-publish) ----

export type MarketingPlatform = 'LinkedIn' | 'Facebook' | 'Instagram' | 'Other'
export const MARKETING_PLATFORMS: MarketingPlatform[] = ['LinkedIn', 'Facebook', 'Instagram', 'Other']

export type MarketingPostStatus = 'PLANNED' | 'POSTED' | 'CANCELLED'

export interface MarketingCampaign {
  id: string
  name: string
  description: string | null
  startDate: string | null
  endDate: string | null
  createdBy: { id: string; name: string | null; email: string } | null
  createdAt: string
  updatedAt: string
  _count?: { posts: number }
  posts?: MarketingPost[]
}

export interface MarketingPost {
  id: string
  campaignId: string
  campaign?: { id: string; name: string }
  title: string
  platform: MarketingPlatform
  copy: string | null
  scheduledDate: string
  status: MarketingPostStatus
  postedAt: string | null
  createdAt: string
}

export interface MarketingCampaignInput {
  name: string
  description?: string
  startDate?: string
  endDate?: string
}

export interface MarketingPostInput {
  title: string
  platform: MarketingPlatform
  copy?: string
  scheduledDate: string
}

export function listMarketingCampaigns(params: { search?: string } = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  const qs = query.toString()
  return request<{ campaigns: MarketingCampaign[] }>(`/api/marketing/campaigns${qs ? `?${qs}` : ''}`)
}

export function getMarketingCampaign(id: string) {
  return request<{ campaign: MarketingCampaign }>(`/api/marketing/campaigns/${id}`)
}

export function createMarketingCampaign(input: MarketingCampaignInput) {
  return request<{ campaign: MarketingCampaign }>('/api/marketing/campaigns', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateMarketingCampaign(id: string, input: Partial<MarketingCampaignInput>) {
  return request<{ campaign: MarketingCampaign }>(`/api/marketing/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteMarketingCampaign(id: string) {
  return request<null>(`/api/marketing/campaigns/${id}`, { method: 'DELETE' })
}

export function createMarketingPost(campaignId: string, input: MarketingPostInput) {
  return request<{ post: MarketingPost }>(`/api/marketing/campaigns/${campaignId}/posts`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateMarketingPost(id: string, input: Partial<MarketingPostInput> & { status?: MarketingPostStatus }) {
  return request<{ post: MarketingPost }>(`/api/marketing/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function markMarketingPostPosted(id: string) {
  return request<{ post: MarketingPost }>(`/api/marketing/posts/${id}/mark-posted`, { method: 'POST' })
}

export function deleteMarketingPost(id: string) {
  return request<null>(`/api/marketing/posts/${id}`, { method: 'DELETE' })
}

export function listMarketingPosts(
  params: {
    from?: string
    to?: string
    status?: MarketingPostStatus
    platform?: MarketingPlatform
    campaignId?: string
  } = {},
) {
  const query = new URLSearchParams()
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.status) query.set('status', params.status)
  if (params.platform) query.set('platform', params.platform)
  if (params.campaignId) query.set('campaignId', params.campaignId)
  const qs = query.toString()
  return request<{ posts: MarketingPost[] }>(`/api/marketing/posts${qs ? `?${qs}` : ''}`)
}
