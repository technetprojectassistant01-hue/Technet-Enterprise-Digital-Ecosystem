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
  Truck,
  ClipboardList,
  CalendarClock,
  ClipboardCheck,
  CalendarDays,
  BadgeCheck,
  Box,
  AlertTriangle,
  Banknote,
  MapPinned,
  Radar,
  type LucideIcon,
} from 'lucide-react'
import { FIELD_ONLY_ROLES } from '../lib/permissions'
import type { Role } from '../lib/api'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
  children?: NavItem[]
  /** Roles this item is hidden from, e.g. field-only staff who don't use this module. */
  hiddenFrom?: readonly Role[]
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Overview', to: '/dashboard', icon: LayoutGrid, end: true },
  {
    label: 'Technet ERP',
    to: '/dashboard/erp',
    icon: SlidersHorizontal,
    end: true,
    hiddenFrom: FIELD_ONLY_ROLES,
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
      {
        label: 'Procurement',
        to: '/dashboard/erp/procurement',
        icon: ShoppingCart,
        children: [
          { label: 'Suppliers', to: '/dashboard/erp/procurement/suppliers', icon: Truck },
          { label: 'Requisitions', to: '/dashboard/erp/procurement/requisitions', icon: ClipboardList },
          { label: 'Purchase Orders', to: '/dashboard/erp/procurement/purchase-orders', icon: ShoppingCart },
        ],
      },
      {
        label: 'HR',
        to: '/dashboard/erp/hr',
        icon: Users,
        children: [
          { label: 'Overview', to: '/dashboard/erp/hr', icon: LayoutGrid, end: true },
          { label: 'Employees', to: '/dashboard/erp/hr/employees', icon: UserCog },
          { label: 'Leave', to: '/dashboard/erp/hr/leave', icon: CalendarDays },
          { label: 'Attendance', to: '/dashboard/erp/hr/attendance', icon: ClipboardCheck },
          { label: 'Certifications', to: '/dashboard/erp/hr/certifications', icon: BadgeCheck },
        ],
      },
      { label: 'Projects', to: '/dashboard/erp/projects', icon: FolderKanban },
      { label: 'Documents', to: '/dashboard/erp/documents', icon: FileText },
    ],
  },
  {
    label: 'Technet Maintenance',
    to: '/dashboard/maintenance',
    icon: Wrench,
    children: [
      { label: 'Assets', to: '/dashboard/maintenance/assets', icon: Box },
      { label: 'Contracts', to: '/dashboard/maintenance/contracts', icon: ScrollText },
      { label: 'Requests', to: '/dashboard/maintenance/requests', icon: AlertTriangle },
      { label: 'Schedule', to: '/dashboard/maintenance/schedule', icon: CalendarClock },
    ],
  },
  { label: 'Technet Connect', to: '/dashboard/connect', icon: Share2, hiddenFrom: FIELD_ONLY_ROLES },
  {
    label: 'Technet Operations',
    to: '/dashboard/operations',
    icon: Workflow,
    children: [
      { label: 'Work Orders', to: '/dashboard/operations/work-orders', icon: CalendarClock },
      { label: 'Daily Reports', to: '/dashboard/operations/daily-reports', icon: ClipboardList },
      { label: 'Intervention Reports', to: '/dashboard/operations/intervention-reports', icon: ClipboardCheck },
      { label: 'Team Attendance', to: '/dashboard/operations/team-attendance', icon: MapPinned },
      { label: 'Field Operations', to: '/dashboard/operations/field-tracking', icon: Radar },
    ],
  },
  {
    label: 'Technet Workforce',
    to: '/dashboard/workforce',
    icon: Users,
    hiddenFrom: FIELD_ONLY_ROLES,
    children: [{ label: 'Payroll', to: '/dashboard/workforce/payroll', icon: Banknote }],
  },
  { label: 'Technet Digital Marketing', to: '/dashboard/marketing', icon: Megaphone, hiddenFrom: FIELD_ONLY_ROLES },
  { label: 'Technet Insight', to: '/dashboard/insight', icon: LineChart, hiddenFrom: FIELD_ONLY_ROLES },
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
