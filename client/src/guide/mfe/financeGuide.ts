import { topicsFrom } from '../shared'
import type { RoleGuide } from '../types'
import { ADMIN_GUIDE_MFE } from './adminGuide'
import { HR_GUIDE_MFE } from './hrGuide'
import { SALES_GUIDE_MFE } from './salesGuide'
import { TECHNICIAN_GUIDE_MFE } from './technicianGuide'

/**
 * Gid ofisie finans - Kreol Morisien copy of ../financeGuide.ts (2026-10-21). Same chapters,
 * topics, ids and paths; shared topics come from the Kreol Admin, Sales, HR and Technician guides.
 */

const admin = topicsFrom(ADMIN_GUIDE_MFE)
const sales = topicsFrom(SALES_GUIDE_MFE)
const hr = topicsFrom(HR_GUIDE_MFE)
const tech = topicsFrom(TECHNICIAN_GUIDE_MFE)

export const FINANCE_GUIDE_MFE: RoleGuide = {
  title: 'Gid ofisie finans',
  intro:
    "Travay enn ofisie finans dan Technet Digital: dosie kliyan ek zot akse portal, kontra servis, devi, dokiman ek demann lasa. Sak size se enn travay, etap par etap. Bann paz ERP pa ankor tradwir; zot bouton ekrir isi an angle, kouma zot paret lor lekran.",
  roles: ['FINANCE_OFFICER'],
  updated: '2026-10-21',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pou koumanse',
      topics: [
        {
          id: 'your-role',
          title: 'Seki enn ofisie finans kapav fer',
          blocks: [
            { kind: 'p', text: "Aplikasion la ouver lor Technet ERP, kot Vi zeneral montre kliyan, devi, kontra ek dernie aktivite." },
            {
              kind: 'list',
              items: [
                "Ou azout ek sanz kliyan, ar zot detay faktirasion ladan (BRN, nimero TVA), e ou donn zot akse portal.",
                'Ou anrezistre ek met azour kontra servis.',
                "Ou kapav lir tou devi ek zot listwar apel, telesarz zot PDF ek avoy zot par imel, me se Lavant ki kre ek sanz devi.",
                "Ou kapav azout dokiman e demann enn lasa avek enn demann lasa.",
                "Proze, inventer, fourniser, bon komand ek Technet Operations se zis pou get pou ou.",
                "Ou pa pointe, alor pena paz Prezans dan ou meni. Mo Konze ek Mo dokiman marse kan RH finn konekte ou login ar ou dosie anplwaye.",
                'Se enn administrater ki kre bann login. Ou pa kapav kre ni reinisializ login.',
              ],
            },
            { kind: 'note', text: 'Faktir ek depans gard dan QuickBooks, pa dan sa aplikasion la.' },
          ],
        },
        tech('sign-in'),
        admin('finding-your-way'),
        {
          id: 'notifications',
          title: 'Notifikasion',
          blocks: [
            {
              kind: 'list',
              items: [
                'Ou demann lasa finn aprouve ouswa refize.',
                'Ou demann konze finn deside, ouswa ou zouti ouswa materyo pare pou pran.',
              ],
            },
            { kind: 'p', text: "Klik lor enn notifikasion pou al lor dosie la. Mark tou kouma lir met konter la a zero." },
            { kind: 'note', text: "Sa bann notifikasion la paret zis dan aplikasion la. Personn pa gagn imel ouswa SMS pou zot. Zot text ankor an angle pou aster." },
          ],
        },
        admin('install-language'),
        admin('slow-first-load'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'customers',
      title: 'Kliyan ek kontra',
      intro: 'Technet ERP → Kliyan ena kat paz: Kliyan, Devi, Swivi ek Kontra.',
      topics: [
        admin('customers'),
        {
          id: 'contracts',
          title: 'Kontra',
          path: '/dashboard/erp/customers/contracts',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouver Technet ERP → Kliyan → Kontra e klik Nouvo kontra. Kliyan la bizin egziste avan.",
                "Swazir KLIYAN la, dekrir SERVIS la, e rant VALER, STATI, DAT KOUMANSMAN ek DAT LAFIN.",
                'Klik Kre kontra.',
              ],
            },
            { kind: 'p', text: "Servi aksion modifikasion ek efasman o bout sak lign pou sanz enn kontra (par egzanp so stati kan li fini) ouswa pou efas li." },
          ],
        },
        {
          id: 'quotations-view',
          title: 'Devi (zis pou get)',
          path: '/dashboard/erp/customers/quotations',
          blocks: [
            {
              kind: 'list',
              items: [
                "Devi montre tou devi avek zot kliyan, zot stati ek zot total. Ouver enn pou trouv so bann lign, so kondision peyman ek so bann fisie atase.",
                "Telesarz PDF anrezistre devi la an PDF. Avoy kliyan telesarz li e ouver enn imel avek text la pare; atas PDF la ou-mem avan avoye.",
                "Swivi montre bann devi par kliyan ouswa par dat, pou trouv seki finn propoze ek kan.",
                "Swivi lor enn devi montre sak apel ki Lavant finn anrezistre: dat, kisannla zot finn koze ek rezilta.",
                "Kre, sanz ek mark bann devi (avoye, aprouve, pa aprouve), anrezistre apel ek Call Log bann demann devi se pou Lavant.",
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
      title: 'Dokiman, lasa ek res ERP',
      topics: [sales('documents'), sales('requisitions'), sales('view-only')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'self-service',
      title: 'Konze, dokiman ek magazin',
      intro: "Sa bann paz la bizin ki ou login konekte ar ou dosie anplwaye. Si zot dir ki pena dosie anplwaye lie ar ou kont, demann RH.",
      topics: [tech('request-leave'), tech('my-documents'), tech('request-tools'), tech('request-materials')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'account',
      title: 'Ou kont ek led',
      topics: [hr('account-security'), sales('support')],
    },
  ],
}
