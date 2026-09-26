import {
  LayoutGrid,
  FileCheck2,
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
  ShoppingCart,
  FolderKanban,
  FileText,
  Contact,
  FileSignature,
  PhoneCall,
  ScrollText,
  Truck,
  ClipboardList,
  CalendarClock,
  ClipboardCheck,
  CalendarDays,
  CalendarCheck,
  IdCard,
  Clock,
  BadgeCheck,
  Hammer,
  Banknote,
  MapPinned,
  Radar,
  ShieldAlert,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'
import {
  ADMINISTRATIVE_ROLES,
  ERP_HIDDEN_ROLES,
  NON_ADMIN_ROLES,
  NON_COMMERCIAL_ROLES,
  NON_HR_ROLES,
  NON_OPS_MANAGE_ROLES,
} from '../lib/permissions'
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
  // The landing page is mainly the check-in/check-out card, so it's named for that.
  // A storekeeper neither checks in here nor reads the register, so the page is not theirs.
  { label: 'Attendance', to: '/dashboard', icon: Clock, end: true, hiddenFrom: ['STOREKEEPER'] },
  // Admin and HR approve leave rather than requesting it: Leave Approvals and Technet HR > Leave.
  { label: 'My Leave', to: '/dashboard/my-leave', icon: CalendarDays, hiddenFrom: ADMINISTRATIVE_ROLES },
  { label: 'Leave Approvals', to: '/dashboard/leave-approvals', icon: CalendarCheck, hiddenFrom: NON_ADMIN_ROLES },
  // Admin and HR read everyone's documents on the HR employee profile instead of keeping their own.
  { label: 'My Documents', to: '/dashboard/my-documents', icon: IdCard, hiddenFrom: ADMINISTRATIVE_ROLES },
  {
    label: 'Technet ERP',
    to: '/dashboard/erp',
    icon: SlidersHorizontal,
    end: true,
    hiddenFrom: ERP_HIDDEN_ROLES,
    children: [
      { label: 'Overview', to: '/dashboard/erp', icon: LayoutGrid, end: true, hiddenFrom: NON_COMMERCIAL_ROLES },
      { label: 'Inventory', to: '/dashboard/erp/inventory', icon: SlidersHorizontal },
      // Was Finance. Invoices and expenses live in QuickBooks, so only the customer side stays.
      {
        label: 'Customers',
        to: '/dashboard/erp/customers',
        icon: Contact,
        hiddenFrom: NON_COMMERCIAL_ROLES,
        children: [
          { label: 'Customers', to: '/dashboard/erp/customers', icon: Contact, end: true },
          { label: 'Quotations', to: '/dashboard/erp/customers/quotations', icon: FileSignature },
          { label: 'Follow-Up', to: '/dashboard/erp/customers/follow-up', icon: PhoneCall },
          { label: 'Contracts', to: '/dashboard/erp/customers/contracts', icon: ScrollText },
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
      { label: 'Projects', to: '/dashboard/erp/projects', icon: FolderKanban, hiddenFrom: NON_COMMERCIAL_ROLES },
      { label: 'Documents', to: '/dashboard/erp/documents', icon: FileText, hiddenFrom: NON_COMMERCIAL_ROLES },
    ],
  },
  // Technet HR holds everything about people. Employees, Leave and Certifications used to live
  // under Technet ERP and the rest under Technet Workforce, which split one job across two menus.
  {
    label: 'Technet HR',
    to: '/dashboard/hr',
    icon: Users,
    hiddenFrom: NON_HR_ROLES,
    children: [
      { label: 'Overview', to: '/dashboard/hr', icon: LayoutGrid, end: true },
      { label: 'Employees', to: '/dashboard/hr/employees', icon: UserCog },
      { label: 'Leave', to: '/dashboard/hr/leave', icon: CalendarDays },
      { label: 'Overtime', to: '/dashboard/hr/overtime', icon: Clock },
      { label: 'Validations', to: '/dashboard/hr/validations', icon: FileCheck2 },
      { label: 'Payroll', to: '/dashboard/hr/payroll', icon: Banknote },
      { label: 'Certifications', to: '/dashboard/hr/certifications', icon: BadgeCheck },
      { label: 'Availability', to: '/dashboard/hr/availability', icon: UserCheck },
    ],
  },
  {
    label: 'Technet Store',
    to: '/dashboard/store',
    icon: Wrench,
    children: [
      { label: 'Tools & Equipment', to: '/dashboard/store/tools', icon: Hammer },
      { label: 'Tool Requests', to: '/dashboard/store/requests', icon: ClipboardList },
    ],
  },
  { label: 'Technet Connect', to: '/dashboard/connect', icon: Share2, hiddenFrom: NON_COMMERCIAL_ROLES },
  {
    label: 'Technet Operations',
    to: '/dashboard/operations',
    icon: Workflow,
    children: [
      { label: 'Work Orders', to: '/dashboard/operations/work-orders', icon: CalendarClock },
      { label: 'Daily Reports', to: '/dashboard/operations/daily-reports', icon: ClipboardList },
      { label: 'Intervention Reports', to: '/dashboard/operations/intervention-reports', icon: ClipboardCheck },
      // Manager-only screens: technicians and office roles don't see them in the menu.
      { label: 'Team Attendance', to: '/dashboard/operations/team-attendance', icon: MapPinned, hiddenFrom: NON_OPS_MANAGE_ROLES },
      { label: 'Field Operations', to: '/dashboard/operations/field-tracking', icon: Radar, hiddenFrom: NON_OPS_MANAGE_ROLES },
      { label: 'Attendance Anomalies', to: '/dashboard/operations/anomalies', icon: ShieldAlert, hiddenFrom: NON_OPS_MANAGE_ROLES },
    ],
  },
  { label: 'Technet Digital Marketing', to: '/dashboard/marketing', icon: Megaphone, hiddenFrom: NON_COMMERCIAL_ROLES },
  { label: 'Technet Insight', to: '/dashboard/insight', icon: LineChart, hiddenFrom: NON_ADMIN_ROLES },
]

/** The menu as a given role sees it: drops items (at any depth) that are hidden from that role. */
export function visibleNav(items: NavItem[], role: Role | undefined): NavItem[] {
  return items
    .filter((item) => !role || !item.hiddenFrom?.includes(role))
    .map((item) => (item.children ? { ...item, children: visibleNav(item.children, role) } : item))
}

export const SYSTEM_NAV: NavItem[] = [
  { label: 'Settings', to: '/dashboard/settings', icon: Settings },
  { label: 'Security', to: '/dashboard/security', icon: ShieldCheck },
]

export const ADMIN_NAV: NavItem = {
  label: 'User Management',
  to: '/dashboard/users',
  icon: UserCog,
}
