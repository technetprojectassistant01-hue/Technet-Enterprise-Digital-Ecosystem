import { AlertTriangle } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { Panel, BarChart } from './dashboard/ui'

const TRAFFIC_DATA = [
  { label: '00:00', value: 2100 },
  { label: '', value: 2900 },
  { label: '', value: 2500 },
  { label: '', value: 3400 },
  { label: '12:00', value: 3100 },
  { label: '', value: 4200 },
  { label: '', value: 3800 },
  { label: '', value: 3300 },
  { label: '18:00', value: 3700 },
  { label: 'NOW', value: 4100 },
]

const ALERTS = [
  { code: 'NODE_SYNC_COMPLETE', detail: 'Region: US-EAST-1 · 2m ago' },
  { code: 'BACKUP_SCHEDULED', detail: 'System-wide · 15m ago' },
  { code: 'AUTH_LOG_CLEARED', detail: 'Admin: AS · 1h ago' },
]

const MODULE_STATS = [
  {
    label: 'TECHNET ERP',
    rows: [
      { name: 'Inventory Accuracy', value: '99.8%' },
      { name: 'Active Work Orders', value: '14' },
    ],
  },
  {
    label: 'TECHNET CONNECT',
    rows: [
      { name: 'New Quote Requests', value: '24' },
      { name: 'Active Channels', value: '12' },
    ],
  },
  {
    label: 'TECHNET WORKFORCE',
    rows: [
      { name: 'Attendance Sync', value: 'Active' },
      { name: 'Staff Online', value: '142' },
    ],
  },
  {
    label: 'TECHNET INSIGHT',
    rows: [{ name: 'Executive KPI', value: 'Optimal' }],
  },
]

function DashboardHome() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <span className="text-xs font-semibold tracking-widest text-cyan-accent">
            GLOBAL SYSTEM HEALTH
          </span>
          <h1 className="mt-1 text-3xl font-bold text-ink-100">Technet Ecosystem</h1>
        </div>
        <div className="flex gap-8 rounded-xl border border-ink-700 bg-ink-900 px-6 py-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-ink-400">NODES</div>
            <div className="mt-1 text-xl font-semibold text-ink-100">12/12</div>
          </div>
          <div>
            <div className="text-xs font-semibold tracking-widest text-ink-400">LATENCY</div>
            <div className="mt-1 text-xl font-semibold text-ink-100">14ms</div>
          </div>
          <div>
            <div className="text-xs font-semibold tracking-widest text-ink-400">TRAFFIC</div>
            <div className="mt-1 text-xl font-semibold text-cyan-accent">94%</div>
          </div>
        </div>
      </div>

      <Panel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-xs font-semibold tracking-widest text-cyan-accent">
              COMPANY PROFILE
            </span>
            <h2 className="mt-1 text-xl font-semibold text-ink-100">Technet Engineering</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-300">
              A Mauritius-based multi-service engineering firm with over 10 years of history in
              delivering digital kineticism and enterprise solutions across the region.
              {user?.name ? ` Welcome back, ${user.name}.` : ''}
            </p>
          </div>
          <div className="flex gap-8 sm:text-right">
            <div>
              <div className="text-xs font-semibold tracking-widest text-ink-400">ESTABLISHED</div>
              <div className="mt-1 text-lg font-semibold text-cyan-accent">2014</div>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-widest text-ink-400">HQ</div>
              <div className="mt-1 text-lg font-semibold text-cyan-accent">Mauritius</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="System Load & Request Traffic"
          action={<span className="text-xs font-semibold text-cyan-accent">REAL-TIME TRAFFIC</span>}
        >
          <div className="mb-2 flex justify-between text-[11px] text-ink-400">
            <span>REQ VOLUME (0 - 5K)</span>
            <span>PEAK: 4.2K</span>
          </div>
          <BarChart data={TRAFFIC_DATA} highlight={(_, i) => i === 5} />
        </Panel>

        <Panel title="Critical Alerts" icon={AlertTriangle}>
          <div className="flex flex-col gap-3">
            {ALERTS.map((alert, i) => (
              <div
                key={alert.code}
                className={`rounded-lg border-l-2 bg-ink-800 px-4 py-3 ${
                  i === 0 ? 'border-cyan-accent' : 'border-ink-600'
                }`}
              >
                <div className="text-xs font-semibold tracking-wide text-ink-100">{alert.code}</div>
                <div className="mt-1 text-xs text-ink-400">{alert.detail}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {MODULE_STATS.map((mod) => (
          <Panel key={mod.label}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-widest text-ink-400">
                {mod.label}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-accent" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {mod.rows.map((row) => (
                <div key={row.name} className="flex items-center justify-between text-sm">
                  <span className="text-ink-300">{row.name}</span>
                  <span className="font-semibold text-ink-100">{row.value}</span>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  )
}

export default DashboardHome
