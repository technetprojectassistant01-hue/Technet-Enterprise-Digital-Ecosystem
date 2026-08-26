import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  Download,
  AlertTriangle,
  UserPlus,
  FileText,
  Radio,
  Wrench,
  MoreHorizontal,
  Receipt,
  UserCheck,
  PackageX,
  FolderKanban,
  ClipboardList,
  ShoppingCart,
} from 'lucide-react'
import * as api from './lib/api'
import type {
  InventoryItem,
  Customer,
  Invoice,
  Expense,
  Quotation,
  Contract,
  Project,
  Requisition,
  PurchaseOrder,
  Document as ErpDocument,
  Employee,
} from './lib/api'
import { Panel, StatCard, BarChart, Badge, EmptyState, TableSkeleton } from './dashboard/ui'
import { contractStatusTone, projectStatusTone } from './erp/statusTones'
import { formatMoney } from './lib/format'
import { useAuth } from './context/AuthContext'
import { hasRole, HR_ROLES } from './lib/permissions'

const PIPELINE_STEPS = [
  { label: 'CUSTOMERS', icon: UserPlus },
  { label: 'QUOTE', icon: FileText },
  { label: 'CONTRACT', icon: Radio },
  { label: 'PROJECT', icon: Wrench },
]

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TechnetErpPage() {
  const { user } = useAuth()
  const canSeeHr = hasRole(user?.role, HR_ROLES)

  const [inventory, setInventory] = useState<InventoryItem[] | null>(null)
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [expenses, setExpenses] = useState<Expense[] | null>(null)
  const [quotations, setQuotations] = useState<Quotation[] | null>(null)
  const [contracts, setContracts] = useState<Contract[] | null>(null)
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [requisitions, setRequisitions] = useState<Requisition[] | null>(null)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[] | null>(null)
  const [documents, setDocuments] = useState<ErpDocument[] | null>(null)
  const [employees, setEmployees] = useState<Employee[] | null>(null)
  const [pendingLeaveCount, setPendingLeaveCount] = useState<number | null>(null)

  useEffect(() => {
    api.listInventory().then(({ items }) => setInventory(items)).catch(() => setInventory([]))
    api.listCustomers().then(({ customers }) => setCustomers(customers)).catch(() => setCustomers([]))
    api.listInvoices().then(({ invoices }) => setInvoices(invoices)).catch(() => setInvoices([]))
    api.listExpenses().then(({ expenses }) => setExpenses(expenses)).catch(() => setExpenses([]))
    api.listQuotations().then(({ quotations }) => setQuotations(quotations)).catch(() => setQuotations([]))
    api.listContracts().then(({ contracts }) => setContracts(contracts)).catch(() => setContracts([]))
    api.listProjects().then(({ projects }) => setProjects(projects)).catch(() => setProjects([]))
    api.listRequisitions().then(({ requisitions }) => setRequisitions(requisitions)).catch(() => setRequisitions([]))
    api.listPurchaseOrders().then(({ purchaseOrders }) => setPurchaseOrders(purchaseOrders)).catch(() => setPurchaseOrders([]))
    api.listDocuments().then(({ documents }) => setDocuments(documents)).catch(() => setDocuments([]))
    api.listEmployees().then(({ employees }) => setEmployees(employees)).catch(() => setEmployees([]))
  }, [])

  // Leave data is HR_ROLES-only server-side (unlike everything else this page reads) - only
  // fetch it when the viewer can actually see it, same gate HrOverviewPage.tsx uses.
  useEffect(() => {
    if (!canSeeHr) return
    api.getLeaveSummary().then(({ pendingCount }) => setPendingLeaveCount(pendingCount)).catch(() => setPendingLeaveCount(0))
  }, [canSeeHr])

  const lowStockItems = (inventory ?? []).filter((i) => i.quantity <= i.minStockLevel)

  const paidInvoices = (invoices ?? []).filter((i) => i.status === 'PAID')
  const revenue = paidInvoices.reduce((sum, i) => sum + Number(i.total), 0)
  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0)
  const profit = revenue - totalExpenses
  const outstanding = (invoices ?? [])
    .filter((i) => i.status === 'SENT' || i.status === 'OVERDUE')
    .reduce((sum, i) => sum + Number(i.total), 0)

  const now = new Date()
  const monthlyRevenue = paidInvoices
    .filter((i) => {
      const d = new Date(i.paidAt || i.issueDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, i) => sum + Number(i.total), 0)

  const revenueTrend = Array.from({ length: 10 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (9 - i), 1)
    const total = paidInvoices
      .filter((inv) => {
        const pd = new Date(inv.paidAt || inv.issueDate)
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear()
      })
      .reduce((sum, inv) => sum + Number(inv.total), 0)
    return { label: MONTHS[d.getMonth()], value: total }
  })

  const activeQuotations = (quotations ?? []).filter((q) => q.status === 'DRAFT' || q.status === 'SENT')
  const acceptedQuotations = (quotations ?? []).filter((q) => q.status === 'ACCEPTED')
  const conversionRate = quotations && quotations.length > 0
    ? Math.round((acceptedQuotations.length / quotations.length) * 100)
    : 0
  const pipelineProgress = quotations && quotations.length > 0
    ? Math.min(100, Math.round(((contracts?.length ?? 0) / quotations.length) * 100))
    : 0

  const activeContracts = (contracts ?? []).filter((c) => c.status !== 'COMPLETED' && c.status !== 'CANCELLED')

  const activeProjects = (projects ?? []).filter(
    (p) => p.status !== 'COMPLETED' && p.status !== 'CLOSED' && p.status !== 'CANCELLED',
  )
  const pendingRequisitions = (requisitions ?? []).filter((r) => r.status === 'SUBMITTED')
  const openPurchaseOrders = (purchaseOrders ?? []).filter(
    (po) => po.status === 'DRAFT' || po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED',
  )
  const activeHeadcount = (employees ?? []).filter((e) => e.employmentStatus !== 'TERMINATED')

  const activity = [
    ...(customers ?? []).map((c) => ({
      icon: UserCheck,
      tone: 'default' as const,
      title: 'New Customer Added',
      detail: `${c.company || c.name} · ${timeAgo(c.createdAt)}`,
      at: c.createdAt,
    })),
    ...(invoices ?? []).map((i) => ({
      icon: Receipt,
      tone: 'accent' as const,
      title: i.status === 'PAID' ? `Invoice ${i.invoiceNumber} Paid` : `Invoice ${i.invoiceNumber} Created`,
      detail: `${formatMoney(i.total)} · ${timeAgo(i.createdAt)}`,
      at: i.createdAt,
    })),
    ...(quotations ?? []).map((q) => ({
      icon: Receipt,
      tone: 'accent' as const,
      title: `Quotation "${q.title}" Created`,
      detail: `For ${q.customer.company || q.customer.name} · ${timeAgo(q.createdAt)}`,
      at: q.createdAt,
    })),
    ...lowStockItems.map((item) => ({
      icon: PackageX,
      tone: 'warning' as const,
      title: 'Stock Alert Triggered',
      detail: `${item.name} Low · ${timeAgo(item.updatedAt)}`,
      at: item.updatedAt,
    })),
    ...(requisitions ?? []).map((r) => ({
      icon: ClipboardList,
      tone: 'default' as const,
      title: `Requisition ${r.requisitionNumber} Submitted`,
      detail: `${r.project?.name || 'No project'} · ${timeAgo(r.createdAt)}`,
      at: r.createdAt,
    })),
    ...(purchaseOrders ?? []).map((po) => ({
      icon: ShoppingCart,
      tone: 'default' as const,
      title: `Purchase Order ${po.poNumber} Created`,
      detail: `${po.supplier.name} · ${formatMoney(po.totalAmount)} · ${timeAgo(po.createdAt)}`,
      at: po.createdAt,
    })),
    ...(projects ?? []).map((p) => ({
      icon: FolderKanban,
      tone: 'default' as const,
      title: `Project "${p.name}" Created`,
      detail: `${p.customer?.company || p.customer?.name || 'No customer'} · ${timeAgo(p.createdAt)}`,
      at: p.createdAt,
    })),
    ...(documents ?? []).map((d) => ({
      icon: FileText,
      tone: 'default' as const,
      title: `Document "${d.title}" Uploaded`,
      detail: `${d.uploadedBy.name || d.uploadedBy.email} · ${timeAgo(d.createdAt)}`,
      at: d.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5)

  const loaded =
    customers !== null &&
    invoices !== null &&
    expenses !== null &&
    quotations !== null &&
    contracts !== null &&
    projects !== null &&
    requisitions !== null &&
    purchaseOrders !== null &&
    documents !== null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Engineering Dashboard</h1>
          <p className="mt-1 text-sm text-ink-300">
            Real-time oversight of operations and financial performance.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-900 px-4 py-2 text-sm text-ink-200 hover:bg-ink-800">
            <Calendar className="h-4 w-4" />
            Last 30 Days
          </button>
          <button className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-800 px-4 py-2 text-sm text-ink-100 hover:bg-ink-700">
            <Download className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/dashboard/erp/finance/customers" className="block">
          <StatCard label="TOTAL CUSTOMERS" value={customers === null ? '—' : customers.length} />
        </Link>
        <Link to="/dashboard/erp/finance/quotations" className="block">
          <StatCard
            label="ACTIVE QUOTATIONS"
            value={quotations === null ? '—' : activeQuotations.length}
            delta={quotations === null ? undefined : `${activeQuotations.length} Pending`}
            deltaTone="warning"
          />
        </Link>
        <Link to="/dashboard/erp/finance/invoices" className="block">
          <StatCard
            label="MONTHLY REVENUE"
            value={invoices === null ? '—' : formatMoney(monthlyRevenue)}
          />
        </Link>
        <Link to="/dashboard/erp/inventory" className="block">
          <StatCard
            label="INVENTORY ITEMS"
            value={inventory === null ? '—' : inventory.length}
            delta={
              inventory === null
                ? undefined
                : lowStockItems.length > 0
                  ? `${lowStockItems.length} Low Stock`
                  : 'All stocked'
            }
            deltaTone="warning"
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/dashboard/erp/projects" className="block">
          <StatCard label="ACTIVE PROJECTS" value={projects === null ? '—' : activeProjects.length} />
        </Link>
        <Link to="/dashboard/erp/procurement/requisitions" className="block">
          <StatCard
            label="PENDING REQUISITIONS"
            value={requisitions === null ? '—' : pendingRequisitions.length}
            delta={requisitions !== null && pendingRequisitions.length > 0 ? 'Needs approval' : undefined}
            deltaTone="warning"
          />
        </Link>
        <Link to="/dashboard/erp/procurement/purchase-orders" className="block">
          <StatCard label="OPEN PURCHASE ORDERS" value={purchaseOrders === null ? '—' : openPurchaseOrders.length} />
        </Link>
        <Link to="/dashboard/erp/hr/employees" className="block">
          <StatCard label="ACTIVE HEADCOUNT" value={employees === null ? '—' : activeHeadcount.length} />
        </Link>
        {canSeeHr && (
          <Link to="/dashboard/erp/hr/leave" className="block">
            <StatCard
              label="LEAVE PENDING APPROVAL"
              value={pendingLeaveCount === null ? '—' : pendingLeaveCount}
              delta={pendingLeaveCount !== null && pendingLeaveCount > 0 ? 'Needs approval' : undefined}
              deltaTone="warning"
            />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Monthly Revenue Trend"
          action={<span className="text-xs font-semibold text-cyan-accent">LAST 10 MONTHS</span>}
        >
          <BarChart data={revenueTrend} highlight={(_, i) => i === revenueTrend.length - 1} />
        </Panel>

        <Panel title="Finance Summary">
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border-l-2 border-cyan-accent bg-ink-800 px-4 py-3">
              <div className="text-[11px] font-semibold tracking-widest text-ink-400">REVENUE</div>
              <div className="mt-1 text-lg font-semibold text-cyan-accent">{formatMoney(revenue)}</div>
            </div>
            <div className="rounded-lg border-l-2 border-ink-600 bg-ink-800 px-4 py-3">
              <div className="text-[11px] font-semibold tracking-widest text-ink-400">EXPENSES</div>
              <div className="mt-1 text-lg font-semibold text-ink-100">{formatMoney(totalExpenses)}</div>
            </div>
            <div className="rounded-lg border-l-2 border-cyan-accent bg-ink-800 px-4 py-3">
              <div className="text-[11px] font-semibold tracking-widest text-ink-400">PROFIT</div>
              <div className="mt-1 text-lg font-semibold text-cyan-accent">{formatMoney(profit)}</div>
            </div>
            <div className="rounded-lg border-l-2 border-red-400/70 bg-ink-800 px-4 py-3">
              <div className="text-[11px] font-semibold tracking-widest text-ink-400">
                OUTSTANDING INVOICES
              </div>
              <div className="mt-1 text-lg font-semibold text-ink-100">{formatMoney(outstanding)}</div>
            </div>
          </div>
          <Link
            to="/dashboard/erp/finance/invoices"
            className="mt-4 block w-full rounded-md border border-ink-700 py-2.5 text-center text-sm text-cyan-accent hover:bg-ink-800"
          >
            View Full Statement
          </Link>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Sales Pipeline"
          action={<span className="text-xs text-ink-400">CONVERSION RATE: {conversionRate}%</span>}
        >
          <span className="inline-block rounded bg-cyan-accent/10 px-2 py-1 text-[11px] font-semibold tracking-widest text-cyan-accent">
            QUOTATIONS → CONTRACTS
          </span>
          <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
            <span />
            <span className="text-cyan-accent">{pipelineProgress}% Complete</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div className="h-full rounded-full bg-cyan-accent" style={{ width: `${pipelineProgress}%` }} />
          </div>

          <div className="mt-8 flex items-center">
            {PIPELINE_STEPS.map((step, i) => {
              const active =
                (step.label === 'CUSTOMERS' && (customers?.length ?? 0) > 0) ||
                (step.label === 'QUOTE' && (quotations?.length ?? 0) > 0) ||
                (step.label === 'CONTRACT' && (contracts?.length ?? 0) > 0)
              return (
                <div key={step.label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                        active ? 'border-cyan-accent text-cyan-accent' : 'border-ink-600 text-ink-500'
                      }`}
                    >
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] tracking-widest text-ink-400">{step.label}</span>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div className="mx-2 mt-[-18px] h-px flex-1 bg-ink-700" />
                  )}
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel
          title="Inventory Alerts"
          icon={AlertTriangle}
          action={
            <Link
              to="/dashboard/erp/inventory"
              className="text-xs font-semibold text-cyan-accent hover:underline"
            >
              Manage &gt;
            </Link>
          }
        >
          {inventory === null ? (
            <TableSkeleton rows={2} cols={2} />
          ) : lowStockItems.length === 0 ? (
            <EmptyState icon={AlertTriangle} message="No low-stock items." />
          ) : (
            <div className="flex flex-col gap-3">
              {lowStockItems.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-lg bg-ink-800 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-ink-100">{item.name}</span>
                    <span className="shrink-0 text-sm font-semibold text-red-400">
                      {item.quantity} {item.unitOfMeasure}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-ink-400">
                    <span>SKU: {item.sku}</span>
                    <span>Min: {item.minStockLevel}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Active Projects"
          icon={FolderKanban}
          action={
            <Link
              to="/dashboard/erp/projects"
              className="text-xs font-semibold text-cyan-accent hover:underline"
            >
              View All &gt;
            </Link>
          }
        >
          {projects === null ? (
            <TableSkeleton rows={3} cols={4} />
          ) : activeProjects.length === 0 ? (
            <EmptyState icon={FolderKanban} message="No active projects." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] tracking-widest text-ink-400">
                    <th className="pb-3 font-semibold">PROJECT</th>
                    <th className="pb-3 font-semibold">CUSTOMER</th>
                    <th className="pb-3 font-semibold">STATUS</th>
                    <th className="pb-3 font-semibold">BUDGET</th>
                  </tr>
                </thead>
                <tbody>
                  {[...activeProjects]
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                    .slice(0, 5)
                    .map((p) => (
                      <tr key={p.id} className="border-t border-ink-800">
                        <td className="py-3 text-ink-100">{p.name}</td>
                        <td className="py-3 text-ink-300">{p.customer?.company || p.customer?.name || '—'}</td>
                        <td className="py-3">
                          <Badge tone={projectStatusTone[p.status]}>{p.status.replace('_', ' ')}</Badge>
                        </td>
                        <td className="py-3 font-medium text-ink-100">{p.budget ? formatMoney(p.budget) : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Requisitions Awaiting Approval"
          icon={ClipboardList}
          action={
            <Link
              to="/dashboard/erp/procurement/requisitions"
              className="text-xs font-semibold text-cyan-accent hover:underline"
            >
              View All &gt;
            </Link>
          }
        >
          {requisitions === null ? (
            <TableSkeleton rows={3} cols={2} />
          ) : pendingRequisitions.length === 0 ? (
            <EmptyState icon={ClipboardList} message="Nothing waiting for approval." />
          ) : (
            <div className="flex flex-col gap-3">
              {pendingRequisitions.slice(0, 5).map((r) => (
                <div key={r.id} className="rounded-lg bg-ink-800 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-ink-100">{r.requisitionNumber}</span>
                    <span className="shrink-0 text-xs text-ink-400">{r.items.length} item{r.items.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-ink-400">
                    <span>{r.project?.name || 'No project'}</span>
                    <span>Needed {formatDate(r.neededByDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Active Customer Contracts"
          action={
            <Link
              to="/dashboard/erp/finance/contracts"
              className="text-xs font-semibold text-cyan-accent hover:underline"
            >
              View All &gt;
            </Link>
          }
        >
          {contracts === null ? (
            <TableSkeleton rows={3} cols={4} />
          ) : activeContracts.length === 0 ? (
            <EmptyState icon={Receipt} message="No active contracts yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] tracking-widest text-ink-400">
                    <th className="pb-3 font-semibold">COMPANY</th>
                    <th className="pb-3 font-semibold">SERVICE</th>
                    <th className="pb-3 font-semibold">CONTRACT VALUE</th>
                    <th className="pb-3 font-semibold">STATUS</th>
                    <th className="pb-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {activeContracts.slice(0, 5).map((c) => {
                    const label = c.customer.company || c.customer.name
                    return (
                      <tr key={c.id} className="border-t border-ink-800">
                        <td className="flex items-center gap-3 py-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-700 text-xs font-semibold text-ink-200">
                            {label[0]?.toUpperCase()}
                          </span>
                          {label}
                        </td>
                        <td className="py-3 text-ink-300">{c.service}</td>
                        <td className="py-3 font-medium text-ink-100">{formatMoney(c.value)}</td>
                        <td className="py-3">
                          <Badge tone={contractStatusTone[c.status]}>{c.status.replace('_', ' ')}</Badge>
                        </td>
                        <td className="py-3 text-ink-400">
                          <MoreHorizontal className="h-4 w-4" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Recent Activity">
          {!loaded ? (
            <TableSkeleton rows={4} cols={1} />
          ) : activity.length === 0 ? (
            <EmptyState icon={UserCheck} message="No activity yet." />
          ) : (
            <div className="flex flex-col gap-4">
              {activity.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      item.tone === 'accent'
                        ? 'bg-cyan-accent/15 text-cyan-accent'
                        : item.tone === 'warning'
                          ? 'bg-red-400/15 text-red-400'
                          : 'bg-ink-700 text-ink-300'
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <div className="text-sm text-ink-100">{item.title}</div>
                    <div className="mt-0.5 text-xs text-ink-400">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

export default TechnetErpPage
