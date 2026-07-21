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
  Landmark,
  ShoppingCart,
  FolderKanban,
  FileText,
  Contact,
  Receipt,
  CreditCard,
  FileSignature,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
  children?: NavItem[]
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Overview', to: '/dashboard', icon: LayoutGrid, end: true },
  {
    label: 'Technet ERP',
    to: '/dashboard/erp',
    icon: SlidersHorizontal,
    end: true,
    children: [
      { label: 'Overview', to: '/dashboard/erp', icon: LayoutGrid, end: true },
      { label: 'Inventory', to: '/dashboard/erp/inventory', icon: SlidersHorizontal },
      {
        label: 'Finance',
        to: '/dashboard/erp/finance',
        icon: Landmark,
        children: [
          { label: 'Customers', to: '/dashboard/erp/finance/customers', icon: Contact },
          { label: 'Invoices', to: '/dashboard/erp/finance/invoices', icon: Receipt },
          { label: 'Expenses', to: '/dashboard/erp/finance/expenses', icon: CreditCard },
          { label: 'Quotations', to: '/dashboard/erp/finance/quotations', icon: FileSignature },
          { label: 'Contracts', to: '/dashboard/erp/finance/contracts', icon: ScrollText },
        ],
      },
      { label: 'Procurement', to: '/dashboard/erp/procurement', icon: ShoppingCart },
      { label: 'HR', to: '/dashboard/erp/hr', icon: Users },
      { label: 'Projects', to: '/dashboard/erp/projects', icon: FolderKanban },
      { label: 'Documents', to: '/dashboard/erp/documents', icon: FileText },
    ],
  },
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
