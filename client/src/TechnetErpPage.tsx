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
} from 'lucide-react'
import { Panel, StatCard, BarChart } from './dashboard/ui'

const REVENUE_DATA = [
  { label: 'JAN', value: 78 },
  { label: 'FEB', value: 92 },
  { label: 'MAR', value: 70 },
  { label: 'APR', value: 105 },
  { label: 'MAY', value: 138 },
  { label: 'JUN', value: 100 },
  { label: 'JUL', value: 112 },
  { label: 'AUG', value: 128 },
  { label: 'SEP', value: 96 },
  { label: 'OCT', value: 118 },
]

const FINANCE_ROWS = [
  { label: 'REVENUE', value: '$1,240,500.00', tone: 'accent' as const },
  { label: 'EXPENSES', value: '$842,200.00', tone: 'default' as const },
  { label: 'PROFIT', value: '$398,300.00', tone: 'accent' as const },
  { label: 'OUTSTANDING INVOICES', value: '$156,000.00', tone: 'warning' as const },
]

const PIPELINE_STEPS = [
  { label: 'LEAD', icon: UserPlus, active: true },
  { label: 'QUOTE', icon: FileText, active: true },
  { label: 'CONTRACT', icon: Radio, active: false },
  { label: 'PROJECT', icon: Wrench, active: false },
]

const INVENTORY_ALERTS = [
  { name: 'Electrical Cable (10mm)', sku: 'EC-10-993', status: '12m Left', sub: 'Min: 50m', tone: 'warning' as const },
  { name: 'PVC Pipe (4 Inch)', sku: 'PVC-4-002', status: '5 Units', sub: 'Min: 20 Units', tone: 'warning' as const },
  { name: 'Steel Mounting Brackets', sku: 'ST-BR-01', status: 'Low Stock', sub: 'Restock Soon', tone: 'muted' as const },
]

const CONTRACTS = [
  { initial: 'A', company: 'ABC Ltd', service: 'Substation Maintenance', value: '$45,000.00', status: 'In Progress' },
  { initial: 'X', company: 'XYZ Corp', service: 'Renewable Grid Link', value: '$128,400.00', status: 'Planning' },
  { initial: 'D', company: 'Delta Co', service: 'Instrumentation Setup', value: '$12,000.00', status: 'In Progress' },
]

const ACTIVITY = [
  { icon: Receipt, tone: 'accent' as const, title: 'Quotation QT-882 Created', detail: 'For Apex Engineering · 2 mins ago' },
  { icon: Receipt, tone: 'accent' as const, title: 'Invoice #8841 Paid', detail: '$12,400.00 received · 1 hour ago' },
  { icon: UserCheck, tone: 'default' as const, title: 'New Customer Added', detail: 'Solaris Power Ltd · 3 hours ago' },
  { icon: PackageX, tone: 'warning' as const, title: 'Stock Alert Triggered', detail: 'PVC Pipe (4 Inch) Low · 5 hours ago' },
]

const toneClasses: Record<'accent' | 'default' | 'warning', string> = {
  accent: 'border-cyan-accent',
  default: 'border-ink-600',
  warning: 'border-red-400/70',
}

const statusClasses: Record<string, string> = {
  'In Progress': 'bg-cyan-accent/10 text-cyan-accent',
  Planning: 'bg-ink-700 text-ink-300',
}

function TechnetErpPage() {
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
        <StatCard label="TOTAL CUSTOMERS" value="245" delta="+12%" />
        <StatCard label="ACTIVE QUOTATIONS" value="32" delta="8 Pending" deltaTone="warning" />
        <StatCard label="MONTHLY REVENUE" value="$1.2M" delta="+5.4%" />
        <StatCard label="INVENTORY ITEMS" value="124" delta="4 Low Stock" deltaTone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Monthly Revenue Trend"
          action={<span className="text-xs font-semibold text-cyan-accent">2026 PROJECTED</span>}
        >
          <BarChart data={REVENUE_DATA} highlight={(label) => label === 'MAY'} />
        </Panel>

        <Panel title="Finance Summary">
          <div className="flex flex-col gap-3">
            {FINANCE_ROWS.map((row) => (
              <div
                key={row.label}
                className={`rounded-lg border-l-2 bg-ink-800 px-4 py-3 ${toneClasses[row.tone]}`}
              >
                <div className="text-[11px] font-semibold tracking-widest text-ink-400">
                  {row.label}
                </div>
                <div
                  className={`mt-1 text-lg font-semibold ${
                    row.tone === 'accent' ? 'text-cyan-accent' : 'text-ink-100'
                  }`}
                >
                  {row.value}
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full rounded-md border border-ink-700 py-2.5 text-sm text-cyan-accent hover:bg-ink-800">
            View Full Statement
          </button>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Customer Pipeline"
          action={<span className="text-xs text-ink-400">CONVERSION RATE: 68%</span>}
        >
          <span className="inline-block rounded bg-cyan-accent/10 px-2 py-1 text-[11px] font-semibold tracking-widest text-cyan-accent">
            LEAD ACQUISITION
          </span>
          <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
            <span />
            <span className="text-cyan-accent">85% Complete</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div className="h-full w-[85%] rounded-full bg-cyan-accent" />
          </div>

          <div className="mt-8 flex items-center">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                      step.active
                        ? 'border-cyan-accent text-cyan-accent'
                        : 'border-ink-600 text-ink-500'
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
            ))}
          </div>
        </Panel>

        <Panel title="Inventory Alerts" icon={AlertTriangle}>
          <div className="flex flex-col gap-3">
            {INVENTORY_ALERTS.map((item) => (
              <div key={item.sku} className="rounded-lg bg-ink-800 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-ink-100">{item.name}</span>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      item.tone === 'warning' ? 'text-red-400' : 'text-ink-300'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-ink-400">
                  <span>SKU: {item.sku}</span>
                  <span>{item.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Active Customer Contracts"
          action={
            <a href="#" className="text-xs font-semibold text-cyan-accent hover:underline">
              View All &gt;
            </a>
          }
        >
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
                {CONTRACTS.map((c) => (
                  <tr key={c.company} className="border-t border-ink-800">
                    <td className="flex items-center gap-3 py-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-700 text-xs font-semibold text-ink-200">
                        {c.initial}
                      </span>
                      {c.company}
                    </td>
                    <td className="py-3 text-ink-300">{c.service}</td>
                    <td className="py-3 font-medium text-ink-100">{c.value}</td>
                    <td className="py-3">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          statusClasses[c.status] ?? 'bg-ink-700 text-ink-300'
                        }`}
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-ink-400">
                      <MoreHorizontal className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent Activity">
          <div className="flex flex-col gap-4">
            {ACTIVITY.map((item, i) => (
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
        </Panel>
      </div>
    </div>
  )
}

export default TechnetErpPage
