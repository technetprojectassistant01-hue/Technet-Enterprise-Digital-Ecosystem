import { ADMIN_GUIDE } from './adminGuide'
import type { GuideTopic, RoleGuide } from './types'

/**
 * The Storekeeper guide (role STOREKEEPER). The store and procurement topics read the same as in
 * the Admin guide, so they are taken from it by id; the rest is the storekeeper's own. Written
 * against the live app on 2026-10-19.
 */

const adminTopics = new Map(ADMIN_GUIDE.chapters.flatMap((c) => c.topics).map((t) => [t.id, t]))

/** A topic from the Admin guide. Fails loudly at start-up if the id was renamed there. */
function shared(id: string): GuideTopic {
  const topic = adminTopics.get(id)
  if (!topic) throw new Error(`Storekeeper guide: no Admin guide topic "${id}"`)
  return topic
}

export const STOREKEEPER_GUIDE: RoleGuide = {
  title: 'Storekeeper guide',
  intro:
    'How to run the store in Technet Digital: tools and equipment, materials, the requests that come in for them, and inventory and purchasing in the ERP. It follows your menu from top to bottom.',
  roles: ['STOREKEEPER'],
  updated: '2026-10-19',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Getting started',
      topics: [
        {
          id: 'your-role',
          title: 'What the storekeeper does',
          blocks: [
            { kind: 'p', text: 'You look after the store: tools and equipment handed out one by one, materials kept by quantity, and buying stock through the ERP. The app opens on Technet Store → Tools & Equipment.' },
            {
              kind: 'list',
              items: [
                'Technet Store: you add tools and materials, issue them against requests, record returns and correct stock.',
                'Technet ERP: Inventory, Suppliers, Requisitions and Purchase Orders.',
                'Technet Operations: work orders and reports, view only.',
                'You do not check in or out, and you have no My Leave or My Documents page.',
                'Logins and passwords are managed by an administrator.',
              ],
            },
          ],
        },
        shared('finding-your-way'),
        {
          id: 'notifications',
          title: 'Notifications',
          blocks: [
            { kind: 'p', text: 'The bell in the header tells you when someone sends or changes a tool request or a material request. Click one to open it. Mark all read clears the count.' },
            { kind: 'note', text: 'These notifications appear inside the app only. Nobody gets an email or SMS for them.' },
          ],
        },
        shared('install-language'),
        shared('slow-first-load'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Technet Store',
      intro: 'Tools and equipment are tracked one by one. Materials such as glue, tape or screws are tracked by quantity. Anyone with an employee record can send you a request.',
      topics: [
        shared('tools'),
        {
          id: 'tool-statuses',
          title: 'Tool status and condition',
          path: '/dashboard/store/tools',
          blocks: [
            {
              kind: 'list',
              items: [
                'Available: in the store and can be issued.',
                'Checked out: someone has it. This is set when you issue it and cleared when you record the return. You cannot change it by hand.',
                'Under repair: returned damaged, or sent for repair. Set it back to Available with Edit once it is fixed.',
                'Retired: no longer used. Retire a tool instead of deleting it so its history is kept.',
                'Condition (Good, Fair, Damaged) is recorded when you add the tool and again on each return.',
              ],
            },
            { kind: 'tip', text: 'Search the register by tag, name or serial number. Overdue tools are marked so you can chase them.' },
          ],
        },
        shared('tool-requests'),
        shared('materials'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'erp',
      title: 'Inventory and purchasing',
      intro: 'Technet ERP → Inventory and Procurement. These are separate from the store\'s Materials: buying here adds to Inventory, not to Materials.',
      topics: [
        {
          id: 'inventory',
          title: 'Inventory',
          path: '/dashboard/erp/inventory',
          blocks: [
            {
              kind: 'list',
              items: [
                'Add Item creates an item with its SKU, category, unit of measure, unit cost, location, opening quantity and minimum stock level.',
                'Adjust stock records Stock In, Stock Out or an Adjustment, with an optional reason. The Stock Ledger lists every movement.',
                'Items at or below their minimum level count as LOW STOCK.',
                'Goods received on a purchase order are added to Inventory automatically for lines linked to an item.',
              ],
            },
          ],
        },
        {
          id: 'requisitions',
          title: 'Approve requisitions',
          path: '/dashboard/erp/procurement/requisitions',
          blocks: [
            { kind: 'p', text: 'A requisition is an office request to buy something. Office staff create them with New Requisition; you and the administrator decide.' },
            {
              kind: 'steps',
              items: [
                'Open Technet ERP → Procurement → Requisitions and open a requisition AWAITING APPROVAL.',
                'Approve it, or Reject it with a reason. The person who asked is notified.',
                'For an approved requisition, click Convert to Purchase Order, choose the supplier and enter the unit costs.',
              ],
            },
          ],
        },
        shared('procurement'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'operations',
      title: 'Work orders and reports (view only)',
      topics: [
        {
          id: 'operations-view',
          title: 'Work orders and reports',
          path: '/dashboard/operations/work-orders',
          blocks: [
            { kind: 'p', text: 'Technet Operations shows the jobs scheduled for technicians and the daily and intervention reports they file. Intervention reports list the materials used on each visit.' },
            { kind: 'note', text: 'Creating jobs and approving reports is done by an administrator or the Operations Manager.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'account',
      title: 'Your account',
      topics: [
        {
          id: 'account-security',
          title: 'Password and sign-in history',
          path: '/dashboard/security',
          blocks: [
            {
              kind: 'list',
              items: [
                'Your password is managed by an administrator. If you forget it, ask them to reset it in User Management.',
                'Security → My Account lists your own recent sign-ins.',
                'You stay signed in for 30 days, and the 30 days restart each time you use the app. Log out at the bottom of the menu signs you out immediately.',
              ],
            },
          ],
        },
      ],
    },
  ],
}
