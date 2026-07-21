import {
  LayoutGrid,
  SlidersHorizontal,
  Wrench,
  Share2,
  Workflow,
  Users,
  Megaphone,
  LineChart,
  Settings,
  ShieldCheck,
  UserCog,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Overview', to: '/dashboard', icon: LayoutGrid, end: true },
  { label: 'Technet ERP', to: '/dashboard/erp', icon: SlidersHorizontal },
  { label: 'Technet Maintenance', to: '/dashboard/maintenance', icon: Wrench },
  { label: 'Technet Connect', to: '/dashboard/connect', icon: Share2 },
  { label: 'Technet Operations', to: '/dashboard/operations', icon: Workflow },
  { label: 'Technet Workforce', to: '/dashboard/workforce', icon: Users },
  { label: 'Technet Digital Marketing', to: '/dashboard/marketing', icon: Megaphone },
  { label: 'Technet Insight', to: '/dashboard/insight', icon: LineChart },
]

export const SYSTEM_NAV: NavItem[] = [
  { label: 'Settings', to: '/dashboard/settings', icon: Settings },
  { label: 'Security', to: '/dashboard/security', icon: ShieldCheck },
]

export const ADMIN_NAV: NavItem = {
  label: 'User Management',
  to: '/dashboard/users',
  icon: UserCog,
}
