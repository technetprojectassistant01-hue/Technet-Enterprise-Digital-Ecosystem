import { topicsFrom } from './shared'
import { TECHNICIAN_GUIDE } from './technicianGuide'
import type { RoleGuide } from './types'

/**
 * The Staff Office guide (role EMPLOYEE, shown as "Staff Office"). Office staff use the same
 * personal pages as technicians - check-in card, compliance checks, reminders, My Leave, My
 * Documents, the store and Operations reports - so those topics come from the Technician guide.
 * The difference written here: office staff are never marked Absent (that rule is technicians
 * only, server lib/absences.ts). Written against the live app on 2026-10-19.
 */

const tech = topicsFrom(TECHNICIAN_GUIDE)

export const OFFICE_GUIDE: RoleGuide = {
  title: 'Staff Office guide',
  intro:
    'How office staff use Technet Digital: checking in and out, leave, documents, and asking the store for tools and materials. Each topic is one task, step by step.',
  roles: ['EMPLOYEE'],
  updated: '2026-10-22',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Getting started',
      topics: [
        {
          id: 'your-role',
          title: 'What you can do',
          blocks: [
            {
              kind: 'list',
              items: [
                'Attendance: check in when you start work and check out when you leave.',
                'My Leave: ask for leave and see your balance.',
                'My Documents: keep copies of your ID, licence and certificates.',
                'Technet Store: ask for tools and materials.',
                'Technet Operations: see work orders and reports, and file reports if you are given jobs.',
              ],
            },
          ],
        },
        tech('sign-in'),
        tech('install'),
        tech('permissions'),
        tech('language'),
        tech('no-card'),
        tech('form-drafts'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'attendance',
      title: 'Checking in and out',
      intro: 'Check in when you start work and check out when you leave. Your phone records the time, your location and a photo.',
      topics: [
        tech('check-in'),
        tech('check-out'),
        tech('compliance-check'),
        tech('location-while-in'),
        tech('reminders'),
        tech('no-signal'),
        {
          id: 'my-attendance',
          title: 'See your attendance and download it',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: 'Below the card, Today shows today\'s visits, and My Attendance shows the month: days, hours, transport, late days and approved overtime.' },
            {
              kind: 'list',
              items: [
                'Work hours are Monday to Friday 08:00–17:00 and Saturday 08:00–13:00. You are late if your first check-in, by the app\'s clock, is after 08:30.',
                'Overtime counts from 17:30 on weekdays and 13:30 on Saturday. It only appears here after HR approves it.',
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
      id: 'leave-docs',
      title: 'Leave and documents',
      topics: [tech('request-leave'), tech('my-documents')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Tools and materials',
      topics: [tech('request-tools'), tech('request-materials')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'jobs',
      title: 'Jobs and reports',
      intro: 'Only if you are assigned to jobs. Otherwise you can skip this chapter.',
      topics: [tech('my-jobs'), tech('job-status'), tech('daily-report'), tech('intervention-report')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'help',
      title: 'Getting help',
      topics: [tech('support')],
    },
  ],
}
