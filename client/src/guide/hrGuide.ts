import { ADMIN_GUIDE } from './adminGuide'
import { topicsFrom } from './shared'
import type { RoleGuide } from './types'

/**
 * The HR guide (role HR_OFFICER, shown as "HR"). Topics that read the same for HR as for an
 * administrator are taken from the Admin guide by id, so a feature change is written once; the
 * rest is HR's own (what HR can only view, where HR approves leave, what needs an administrator).
 * Written against the live app on 2026-10-19.
 */

const shared = topicsFrom(ADMIN_GUIDE)

export const HR_GUIDE: RoleGuide = {
  title: 'HR guide',
  intro:
    'How HR works in Technet Digital: employee records, leave, overtime, month-end validation, payroll and certifications, plus the staff attendance you check them against. It follows your menu from top to bottom.',
  roles: ['HR_OFFICER'],
  updated: '2026-10-23',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Getting started',
      topics: [
        {
          id: 'your-role',
          title: 'What HR can do',
          blocks: [
            { kind: 'p', text: 'HR looks after people: their records, leave, overtime, attendance validation and payroll. Your menu has Attendance, Technet HR, Technet Store and Technet Operations.' },
            {
              kind: 'list',
              items: [
                'You manage everything in Technet HR, including salaries, bank details and ID numbers.',
                'On the attendance register you can approve overtime and excuse absences.',
                'Technet Operations and Technet Store are view-only for you: you can see work orders, reports, attendance, anomalies and the store, but changing them is for administrators, the Operations Manager or the Storekeeper.',
                'You do not check in or out, and you have no My Leave or My Documents page. Your account does not need an employee record unless you are also paid through payroll.',
                'Logins are created by an administrator. You cannot create or reset logins.',
              ],
            },
          ],
        },
        shared('finding-your-way'),
        {
          id: 'notifications',
          title: 'Notifications',
          blocks: [
            { kind: 'p', text: 'The bell in the header shows what is waiting for HR: a leave request submitted or updated, and overtime to approve after a technician checks out late. Click one to go to the record. Mark all read clears the count.' },
            { kind: 'note', text: 'These notifications appear inside the app only. Nobody gets an email or SMS for them.' },
          ],
        },
        shared('install-language'),
        shared('slow-first-load'),
        shared('form-drafts'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'attendance',
      title: 'Staff attendance',
      intro: 'Technicians check in and out on their phones. Each check-in records the time and location they typed, the app\'s own time, a GPS position and usually a photo. HR reads this to approve overtime, validate months and run payroll.',
      topics: [
        shared('staff-attendance'),
        shared('absences'),
        shared('export-attendance'),
        {
          id: 'team-attendance',
          title: 'Team Attendance',
          path: '/dashboard/operations/team-attendance',
          blocks: [
            { kind: 'p', text: 'Technet Operations → Team Attendance is the full register, by month or by week.' },
            {
              kind: 'list',
              items: [
                'Month / Week switches the period. Use the arrows to move back and forward.',
                'Choose a technician to see one person. Tick Include past employees to see people who have left.',
                'Attendance Summary is the AiFace Monthly Report. Click a name to open that person\'s Daily Report.',
                'Attendance Register lists every visit day by day, with the check-in photo and the compliance checks.',
                'Export Month / Export Week downloads the Excel report and Download PDF the PDF, for the period on screen.',
              ],
            },
            { kind: 'note', text: 'Closing a forgotten check-in is done by an administrator or the Operations Manager. A shift still open after midnight is checked out automatically at its day\'s closing time (17:00, or 13:00 on Saturday).' },
          ],
        },
        {
          id: 'anomalies',
          title: 'Attendance anomalies (view only)',
          path: '/dashboard/operations/anomalies',
          blocks: [
            { kind: 'p', text: 'Technet Operations → Attendance Anomalies lists what the app could not verify: far from the job, checked in near home, impossible travel, possible fake GPS, a typed time or place that does not match, low GPS accuracy, missed pings or failed compliance checks.' },
            {
              kind: 'list',
              items: [
                'You can read every anomaly and filter by status, type, severity, employee and dates. Deciding them (Confirm Genuine, False Positive, Violation, Dismiss) is for an administrator or the Operations Manager.',
                'Overtime on a day with open anomalies shows a warning before you approve it.',
                'You cannot validate a person\'s month while they have open High anomalies. Ask Operations to review them first.',
              ],
            },
            { kind: 'note', text: 'An anomaly is a reason to look, not proof of wrongdoing. GPS drifts indoors, and a typed place name like "Moka" resolves to the middle of the area, several kilometres from a real site.' },
          ],
        },
        {
          id: 'field-ops',
          title: 'Field Operations, Live Map and Known Places (view only)',
          path: '/dashboard/operations/live-map',
          blocks: [
            {
              kind: 'list',
              items: [
                'Field Operations lists who is checked in right now, where they said they are and for how long.',
                'Live Map shows everyone on shift: where they checked in and where they were last seen. Green is near the check-in and seen recently, amber is not seen for 45 minutes or more, red is 500 m or more away or has a high anomaly.',
                'Known Places lists the sites the app has learned. A check-in inside one shows as Verified.',
              ],
            },
            { kind: 'note', text: 'A phone only sends its position while the app is open on screen. A locked phone or a closed app sends nothing, so "last seen" can be old without anything being wrong.' },
          ],
        },
        shared('checks'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'people',
      title: 'Employees',
      topics: [
        shared('hr-overview'),
        shared('employees'),
        {
          id: 'link-employee',
          title: 'Link an employee to their login',
          path: '/dashboard/hr/employees',
          blocks: [
            { kind: 'p', text: 'An employee can only check in, request leave or upload documents once their record is linked to a login. A new technician with "no check-in card" usually means this link is missing.' },
            {
              kind: 'steps',
              items: [
                'Ask an administrator to create the person\'s login in User Management (HR cannot create logins).',
                'Open Technet HR → Employees and open the person, or click Add Employee. The employee code is assigned automatically.',
                'Click Edit and choose their login under Linked Login, then save.',
                'The next time they open the app, the check-in card appears.',
              ],
            },
          ],
        },
        shared('certifications'),
        shared('availability'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'leave',
      title: 'Leave',
      topics: [
        {
          id: 'leave-requests',
          title: 'Approve leave',
          path: '/dashboard/hr/leave',
          blocks: [
            { kind: 'p', text: 'Staff ask for leave from My Leave on their phone. You are notified, and the request waits in Technet HR → Leave → Requests.' },
            {
              kind: 'steps',
              items: [
                'Open Technet HR → Leave. Requests shows every request; filter by status to see those awaiting approval.',
                'Approve or reject each one. If the person does not have enough balance you are warned and can Approve anyway.',
                'The person is notified. Approved days come off their balance.',
              ],
            },
            {
              kind: 'list',
              items: [
                'Record Leave enters leave for someone yourself, for example a phone call or a paper form.',
                'Edit changes a request. Cancelling approved leave returns the days to the balance.',
                'Staff can edit or withdraw their own request only while it is still pending.',
              ],
            },
          ],
        },
        shared('leave-setup'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'overtime-pay',
      title: 'Overtime, validation and payroll',
      topics: [shared('overtime'), shared('overtime-records'), shared('validations'), shared('payroll')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'operations',
      title: 'Work orders, reports and the store (view only)',
      topics: [
        {
          id: 'operations-view',
          title: 'Work orders and reports',
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'list',
              items: [
                'Work Orders lists the jobs scheduled for technicians, with who is assigned and the status.',
                'Daily Reports and Intervention Reports show what technicians filed for each day and site visit. Use the date and customer filters to find one.',
              ],
            },
            { kind: 'note', text: 'Creating work orders and approving or rejecting reports is done by an administrator or the Operations Manager.' },
          ],
        },
        {
          id: 'store-view',
          title: 'Technet Store',
          path: '/dashboard/store/tools',
          blocks: [
            { kind: 'p', text: 'You can see the register of tools and equipment and the materials in stock. Issuing, returns and stock changes are done by the Storekeeper or an administrator.' },
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
