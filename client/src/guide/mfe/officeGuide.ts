import { topicsFrom } from '../shared'
import type { RoleGuide } from '../types'
import { TECHNICIAN_GUIDE_MFE } from './technicianGuide'

/**
 * Gid personel biro - Kreol Morisien copy of ../officeGuide.ts (2026-10-21). Same chapters,
 * topics, ids and paths; shared topics come from the Kreol Technician guide.
 */

const tech = topicsFrom(TECHNICIAN_GUIDE_MFE)

export const OFFICE_GUIDE_MFE: RoleGuide = {
  title: 'Gid personel biro',
  intro:
    "Kouma personel biro servi Technet Digital: pointe lariver ek depar, konze, dokiman, ek demann zouti ek materyo dan magazin. Sak size se enn travay, etap par etap.",
  roles: ['EMPLOYEE'],
  updated: '2026-10-21',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pou koumanse',
      topics: [
        {
          id: 'your-role',
          title: 'Seki ou kapav fer',
          blocks: [
            {
              kind: 'list',
              items: [
                'Prezans: pointe ou lariver kan ou koumans travay e pointe ou depar kan ou ale.',
                'Mo Konze: demann konze e get ou balans.',
                'Mo dokiman: gard kopi ou kart idantite, ou permi ek ou sertifika.',
                'Technet Store: demann zouti ek materyo.',
                'Technet Operations: get bon travay ek rapor, e soumet rapor si finn donn ou travay.',
              ],
            },
          ],
        },
        tech('sign-in'),
        tech('install'),
        tech('permissions'),
        tech('language'),
        tech('no-card'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'attendance',
      title: 'Pointe lariver ek depar',
      intro: "Pointe ou lariver kan ou koumans travay e pointe ou depar kan ou ale. Ou telefonn anrezistre ler, ou landrwa ek enn foto.",
      topics: [
        tech('check-in'),
        tech('check-out'),
        tech('compliance-check'),
        tech('location-while-in'),
        tech('reminders'),
        tech('no-signal'),
        {
          id: 'my-attendance',
          title: 'Get ou prezans e telesarz li',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: "Anba kart la, Zordi montre vizit zordi, e Mo prezans montre mwa la: zour, ler, transpor, reta ek ler siplemanter aprouve." },
            {
              kind: 'list',
              items: [
                "Ler travay se lindi ziska vandredi 08:00–17:00 ek sanmdi 08:00–13:00. Ou an reta si ou premie pointaz, dapre ler aplikasion la, apre 08:30.",
                "Ler siplemanter konte depi 17:30 lasemenn ek 13:30 sanmdi. Zot paret isi zis apre ki RH finn aprouv zot.",
              ],
            },
            {
              kind: 'steps',
              items: [
                'Pou gagn enn PDF, tap Exporte PDF, swazir bann dat e tap Telesarz PDF.',
                "PDF la ena mark DRAFT ziska RH valid mwa la. Ou gagn enn notifikasion kan zot fer sa, e prosenn telesarzman pena mark DRAFT.",
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'leave-docs',
      title: 'Konze ek dokiman',
      topics: [tech('request-leave'), tech('my-documents')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Zouti ek materyo',
      topics: [tech('request-tools'), tech('request-materials')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'jobs',
      title: 'Travay ek rapor',
      intro: 'Zis si finn donn ou travay. Sinon, ou kapav sot sa sapit la.',
      topics: [tech('my-jobs'), tech('job-status'), tech('daily-report'), tech('intervention-report')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'help',
      title: 'Gagn led',
      topics: [tech('support')],
    },
  ],
}
