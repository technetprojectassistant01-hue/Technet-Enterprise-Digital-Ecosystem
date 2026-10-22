import { ADMIN_GUIDE } from './adminGuide'
import { HR_GUIDE } from './hrGuide'
import { topicsFrom } from './shared'
import { TECHNICIAN_GUIDE } from './technicianGuide'
import type { RoleGuide } from './types'

/**
 * The Sales Officer guide (role SALES_OFFICER). Customers, the Call Log, quotations, Connect and
 * Marketing read the same as for an administrator, so they come from the Admin guide; leave,
 * documents and store requests come from the Technician guide. Written here: what Sales can only
 * view (contracts, projects, inventory, purchase orders, operations), requisitions, and that Sales
 * does not check in (server check-in routes are OPS_SUBMIT_ROLES only). Written against the live
 * app on 2026-10-19.
 */

const admin = topicsFrom(ADMIN_GUIDE)
const hr = topicsFrom(HR_GUIDE)
const tech = topicsFrom(TECHNICIAN_GUIDE)

export const SALES_GUIDE: RoleGuide = {
  title: 'Sales Officer guide',
  intro:
    'How a Sales Officer works in Technet Digital: customers, quote requests, quotations and follow-ups, the customer portal and the marketing calendar. Each topic is one task, step by step.',
  roles: ['SALES_OFFICER'],
  updated: '2026-10-22',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Getting started',
      topics: [
        {
          id: 'your-role',
          title: 'What a Sales Officer can do',
          blocks: [
            { kind: 'p', text: 'Sales looks after customers and quotations. The app opens on Technet ERP, where the Overview shows customers, quotations, contracts and recent activity.' },
            {
              kind: 'list',
              items: [
                'You manage customers, quote requests (the Call Log), quotations and their follow-ups, and customer portal access.',
                'You plan posts in Technet Digital Marketing.',
                'You can upload documents and ask for purchases with a requisition.',
                'Contracts, projects, inventory, suppliers, purchase orders and Technet Operations are view-only for you.',
                'You do not check in or out, so there is no Attendance page in your menu. My Leave and My Documents work once HR has linked your login to your employee record.',
                'Logins are created by an administrator. You cannot create or reset logins.',
              ],
            },
          ],
        },
        tech('sign-in'),
        admin('finding-your-way'),
        {
          id: 'notifications',
          title: 'Notifications',
          blocks: [
            {
              kind: 'list',
              items: [
                'A customer asked for a quotation from the portal. Click it to open the Call Log.',
                'A quotation you created was marked Approved or Not Approved.',
                'Your requisition was approved or rejected.',
                'Your leave request was decided, or your tools or materials are ready to collect.',
              ],
            },
            { kind: 'p', text: 'Click a notification to go to the record. Mark all read clears the count.' },
            { kind: 'note', text: 'These notifications appear inside the app only. Nobody gets an email or SMS for them.' },
          ],
        },
        admin('install-language'),
        admin('slow-first-load'),
        admin('form-drafts'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'sales',
      title: 'Customers and quotations',
      intro: 'Technet ERP → Customers holds four pages: Customers, Quotations (with the Call Log), Follow-Up and Contracts.',
      topics: [
        admin('customers'),
        admin('quote-requests'),
        admin('quotations'),
        {
          id: 'follow-up-contracts',
          title: 'Follow-Up and Contracts',
          path: '/dashboard/erp/customers/follow-up',
          blocks: [
            {
              kind: 'list',
              items: [
                'Follow-Up lists the calls logged on quotations, by customer or by date. To log a call, open the quotation and use Follow-Up there.',
                'Contracts lists service contracts with customers, their value and their start and end dates. You can read them; adding or changing a contract is done by an administrator or the Finance Officer.',
              ],
            },
          ],
        },
        admin('connect'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'marketing',
      title: 'Marketing',
      topics: [admin('marketing')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'erp-other',
      title: 'Documents, purchases and the rest of the ERP',
      topics: [
        {
          id: 'documents',
          title: 'Documents',
          path: '/dashboard/erp/documents',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open Technet ERP → Documents and click Upload Document.',
                'Choose the FILE, give it a TITLE and a CATEGORY (contract, project, quotation…), and pick the PROJECT or CUSTOMER if it belongs to one.',
                'Click Upload Document. Everyone who can open Documents can find it there.',
              ],
            },
          ],
        },
        {
          id: 'requisitions',
          title: 'Ask for a purchase (requisition)',
          path: '/dashboard/erp/procurement/requisitions',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open Technet ERP → Procurement → Requisitions and click New Requisition.',
                'Enter a REQUISITION NUMBER (it must not already be used), the date it is NEEDED BY and, if it is for one, the PROJECT.',
                'Add a line for each thing needed: description, quantity and, if you know it, the unit cost. Click Add line item for more lines.',
                'Click Submit Requisition.',
              ],
            },
            { kind: 'p', text: 'The Storekeeper or an administrator approves or rejects it, and you get a notification either way. An approved requisition becomes a purchase order, which you can follow under Purchase Orders.' },
          ],
        },
        {
          id: 'view-only',
          title: 'What you can see but not change',
          blocks: [
            {
              kind: 'list',
              items: [
                'Projects: each project\'s customer, manager, dates and budget. Projects are run by an administrator or the Operations Manager.',
                'Inventory, Suppliers and Purchase Orders: stock levels and what has been ordered. The Storekeeper or an administrator keeps them up to date.',
                'Technet Operations: Work Orders, Daily Reports and Intervention Reports, to see where a customer\'s job stands. They are created and approved by the Operations Manager or an administrator.',
                'Technet Store: the tools and materials in the store.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'self-service',
      title: 'Leave, documents and the store',
      intro: 'These pages need your login linked to your employee record. If they say "No employee record is linked to your account", ask HR.',
      topics: [tech('request-leave'), tech('my-documents'), tech('request-tools'), tech('request-materials')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'account',
      title: 'Your account and help',
      topics: [
        hr('account-security'),
        {
          id: 'support',
          title: 'Who to ask',
          path: '/dashboard/help',
          blocks: [
            {
              kind: 'list',
              items: [
                'Password, sign-in email or a page you cannot see: the administrator.',
                'Leave, or My Leave and My Documents saying your account is not linked: HR.',
                'Anything else, or the app is not working: call support on 5885 1000 (the number is also in the Help Center).',
              ],
            },
          ],
        },
      ],
    },
  ],
}
