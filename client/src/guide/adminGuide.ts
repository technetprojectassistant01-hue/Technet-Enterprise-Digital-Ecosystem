import type { RoleGuide } from './types'

/**
 * The Administrator guide. Also used by the Operations Manager, who has exactly the admin's access
 * (CLAUDE.md §6). Written against the live app on 2026-10-19 - keep it true when features change.
 */
export const ADMIN_GUIDE: RoleGuide = {
  title: 'Administrator guide',
  intro:
    'How to run Technet Digital as an administrator: logins, staff attendance, operations, HR, the store and the ERP. It follows the menu on the left from top to bottom. The Operations Manager has exactly the same access as an administrator, so this guide is for them too.',
  roles: ['ADMIN', 'OPERATIONS_MANAGER'],
  updated: '2026-10-19',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Getting started',
      topics: [
        {
          id: 'your-role',
          title: 'What an administrator does',
          blocks: [
            { kind: 'p', text: 'An administrator sets up and runs the system for everyone else. You can open every module, approve what others submit and manage logins.' },
            {
              kind: 'list',
              items: [
                'You do not check in or out. There is no check-in card, My Leave or My Documents page for you. Your landing page shows everyone else\'s attendance instead.',
                'Your account does not need an employee record. Link one only if you also work as staff and should appear in payroll.',
                'The Operations Manager has the same access as you, with one exception: only an Administrator can reset their own password by email.',
              ],
            },
          ],
        },
        {
          id: 'finding-your-way',
          title: 'Finding your way around',
          blocks: [
            {
              kind: 'list',
              items: [
                'On a computer the menu is on the left. Click a module (for example Technet HR) to open its pages.',
                'On a tablet or phone, tap the menu button at the top left to open the menu. On a phone a strip of shortcuts sits under the header; tap All for the full menu.',
                'The search box in the header finds pages by name. Type part of a name (for example "overtime") and press Enter.',
                'Inside a module, the tabs across the top switch between its pages.',
                'Help Center and User Guide are at the bottom of the menu. The Help Center has the support line, 5885 1000.',
              ],
            },
          ],
        },
        {
          id: 'notifications',
          title: 'Notifications',
          blocks: [
            { kind: 'p', text: 'The bell in the header shows what needs your attention: a technician checked in, a leave request or report was submitted, a high-severity attendance anomaly was raised, and so on. Click one to go to the record. Mark all read clears the count.' },
            { kind: 'note', text: 'These notifications appear inside the app only. Nobody gets an email or SMS for them.' },
          ],
        },
        {
          id: 'install-language',
          title: 'Installing the app and choosing a language',
          path: '/dashboard/settings',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open Settings at the bottom of the menu.',
                'Under Language choose English, French or Kreol Morisien. Your choice is saved on your account.',
                'Under Install app, click Install Technet Digital to add it to your computer or phone. On an iPhone or iPad, follow the steps shown (Share, then Add to Home Screen).',
              ],
            },
            { kind: 'tip', text: 'You stay signed in for 30 days, and the 30 days restart each time you use the app. Log out at the bottom of the menu signs you out immediately.' },
          ],
        },
        {
          id: 'slow-first-load',
          title: 'If a page is slow to load',
          blocks: [
            { kind: 'p', text: 'The server goes to sleep when nobody has used the app for about 15 minutes. The first page you open after that can take 30 to 60 seconds. Wait for it rather than reloading again and again. Pages are fast once it is awake.' },
            { kind: 'p', text: 'When a new version of the app is published, a bar appears saying "A new version of Technet Digital is available". Click Reload.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'logins',
      title: 'Logins and security',
      intro: 'Every login is created by an administrator. Nobody can sign up or change their own password.',
      topics: [
        {
          id: 'add-user',
          title: 'Create a login for a new person',
          path: '/dashboard/users',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open User Management (in the menu under System).',
                'Click Add user.',
                'Enter the person\'s name, the email they will sign in with, a password and their role, then click Create user.',
                'Give the person their email and password yourself.',
                'If they will check in, take leave or be paid, link the login to their employee record (next topic).',
              ],
            },
            {
              kind: 'list',
              items: [
                'Staff Technician: field staff. They check in and out, see their jobs and file reports.',
                'Staff Office: office staff with the same personal pages (attendance, leave, documents).',
                'HR: Technet HR, the attendance register, leave and overtime approvals.',
                'Storekeeper: Technet Store, plus Inventory and Procurement in the ERP.',
                'Sales Officer and Finance Officer: the customer side of the ERP. They do not check in, but they keep My Leave and My Documents.',
                'Operations Manager: the same access as an administrator.',
                'Administrator: everything.',
              ],
            },
          ],
        },
        {
          id: 'link-employee',
          title: 'Link a login to an employee record',
          path: '/dashboard/hr/employees',
          blocks: [
            { kind: 'p', text: 'A login on its own cannot check in. The check-in card, leave, payroll and documents all work through the employee record. User Management shows a banner counting logins with no employee record, and an Employee Record column for each login.' },
            {
              kind: 'steps',
              items: [
                'Open Technet HR → Employees.',
                'Open the person (or click Add Employee if they are not there yet; their employee code is assigned automatically).',
                'Click Edit and choose their login under Linked Login.',
                'Save. The next time they open the app, the check-in card appears.',
              ],
            },
          ],
        },
        {
          id: 'edit-user',
          title: 'Change a name, email or role, or reset a password',
          path: '/dashboard/users',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open User Management and find the person (use the search box or the role filter).',
                'Click Edit User to change their name, sign-in email or role, then Save changes.',
                'Click Reset Password to give them a new password, then Save password. Tell them the new password.',
              ],
            },
            { kind: 'tip', text: 'Change someone\'s email here instead of deleting their login and making a new one. Deleting a login unlinks it from their employee record and removes their notifications.' },
            { kind: 'note', text: 'If you forget your own password, the "Forgot Password?" link on the sign-in page can email an administrator a reset link. If email sending is not set up on the server, the page says so and the email will not arrive. Keep a second administrator login so administrators can reset each other.' },
          ],
        },
        {
          id: 'security-log',
          title: 'Security and the audit log',
          path: '/dashboard/security',
          blocks: [
            {
              kind: 'list',
              items: [
                'Security → My Account lists your own recent sign-ins.',
                'Security → Audit Log lists security events for the whole company: successful and failed sign-ins, password resets, and logins created, changed or deleted. Filter it by event type and date.',
              ],
            },
            { kind: 'note', text: 'The audit log covers logins and passwords only. It is not a history of every change made in the app.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'attendance',
      title: 'Staff attendance',
      intro: 'Technicians check in and out on their phones. Each check-in records the time and location they typed, the app\'s own time, a GPS position and usually a photo. Your landing page and the Operations screens show all of it.',
      topics: [
        {
          id: 'staff-attendance',
          title: 'The Staff Attendance register (your landing page)',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: 'Attendance, the first item in the menu, opens the Staff Attendance register for the month: one row per visit.' },
            {
              kind: 'list',
              items: [
                'AS ENTERED BY STAFF is what the person typed: their time and location in and out.',
                'RECORDED BY THE APP is what the app saw: its own clock time and the GPS position, with a Map link and the place name.',
                'Flags show when the two disagree, for example a typed time far from the app\'s time.',
                'The badge beside each visit reads Verified, Unverified or Flagged. Click Flagged to see why (see Attendance Anomalies).',
                'The Overtime column lets you approve or reject that day\'s overtime directly.',
                'Use the arrows to change month, and Full register to open Team Attendance.',
              ],
            },
            { kind: 'tip', text: 'The app\'s time is the official one. The typed time is kept so you can compare, for example a technician who arrived at 08:00 but opened the app at 08:20.' },
          ],
        },
        {
          id: 'absences',
          title: 'Absences and excusing a day',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: 'Under the register, Absences lists Staff Technicians with no check-in on a working day (Monday to Saturday). Sundays, public holidays and approved leave are not counted. Someone stays absent for today until they check in.' },
            {
              kind: 'steps',
              items: [
                'Find the day in the Absences list.',
                'Click Excuse, enter the reason (for example "Sick, medical certificate received") and save.',
                'Click Undo excuse to put it back.',
              ],
            },
            { kind: 'note', text: 'Absences do not change anyone\'s pay. Payroll does not read them.' },
          ],
        },
        {
          id: 'export-attendance',
          title: 'Download the attendance report (PDF or Excel)',
          path: '/dashboard',
          blocks: [
            {
              kind: 'steps',
              items: [
                'On the Staff Attendance register click Export.',
                'Pick the dates, or a quick choice: Yesterday (the daily report), This month or All records.',
                'Click Download PDF or Download Excel.',
              ],
            },
            {
              kind: 'list',
              items: [
                'Monthly Report: one row per person in the AiFace machine\'s layout (Should, Actual, Absence, Late, Leave Early, Holiday, Leave, Overtime, Overtime approved).',
                'Daily Report: each person\'s days with In1/Out1 to In3/Out3, late and early minutes and the day\'s status.',
                'Overtime Records: any overtime HR typed in by hand (only when there are some).',
                'Check before using these figures for pay: visits left open more than 12 hours, which usually means a late check-out.',
                'Register: every visit, typed against recorded, with GPS places.',
              ],
            },
            { kind: 'tip', text: 'The Excel file has a separate sheet for each part, carries the company letterhead and prints with page numbers.' },
          ],
        },
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
                'Currently Checked In lists who is in now. A visit open for many hours is labelled "likely forgotten".',
                'Attendance Summary is the AiFace Monthly Report. Click a name to open that person\'s Daily Report.',
                'Attendance Register lists every visit day by day, with the check-in photo and the compliance checks.',
                'Export Month / Export Week downloads the Excel report and Download PDF the PDF, for the period on screen.',
              ],
            },
          ],
        },
        {
          id: 'close-session',
          title: 'Close a forgotten check-in',
          path: '/dashboard/operations/team-attendance',
          blocks: [
            { kind: 'p', text: 'A shift still open after midnight is checked out automatically at closing time on its own day (17:00, or 13:00 on Saturday), and the technician is told. You can close one yourself sooner, or correct the time.' },
            {
              kind: 'steps',
              items: [
                'On Team Attendance, find the visit under Currently Checked In.',
                'Click Close session.',
                'Set CHECKED OUT AT to when they actually left. Leaving it at "now" books the whole time as hours on site.',
                'Add a note if you like and confirm.',
              ],
            },
            { kind: 'note', text: 'No location is recorded for a session you close, and the record shows it was closed by management.' },
          ],
        },
        {
          id: 'field-ops',
          title: 'Field Operations and the Live Map',
          path: '/dashboard/operations/live-map',
          blocks: [
            {
              kind: 'list',
              items: [
                'Field Operations lists who is checked in right now, where they said they are and for how long. Request check sends them a notification asking them to open the app. It does not fetch their location instantly.',
                'Live Map shows everyone on shift: where they checked in, where they were last seen and a line between the two. Green: near the check-in and seen recently. Amber: not seen for 45 minutes or more, or a medium anomaly. Red: 500 m or more from the check-in, or a high anomaly. It refreshes every 15 seconds.',
                'Under the map, NOT CHECKED IN TODAY lists technicians who are absent so far.',
              ],
            },
            { kind: 'note', text: 'A phone only sends its position while the app is open on screen. A locked phone or a closed app sends nothing, so "last seen" can be old without anything being wrong.' },
          ],
        },
        {
          id: 'checks',
          title: 'Compliance checks and location pings',
          blocks: [
            {
              kind: 'list',
              items: [
                'During each shift the app sends 2 to 4 random notifications asking the technician to confirm they are on site. They have 5 minutes to answer, and get a second reminder after about 2½ minutes.',
                'Two failed checks in a row (missed, or answered far from the check-in) raise an anomaly for you to review.',
                'While a technician has the app open, it also records their position every 15 minutes.',
                'A phone with notifications turned off is shown as "No device registered". That is not counted as a failure.',
              ],
            },
            { kind: 'note', text: 'These checks are sent by an outside scheduler (cron-job.org). If checks, reminders or place names stop appearing for everyone, the scheduler has probably stopped: look at its execution history first. It stopped between 29 September and 12 October 2026.' },
          ],
        },
        {
          id: 'anomalies',
          title: 'Review attendance anomalies',
          path: '/dashboard/operations/anomalies',
          blocks: [
            { kind: 'p', text: 'Technet Operations → Attendance Anomalies lists what the app could not verify: far from the job, checked in near home, impossible travel, possible fake GPS, a typed time or place that does not match, low GPS accuracy, missed pings or failed compliance checks. Each card shows a small map and the details.' },
            {
              kind: 'steps',
              items: [
                'Filter by status, type, severity, employee or dates. Open is the queue to work through.',
                'Read the card and check the map.',
                'Choose Confirm Genuine (it was fine), Mark False Positive (the rule was wrong), Confirm Violation (it was a real problem) or Dismiss. Add a note if useful.',
                'Undo puts a decision back in the queue.',
              ],
            },
            {
              kind: 'list',
              items: [
                'Severity is High, Medium or Low. A new High anomaly also sends you a notification.',
                'Overtime on a day with open anomalies shows a warning before approval.',
                'HR cannot validate a person\'s month while they have open High anomalies.',
              ],
            },
            { kind: 'note', text: 'An anomaly is a reason to look, not proof of wrongdoing. GPS drifts indoors, and a typed place name like "Moka" resolves to the middle of the area, several kilometres from a real site.' },
          ],
        },
        {
          id: 'known-places',
          title: 'Known places',
          path: '/dashboard/operations/known-places',
          blocks: [
            { kind: 'p', text: 'Known places are sites your technicians really work at. A check-in inside a known place shows as Verified. There is no list to type in: the app learns places from check-ins you confirm.' },
            {
              kind: 'steps',
              items: [
                'On Attendance Anomalies, click Confirm Genuine on a check-in.',
                'Choose Save as a new known place, give it a name (and a client if you like) and a radius (250 m suits most sites), or pick the existing place it matches.',
                'Confirm. Other recent check-ins at the same spot become Verified too.',
              ],
            },
            { kind: 'p', text: 'On Technet Operations → Known Places you can rename a place, change its radius, merge duplicates (Merge into…) or delete one.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'operations',
      title: 'Work orders and reports',
      topics: [
        {
          id: 'work-orders',
          title: 'Create and assign a work order',
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open Technet Operations → Work Orders. A customer must exist first (Technet ERP → Customers).',
                'Click Create New Work Order.',
                'Choose the customer and job category, enter a title, an optional description and the scheduled date, and pick the technicians.',
                'Click Create Work Order. The number is given automatically.',
              ],
            },
            {
              kind: 'list',
              items: [
                'Each assigned technician gets a notification, and the job appears under My Jobs Today on their phone on the scheduled day. Jobs still open from earlier days stay listed until they are finished.',
                'When a technician has exactly one job that day, the check-in form fills in its site and links the check-in to it.',
                'To fix a mistake, use the edit action on the work order list: customer, category, title, description, date and technicians can all be changed.',
              ],
            },
          ],
        },
        {
          id: 'work-order-detail',
          title: 'Work order status and site location',
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'list',
              items: [
                'Open a work order to move it along: Start Work, Waiting for Parts, Resume Work, Mark Completed, and Reopen if needed. The status is shared by everyone assigned.',
                'Set site location: type an area, street or town (for example "Ebene, Mauritius"), not a company name, then save. The site then shows as a map link and is used to check check-ins against the job.',
                'The page also lists the site attendance and intervention reports for the job.',
              ],
            },
            { kind: 'note', text: 'The address lookup uses free OpenStreetMap data. Business names and floor numbers usually cannot be found. Use the town or street.' },
          ],
        },
        {
          id: 'daily-reports',
          title: 'Daily reports',
          path: '/dashboard/operations/daily-reports',
          blocks: [
            { kind: 'p', text: 'Technicians file a daily report with a summary, optional hours, the work orders they touched and up to 3 photos. New reports show as PENDING REVIEW.' },
            {
              kind: 'steps',
              items: [
                'Open Technet Operations → Daily Reports. Filter by date or search the text.',
                'Read the report and its photos.',
                'Approve it, or reject it. The technician is notified either way.',
              ],
            },
          ],
        },
        {
          id: 'intervention-reports',
          title: 'Intervention reports',
          path: '/dashboard/operations/intervention-reports',
          blocks: [
            { kind: 'p', text: 'An intervention report is the job sheet for a site visit: customer and contact, equipment, fault and work done, before and after photos, materials used, the technician\'s report and the customer\'s signature.' },
            {
              kind: 'list',
              items: [
                'Filter by customer, status, work type and dates, or use the 3, 6 and 12 month buttons to find a customer\'s history quickly while on the phone.',
                'To reject a report you must write a comment. The technician sees it and can use Correct and Resubmit.',
                'On a report you can link a work order, and set a follow-up reminder. The report then shows under Reminders due once the date passes. No email or SMS is sent.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'hr',
      title: 'Technet HR',
      intro: 'Everything about people: employee records, leave, overtime, month-end validation, payroll, certifications and availability.',
      topics: [
        {
          id: 'hr-overview',
          title: 'HR Overview',
          path: '/dashboard/hr',
          blocks: [
            { kind: 'p', text: 'The HR Overview shows what needs action: active headcount, who is on leave today, leave awaiting approval, overtime awaiting approval this month, attendance awaiting validation for last month and certifications expiring in the next 60 days.' },
          ],
        },
        {
          id: 'employees',
          title: 'Employee records',
          path: '/dashboard/hr/employees',
          blocks: [
            {
              kind: 'list',
              items: [
                'Add Employee creates a record. The employee code is assigned automatically.',
                'Open an employee to edit their details, link their login, set a basic salary for payroll and see their certifications.',
                'Home location (HR only): their home address. A check-in within 300 m of it raises a "Checked in near home" anomaly, unless they have a job near home that day. The address is never shown to anyone outside HR.',
                'Personal Documents: the documents the employee uploaded themselves (ID, licence, certificates). You can view and download them.',
              ],
            },
          ],
        },
        {
          id: 'leave-approvals',
          title: 'Approve leave',
          path: '/dashboard/leave-approvals',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open Leave Approvals in the menu. Awaiting Approval lists requests waiting for a decision.',
                'Approve or reject each one. If the person does not have enough balance you are warned and can Approve anyway.',
                'The Approved tab lists approved leave. You can edit it, or cancel it to return the days to the balance.',
              ],
            },
            { kind: 'tip', text: 'Technet HR → Leave shows every request in every status, and lets you Record Leave on someone\'s behalf.' },
          ],
        },
        {
          id: 'leave-setup',
          title: 'Leave types, balances and public holidays',
          path: '/dashboard/hr/leave',
          blocks: [
            {
              kind: 'list',
              items: [
                'Leave Types: click Use Mauritius defaults to start, or Add Leave Type. Each type has a code, days per year, whether it is paid and whether documents are required. Deactivate a type instead of deleting it once it has been used.',
                'Balances: click Generate balances for the year to create everyone\'s entitlement, then adjust a person\'s entitled or carried-over days if needed. Used days change only when leave is approved or cancelled.',
                'Public Holidays: add the year\'s holidays. They are excluded from leave and payroll working days, attendance absences and the reports. Lunar holidays marked "(unconfirmed)" are estimates: edit the date once it is announced.',
              ],
            },
          ],
        },
        {
          id: 'overtime',
          title: 'Approve overtime',
          path: '/dashboard/hr/overtime',
          blocks: [
            { kind: 'p', text: 'Overtime is calculated from check-ins: from 17:30 on weekdays and 13:30 on Saturday, up to the check-out time the technician typed on their last visit that day. Everything worked on a Sunday counts. Each day stays pending until it is approved or rejected, and only approved overtime counts.' },
            {
              kind: 'steps',
              items: [
                'Open Technet HR → Overtime. Pending days are shown first. Use the arrows to change month.',
                'Check any warning: anomalies that day, or a visit left open more than 12 hours (a late check-out makes the overtime look bigger than it was).',
                'Click Approve, or Reject with an optional reason. The technician is notified.',
                'Undo puts a decided day back to pending.',
              ],
            },
            { kind: 'tip', text: 'Attendance data issues, at the bottom of the page, lists records that look wrong across all time (a check-out before a check-in, overlapping sessions, more than 12 hours of overtime in a day). Nothing there is changed automatically.' },
          ],
        },
        {
          id: 'overtime-records',
          title: 'Record overtime by hand',
          path: '/dashboard/hr/overtime',
          blocks: [
            { kind: 'p', text: 'Like the Overtime Records in the AiFace software, you can type overtime in yourself, for example a night call-out or a day where the app\'s figure is wrong. A record replaces the overtime the app calculated for that person and day, counts as approved, and shows you as the approver.' },
            {
              kind: 'steps',
              items: [
                'On Technet HR → Overtime click Add overtime record. Or, on a pending day, click Record instead to replace that day\'s calculated figure.',
                'Choose the employee and date, the type (Normal, Rest day or Public holiday), the start and end time and a reason. An end time earlier than the start counts as the next day.',
                'Click Save record. The employee is notified.',
              ],
            },
            {
              kind: 'list',
              items: [
                'Records show a Manual record badge. Choose Manual records in the status filter to list only them.',
                'Edit changes a record. Delete record removes it, and the day goes back to its calculated overtime, pending.',
                'Records appear in their own Overtime Records section of the PDF and Excel reports.',
              ],
            },
          ],
        },
        {
          id: 'validations',
          title: 'Validate a month\'s attendance',
          path: '/dashboard/hr/validations',
          blocks: [
            { kind: 'p', text: 'At the end of each month HR confirms each employee\'s attendance. Until then, the attendance PDF a technician downloads is marked DRAFT.' },
            {
              kind: 'steps',
              items: [
                'Open Technet HR → Validations. It opens on last month. A month can be validated from its last day.',
                'Open a person\'s PDF to check it, then click Validate, or Validate all for everyone.',
                'Undo removes a validation.',
              ],
            },
            {
              kind: 'list',
              items: [
                'A person with open High anomalies cannot be validated until they are reviewed. Validate all skips them and says how many.',
                'If a visit or approved overtime changes after validation, the row shows "Changed since validation" and the PDF is DRAFT again. Validate it again.',
              ],
            },
          ],
        },
        {
          id: 'payroll',
          title: 'Payroll',
          path: '/dashboard/hr/payroll',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Make sure each employee who should be paid has a basic salary on their record.',
                'Open Technet HR → Payroll, choose the month and year and click Process Payroll.',
                'Open the run to see each person\'s basic salary, hours, overtime, unpaid leave, deduction and net pay.',
              ],
            },
            {
              kind: 'note',
              text: 'Net pay is the basic salary minus a deduction for approved unpaid leave. Hours (from check-ins) and approved overtime are shown but not paid, because no overtime rate has been set. Employees with no basic salary are left out. Hours from forgotten check-outs make the hours look bigger.',
            },
          ],
        },
        {
          id: 'certifications',
          title: 'Certifications and training',
          path: '/dashboard/hr/certifications',
          blocks: [
            { kind: 'p', text: 'Technet HR → Certifications lists each person\'s certifications with their expiry dates, and their training. Use Add Certification or Record Training. Certifications expiring in the next 60 days appear on the HR Overview.' },
          ],
        },
        {
          id: 'availability',
          title: 'Availability',
          path: '/dashboard/hr/availability',
          blocks: [
            { kind: 'p', text: 'Technet HR → Availability groups people for a day into Available, On Leave and Absent.' },
            { kind: 'note', text: 'Availability reads approved leave and the old manual office register, not the check-ins. Anyone not in that register shows as Available. For who is actually in the field, use Field Operations or the Live Map.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Technet Store',
      intro: 'Tools and equipment are tracked one by one. Materials such as glue, tape or screws are tracked by quantity. Administrators and Storekeepers manage the store. Anyone with an employee record can make requests.',
      topics: [
        {
          id: 'tools',
          title: 'Tools & Equipment',
          path: '/dashboard/store/tools',
          blocks: [
            {
              kind: 'list',
              items: [
                'Add Tool registers a tool. A tag number (TL-0001, TL-0002…) is given automatically: write it on the tool.',
                'The register shows each tool\'s status (Available, Checked out, Under repair, Retired), who holds it and when it is due back. Overdue tools are marked.',
                'Mark Returned records a return and its condition. A tool returned Damaged goes to Under repair until you set it back to Available.',
                'History shows every time a tool was issued. A tool that has ever been issued cannot be deleted: retire it instead.',
              ],
            },
          ],
        },
        {
          id: 'tool-requests',
          title: 'Tool requests',
          path: '/dashboard/store/requests',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open Technet Store → Tool Requests. Pending requests are waiting for the store.',
                'Click Issue, tick the available tools you are handing over, set an optional return date and confirm. Or click Reject with an optional reason.',
                'The person who asked is notified, and the tools appear under Tools I Have on their screen.',
              ],
            },
          ],
        },
        {
          id: 'materials',
          title: 'Materials and material requests',
          path: '/dashboard/store/stock',
          blocks: [
            {
              kind: 'list',
              items: [
                'Materials: Add Material with a name, unit (tube, roll, box…), opening stock and a minimum stock. At or below the minimum it shows as Low.',
                'Stock only changes through Add stock (a delivery), Correct count (after a stock-take) and issuing a request. History lists every change and who made it.',
                'Material Requests: click Issue, match each line to a material in stock and set the quantity. It comes off the stock in one go. Use "No stock match" for anything bought specially. Issuing is refused if something is short.',
              ],
            },
            { kind: 'note', text: 'Store materials are separate from ERP Inventory. They are not linked.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'erp',
      title: 'Technet ERP',
      intro: 'Customers and quotations, procurement, inventory, projects and documents. Invoices and expenses are kept in QuickBooks, not in this app.',
      topics: [
        {
          id: 'customers',
          title: 'Customers and portal access',
          path: '/dashboard/erp/customers',
          blocks: [
            {
              kind: 'list',
              items: [
                'Technet ERP → Customers → Add Customer creates a customer (name, company, contact details, BRN, VAT number, address).',
                'Portal access gives a customer their own login to Technet Connect, where they can see their quotations and job status and ask for a quote. Click Grant portal access, enter their email and give them the password shown. You can reset or revoke it later.',
              ],
            },
          ],
        },
        {
          id: 'quote-requests',
          title: 'The Call Log (quote requests)',
          path: '/dashboard/erp/customers/quotations',
          blocks: [
            { kind: 'p', text: 'The Call Log tab on Quotations holds requests for a quote: those a customer sent from the portal, and those staff logged after a call or email.' },
            {
              kind: 'steps',
              items: [
                'Click Log a Request and fill in the customer (or a company name if they are new) and what they are asking for.',
                'Add a status note so others can see why it is still waiting (for example "awaiting supplier pricing").',
                'Send an acknowledgement: edit the email, then Save Draft or Send. Send opens your email program with the text filled in.',
                'Convert to Quotation turns the request into a draft quotation, or Decline closes it.',
              ],
            },
            { kind: 'note', text: 'A request not acknowledged, converted or declined within 24 hours is marked OVERDUE.' },
          ],
        },
        {
          id: 'quotations',
          title: 'Quotations',
          path: '/dashboard/erp/customers/quotations',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Click New Quotation. Choose the customer, enter the title and contact person, and add the line items (use the Labor and Transport buttons for common lines).',
                'Set the payment terms (the lines must add up to 100%), the validity in days (15 by default) and availability.',
                'Save. The quotation number is assigned automatically and it starts as a draft.',
                'Open it to check, then Download PDF, or Email Customer.',
                'Use Mark as Sent once it has gone out, then Mark Approved, Mark Not Approved or Mark Expired.',
              ],
            },
            {
              kind: 'list',
              items: [
                'Customer, terms and line items can only be edited while the quotation is a draft.',
                'Follow-Up on the quotation logs each call: date, who you spoke to and the outcome. Record the customer\'s PO or confirmation reference there too.',
                'Attachments holds files linked to the quotation.',
                'Only an administrator can add a new payment-terms label. Others pick from labels already used.',
              ],
            },
            { kind: 'note', text: 'Email Customer downloads the PDF and opens an email with the text ready. A browser cannot attach the file for you, so attach the downloaded PDF yourself before sending.' },
          ],
        },
        {
          id: 'follow-up-contracts',
          title: 'Follow-Up and Contracts',
          path: '/dashboard/erp/customers/follow-up',
          blocks: [
            {
              kind: 'list',
              items: [
                'Follow-Up lists the calls logged on quotations, by customer or by date.',
                'Contracts: New Contract records a service contract with a customer, its value and its start and end dates.',
              ],
            },
          ],
        },
        {
          id: 'procurement',
          title: 'Procurement: requisitions and purchase orders',
          path: '/dashboard/erp/procurement/requisitions',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Suppliers: Add Supplier with contact details and payment terms (for example "Net 30").',
                'Requisitions: New Requisition lists what is needed. Open it to Approve or Reject it.',
                'An approved requisition can be converted: Convert to Purchase Order, choosing the supplier and unit costs.',
                'Purchase Orders: open the order and Send to Supplier once it has been sent.',
                'When goods arrive, click Record Receipt and enter the quantities received. Items linked to inventory are added to stock automatically. The order shows partly or fully received.',
                'Once everything has arrived, click Close Order.',
              ],
            },
            { kind: 'tip', text: 'Cancel Order stops an order that is still a draft or has been sent but nothing has arrived yet.' },
          ],
        },
        {
          id: 'inventory-projects-docs',
          title: 'Inventory, projects and documents',
          blocks: [
            {
              kind: 'list',
              items: [
                'Inventory: Add Item, then use Adjust stock for movements. The Stock Ledger lists them. Low stock is flagged at the minimum level.',
                'Projects: New Project with the customer, manager, dates and budget.',
                'Documents: Upload Document stores a file under a category (contract, HR, project, quotation…) and can link it to a customer or project.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'other-modules',
      title: 'Connect, Marketing and Insight',
      topics: [
        {
          id: 'connect',
          title: 'Technet Connect (the customer portal)',
          path: '/dashboard/connect',
          blocks: [
            { kind: 'p', text: 'Customers you give portal access to sign in at the Client Portal and see their own quotations and job status, and can ask for a quote. Drafts, GPS data and technician names are never shown to them. Their quote requests arrive in the Call Log.' },
          ],
        },
        {
          id: 'marketing',
          title: 'Technet Digital Marketing',
          path: '/dashboard/marketing',
          blocks: [
            {
              kind: 'list',
              items: [
                'Campaigns: Add Campaign, then open it and Add Post for each post (title, platform, text, date).',
                'Content Calendar lists every planned post across campaigns, with filters.',
                'After publishing a post on the social network yourself, click Mark Posted here.',
              ],
            },
            { kind: 'note', text: 'The app does not publish to social networks or write posts for you. It is a planning list.' },
          ],
        },
        {
          id: 'insight',
          title: 'Technet Insight',
          path: '/dashboard/insight',
          blocks: [
            { kind: 'p', text: 'Technet Insight, for administrators only, shows the company at a glance: active projects, active work orders, low stock items, pending tool requests and technicians on site.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'automatic',
      title: 'What the app does on its own',
      topics: [
        {
          id: 'automatic-list',
          title: 'Automatic reminders and clean-up',
          blocks: [
            {
              kind: 'list',
              items: [
                '08:15 and 17:15, Monday to Saturday: a reminder to technicians who have not checked in, or are still checked in. Each person can turn these off. Compliance checks cannot be turned off.',
                'After 14 hours checked in: a "still checked in?" reminder.',
                'After midnight: a shift still open is checked out automatically at its day\'s closing time.',
                'Check-in photos are deleted automatically after 90 days.',
                'When a technician checks out with overtime, HR is notified that it needs approval.',
              ],
            },
            { kind: 'note', text: 'Reminders, compliance checks and place names depend on the cron-job.org scheduler. If they all go quiet, check its execution history.' },
          ],
        },
      ],
    },
  ],
}
