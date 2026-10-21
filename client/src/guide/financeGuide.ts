import { ADMIN_GUIDE } from './adminGuide'
import { HR_GUIDE } from './hrGuide'
import { SALES_GUIDE } from './salesGuide'
import { topicsFrom } from './shared'
import { TECHNICIAN_GUIDE } from './technicianGuide'
import type { RoleGuide } from './types'

/**
 * The Finance Officer guide (role FINANCE_OFFICER). Finance manages customers (CUSTOMER_MANAGE_ROLES)
 * and contracts (FINANCE_ROLES), and only reads quotations (SALES_ROLES write them). Invoices and
 * expenses are kept in QuickBooks, not in the app. Like Sales, Finance does not check in (user
 * decision 2026-10-19). Shared topics come from the Admin, Sales, HR and Technician guides.
 * Written against the live app on 2026-10-20.
 */

const admin = topicsFrom(ADMIN_GUIDE)
const sales = topicsFrom(SALES_GUIDE)
const hr = topicsFrom(HR_GUIDE)
const tech = topicsFrom(TECHNICIAN_GUIDE)

export const FINANCE_GUIDE: RoleGuide = {
  title: 'Finance Officer guide',
  intro:
    'How a Finance Officer works in Technet Digital: customer records and portal access, service contracts, quotations, documents and purchase requests. Each topic is one task, step by step.',
  roles: ['FINANCE_OFFICER'],
  updated: '2026-10-20',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Getting started',
      topics: [
        {
          id: 'your-role',
          title: 'What a Finance Officer can do',
          blocks: [
            { kind: 'p', text: 'The app opens on Technet ERP, where the Overview shows customers, quotations, contracts and recent activity.' },
            {
              kind: 'list',
              items: [
                'You add and edit customers, including their billing details (BRN, VAT number), and give them portal access.',
                'You record and update service contracts.',
                'You can read every quotation and its call history, download its PDF and email it, but creating and changing quotations is done by Sales.',
                'You can upload documents and ask for purchases with a requisition.',
                'Projects, inventory, suppliers, purchase orders and Technet Operations are view-only for you.',
                'You do not check in or out, so there is no Attendance page in your menu. My Leave and My Documents work once HR has linked your login to your employee record.',
                'Logins are created by an administrator. You cannot create or reset logins.',
              ],
            },
            { kind: 'note', text: 'Invoices and expenses are kept in QuickBooks, not in this app.' },
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
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'customers',
      title: 'Customers and contracts',
      intro: 'Technet ERP → Customers holds four pages: Customers, Quotations, Follow-Up and Contracts.',
      topics: [
        admin('customers'),
        {
          id: 'contracts',
          title: 'Contracts',
          path: '/dashboard/erp/customers/contracts',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open Technet ERP → Customers → Contracts and click New Contract. The customer must exist first.',
                'Choose the CUSTOMER, describe the SERVICE, and enter the VALUE, the STATUS, the START DATE and the END DATE.',
                'Click Create Contract.',
              ],
            },
            { kind: 'p', text: 'Use the edit and delete actions at the end of a row to change a contract (for example its status once it is completed) or remove it.' },
          ],
        },
        {
          id: 'quotations-view',
          title: 'Quotations (view only)',
          path: '/dashboard/erp/customers/quotations',
          blocks: [
            {
              kind: 'list',
              items: [
                'Quotations lists every quotation with its customer, status and total. Open one to see its lines, payment terms and attachments.',
                'Download PDF saves the quotation as a PDF. Email Customer downloads it and opens an email with the text ready; attach the PDF yourself before sending.',
                'Follow-Up lists quotations by customer or by date, to see what was quoted and when.',
                'Follow-Up on a quotation shows each call Sales logged: the date, who they spoke to and the outcome.',
                'Creating, editing and marking quotations (sent, approved, not approved), logging calls and the Call Log of quote requests are for Sales.',
              ],
            },
          ],
        },
        admin('connect'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'erp-other',
      title: 'Documents, purchases and the rest of the ERP',
      topics: [sales('documents'), sales('requisitions'), sales('view-only')],
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
      topics: [hr('account-security'), sales('support')],
    },
  ],
}
