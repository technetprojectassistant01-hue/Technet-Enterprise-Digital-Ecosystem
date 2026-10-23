import type { RoleGuide } from './types'

/**
 * The Staff Technician guide (role FIELD_TECHNICIAN). Written for people who are not very
 * technical: short sentences, the exact button names, and one task per topic. Written against the
 * live app on 2026-10-19 - keep it true when features change.
 */
export const TECHNICIAN_GUIDE: RoleGuide = {
  title: 'Technician guide',
  intro:
    'How to use Technet Digital on your phone: checking in and out, your jobs for the day, reports, leave, tools and documents. Each topic is one task, step by step.',
  roles: ['FIELD_TECHNICIAN'],
  updated: '2026-10-23',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Getting started',
      topics: [
        {
          id: 'sign-in',
          title: 'Signing in',
          blocks: [
            {
              kind: 'list',
              items: [
                'Your email and password are given to you by the administrator. You cannot change your password yourself.',
                'If you forget your password, ask the administrator to set a new one.',
                'You stay signed in for 30 days, and the 30 days restart every time you use the app, so you rarely need to sign in again.',
              ],
            },
          ],
        },
        {
          id: 'install',
          title: 'Put the app on your phone',
          path: '/dashboard/settings',
          blocks: [
            { kind: 'p', text: 'Install the app so it opens from an icon like any other app. On an iPhone this is required: compliance checks and reminders only reach an installed app.' },
            {
              kind: 'list',
              items: [
                'Android: when the "Install Technet Digital" pop-up appears, tap Install now.',
                'iPhone: open the site in Safari, tap Share, then Add to Home Screen, then Add. On newer iPhones, Share is inside the ⋯ button.',
                'Missed the pop-up? Open Settings and tap Install Technet Digital.',
              ],
            },
          ],
        },
        {
          id: 'permissions',
          title: 'Allow location and notifications',
          blocks: [
            { kind: 'p', text: 'The app needs two permissions. Say Allow to both.' },
            {
              kind: 'list',
              items: [
                'Location: needed to check in and out. Without it, Check In does not work.',
                'Notifications: needed for compliance checks during your shift. The app asks after your first check-in. Tap Allow, then Allow again when your phone asks.',
              ],
            },
            { kind: 'tip', text: 'If you tapped "Don\'t allow" by mistake, the app shows the steps to turn it back on in your phone settings. Follow them, then tap Try again.' },
          ],
        },
        {
          id: 'language',
          title: 'Change the language',
          path: '/dashboard/settings',
          blocks: [
            { kind: 'p', text: 'Open Settings and choose English, Français or Kreol under Language. Your choice is saved on your account. This guide comes in English, French and Kreol. Download PDF at the top of this guide saves it as a file to keep or print, in the language you chose.' },
          ],
        },
        {
          id: 'no-card',
          title: 'I don\'t see the check-in card',
          blocks: [
            { kind: 'p', text: 'Your login is not linked to your employee record yet. Ask HR to link it. Once they do, the card appears the next time you open the app.' },
          ],
        },
        {
          id: 'form-drafts',
          title: 'If a form closes before you send it',
          blocks: [
            { kind: 'p', text: 'When you fill in something new (a daily report, a tool or material request, a leave request, a document), the phone keeps what you type. If the app or the form closes by mistake, open the same form again. A message says "We brought back what you typed last time" and your text is back.' },
            {
              kind: 'list',
              items: [
                'The draft goes away once you submit.',
                'To start again with an empty form, tap Discard draft.',
                'Photos and files are not kept. Add them again.',
                'The draft is only on this phone, for your login.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'attendance',
      title: 'Checking in and out',
      intro: 'Check in when you arrive at a site and check out when you leave. Your phone records the time, your location and a photo.',
      topics: [
        {
          id: 'check-in',
          title: 'Check in',
          path: '/dashboard',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open the app. The My Attendance card is at the top of the Attendance page.',
                'Check TIME IN. It is filled in with the time now. Change it only if you arrived earlier.',
                'Enter TRANSPORT (MUR), your travel cost to get there. Enter 0 if there was none, and say why in the box that appears.',
                'SITE and LOCATION are optional: the client or building (for example "Celero Level 5") and the town or area (for example "Ebène"). If you have one job today, they are filled in for you.',
                'Tap Take photo and take a photo with the front camera.',
                'Tap Check In.',
              ],
            },
            {
              kind: 'list',
              items: [
                'The card then shows CHECKED IN and how long you have been on site.',
                'You can check in and out several times a day if you visit more than one site.',
                'If you are already checked in, the app tells you and offers Go to check-out. Check out of that visit first.',
              ],
            },
            { kind: 'note', text: 'The app\'s own clock is the official time. If you type a time far from it, your manager sees both, so always type the real time.' },
          ],
        },
        {
          id: 'check-out',
          title: 'Check out',
          path: '/dashboard',
          blocks: [
            {
              kind: 'steps',
              items: [
                'On the My Attendance card, check TIME OUT. It is filled in with the time now.',
                'Enter TRANSPORT (MUR) for the return trip (0 if none, with the reason).',
                'Add the site and location if you like.',
                'Tap Check Out.',
              ],
            },
            {
              kind: 'note',
              text: 'Forgot to check out? After midnight the app checks you out automatically at closing time (17:00, or 13:00 on Saturday) and sends you a notification. Any overtime that day is lost unless HR corrects it, so check out yourself when you leave.',
            },
          ],
        },
        {
          id: 'compliance-check',
          title: 'Compliance checks',
          blocks: [
            { kind: 'p', text: 'During your shift a notification asks you to confirm you are on site. It comes 2 to 4 times a shift, at random times.' },
            {
              kind: 'steps',
              items: [
                'Tap the notification. The Compliance check page opens.',
                'Tap Confirm you\'re on site. The app records your location.',
                'You see "Thanks — recorded."',
              ],
            },
            {
              kind: 'list',
              items: [
                'You have 5 minutes. If you don\'t answer, a second reminder comes after about 2½ minutes.',
                'A late answer shows "This check has expired". That counts as missed.',
                'Two missed checks in a row are reported to your manager.',
                'These checks cannot be turned off.',
              ],
            },
          ],
        },
        {
          id: 'location-while-in',
          title: 'Your location during a shift',
          blocks: [
            { kind: 'p', text: 'While you are checked in, the app also records your location every 15 minutes when it is open on your screen. It cannot record anything while the app is closed or your phone is locked, and nothing is recorded when you are not checked in.' },
            { kind: 'p', text: 'Your managers can see your check-in and check-out places, the photo and these locations.' },
          ],
        },
        {
          id: 'reminders',
          title: 'Check-in reminders',
          path: '/dashboard',
          blocks: [
            {
              kind: 'list',
              items: [
                'The Remind me button on the My Attendance card turns on reminders: 08:15 if you have not checked in, and 17:15 if you are still checked in, Monday to Saturday. When they are on, it reads Reminders on.',
                'Tap it to turn reminders off or back on. Compliance checks still come either way.',
                'Send test sends a test notification to check your phone receives them.',
                'If you are still checked in after 14 hours, you get a "still checked in?" reminder.',
              ],
            },
          ],
        },
        {
          id: 'no-signal',
          title: 'No signal',
          blocks: [
            { kind: 'p', text: 'You can check in, check out and send reports without signal. They are saved on your phone and upload on their own when the signal comes back. You don\'t need to enter them again.' },
            {
              kind: 'list',
              items: [
                'While something is waiting, the top of the screen shows "waiting to sync". Tap it, then Try now to send it straight away.',
                'On an iPhone, saved items upload the next time you open the app with signal.',
                'Your jobs and reports stay visible without signal if you opened them once while connected.',
              ],
            },
          ],
        },
        {
          id: 'my-attendance',
          title: 'See your attendance and download it',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: 'Below the card, Today shows today\'s visits, and My Attendance shows the month: days, hours, transport, late days, absences and approved overtime.' },
            {
              kind: 'list',
              items: [
                'Work hours are Monday to Friday 08:00–17:00 and Saturday 08:00–13:00. You are late if your first check-in, by the app\'s clock, is after 08:30.',
                'Overtime counts from 17:30 on weekdays and 13:30 on Saturday. It only appears here after HR approves it.',
                'A working day with no check-in shows as Absent, unless you were on approved leave or HR excused it.',
              ],
            },
            {
              kind: 'steps',
              items: [
                'To get a PDF, tap Export PDF, choose the dates and tap Download PDF.',
                'The PDF says DRAFT until HR validates the month. You get a notification when they do, and the next download has no DRAFT mark.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'jobs',
      title: 'Your jobs and reports',
      topics: [
        {
          id: 'my-jobs',
          title: 'My Jobs Today',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: 'My Jobs Today, under the check-in card, lists the jobs you are assigned to today. Still open from earlier lists older jobs that are not finished.' },
            {
              kind: 'list',
              items: [
                'Open in Maps shows the site address in your maps app.',
                'Call customer phones the customer.',
                'With you shows who else is on the job.',
                'Open job opens the full work order.',
              ],
            },
            { kind: 'tip', text: 'No job listed but you were told to go somewhere? Contact your supervisor.' },
          ],
        },
        {
          id: 'job-status',
          title: 'Update a job',
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open the job (Open job, or Technet Operations → Work Orders).',
                'Tap Start Work when you begin.',
                'Tap Waiting for Parts if you have to stop for parts, and Resume Work when you continue.',
                'Tap Mark Completed when the job is finished.',
              ],
            },
            { kind: 'note', text: 'The status is shared: when you mark a job completed, it is completed for everyone on it. Only a manager can reopen it.' },
          ],
        },
        {
          id: 'daily-report',
          title: 'File a daily report',
          path: '/dashboard/operations/daily-reports',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open Technet Operations → Daily Reports and tap File Daily Report.',
                'Write the SUMMARY of what you did today.',
                'Optionally add your hours, the technicians with you and the work orders you worked on.',
                'If you filed an intervention report today for those jobs, it is listed. Tap Insert to copy it into your summary.',
                'Add up to 3 photos with Add photo.',
                'Tap Submit Report. Your manager approves or rejects it, and you get a notification.',
              ],
            },
          ],
        },
        {
          id: 'intervention-report',
          title: 'File an intervention report',
          path: '/dashboard/operations/intervention-reports',
          blocks: [
            { kind: 'p', text: 'Fill this in right after a site visit. Start it from Technet Operations → Intervention Reports → Log New Intervention, or from a job with File Report.' },
            {
              kind: 'steps',
              items: [
                'Customer & Contact: choose the customer, the work order if there is one, and the contact person.',
                'Equipment / System (optional): equipment, make, model, serial numbers and photos.',
                'Fault & Work Done: what was reported, what you did, before and after photos, and the materials used. For several units, use the per-unit breakdown.',
                'Technicians & Time: who was there.',
                'Warranty & Report: warranty, your report and recommendations.',
                'Sign & Attach: the customer signs on the screen, and you can upload a photo of the signed paper sheet.',
                'Submit.',
              ],
            },
            {
              kind: 'list',
              items: [
                'If the app closes before you submit, your draft is kept. Photos, the file and the signature have to be added again.',
                'If your manager rejects the report, open it, read their comment, and tap Correct and Resubmit.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'leave-docs',
      title: 'Leave and documents',
      topics: [
        {
          id: 'request-leave',
          title: 'Request leave',
          path: '/dashboard/my-leave',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open My Leave in the menu and tap Request Leave.',
                'Choose the leave type and the start and end dates (or Half day). Check DAYS CHARGED.',
                'Add a reason and remarks if you like (for example "Medical certificate obtained").',
                'Tap Submit Request. HR is notified and you get a notification when they decide.',
              ],
            },
            {
              kind: 'list',
              items: [
                'My Balance shows how many days you have left of each type.',
                'While a request is PENDING you can Edit it or Withdraw it. Once HR has decided, you can only withdraw it.',
              ],
            },
          ],
        },
        {
          id: 'my-documents',
          title: 'Keep your documents',
          path: '/dashboard/my-documents',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open My Documents and tap Upload Document.',
                'Give it a NAME (for example "Driving licence") and choose the TYPE.',
                'Tap to choose a photo or PDF (up to 10MB) and upload.',
              ],
            },
            { kind: 'p', text: 'Only you and HR can see these documents. You can download or delete them at any time.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Tools and materials',
      topics: [
        {
          id: 'request-tools',
          title: 'Ask for tools',
          path: '/dashboard/store/requests',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open Technet Store → Tool Requests and tap Request Tools.',
                'Write the tools or equipment you need, and optionally the type or brand, what for and when.',
                'Tap Send Request. The store is notified, and you get a notification when your tools are ready to collect.',
              ],
            },
            {
              kind: 'list',
              items: [
                'While the request is pending you can Edit it. You can Delete it as long as no tools were issued.',
                'Technet Store → Tools & Equipment shows Tools I Have: every tool issued to you and when it is due back. Give tools back to the store: they record the return.',
              ],
            },
          ],
        },
        {
          id: 'request-materials',
          title: 'Ask for materials',
          path: '/dashboard/store/materials',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Open Technet Store → Material Requests and tap Request Materials.',
                'For each material write the DESCRIPTION (for example "Silicone glue"), the reference if you know it, and the QUANTITY. Tap Add another material for more lines.',
                'Optionally say what it is for and when you need it.',
                'Tap Send Request. You get a notification when it is ready to collect.',
              ],
            },
            { kind: 'p', text: 'Technet Store → Materials shows Materials I Have: what has been issued to you.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'help',
      title: 'Getting help',
      topics: [
        {
          id: 'support',
          title: 'Who to ask',
          path: '/dashboard/help',
          blocks: [
            {
              kind: 'list',
              items: [
                'Password, sign-in email or a page you cannot see: the administrator.',
                'Check-in card missing, leave, overtime or your attendance PDF: HR.',
                'Jobs and reports: your supervisor.',
                'Anything else, or the app is not working: call support on 5885 1000 (the number is also in the Help Center).',
              ],
            },
          ],
        },
      ],
    },
  ],
}
