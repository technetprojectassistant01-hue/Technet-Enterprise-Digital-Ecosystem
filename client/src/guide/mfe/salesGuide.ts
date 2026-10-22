import { topicsFrom } from '../shared'
import type { RoleGuide } from '../types'
import { ADMIN_GUIDE_MFE } from './adminGuide'
import { HR_GUIDE_MFE } from './hrGuide'
import { TECHNICIAN_GUIDE_MFE } from './technicianGuide'

/**
 * Gid ofisie lavant - Kreol Morisien copy of ../salesGuide.ts (2026-10-21). Same chapters, topics,
 * ids and paths; shared topics come from the Kreol Admin, HR and Technician guides.
 */

const admin = topicsFrom(ADMIN_GUIDE_MFE)
const hr = topicsFrom(HR_GUIDE_MFE)
const tech = topicsFrom(TECHNICIAN_GUIDE_MFE)

export const SALES_GUIDE_MFE: RoleGuide = {
  title: 'Gid ofisie lavant',
  intro:
    "Travay enn ofisie lavant dan Technet Digital: kliyan, demann devi, devi ek zot swivi, portal kliyan ek kalandrie marketing. Sak size se enn travay, etap par etap.",
  roles: ['SALES_OFFICER'],
  updated: '2026-10-22',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pou koumanse',
      topics: [
        {
          id: 'your-role',
          title: 'Seki enn ofisie lavant kapav fer',
          blocks: [
            { kind: 'p', text: "Lavant okip kliyan ek devi. Aplikasion la ouver lor Technet ERP, kot Vi zeneral montre kliyan, devi, kontra ek dernie aktivite." },
            {
              kind: 'list',
              items: [
                "Ou zer kliyan, demann devi (Call Log), devi ek zot swivi, ek akse kliyan lor portal.",
                'Ou planifie piblikasion dan Technet Digital Marketing.',
                "Ou kapav azout dokiman e demann enn lasa avek enn demann lasa.",
                "Kontra, proze, inventer, fourniser, bon komand ek Technet Operations se zis pou get pou ou.",
                "Ou pa pointe, alor pena paz Prezans dan ou meni. Mo Konze ek Mo dokiman marse kan RH finn konekte ou login ar ou dosie anplwaye.",
                'Se enn administrater ki kre bann login. Ou pa kapav kre ni reinisializ login.',
              ],
            },
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
                "Enn kliyan finn demann enn devi depi portal. Klik lor li pou ouver Call Log.",
                'Enn devi ki ou finn kre finn gagn mark Aprouve ouswa Pa aprouve.',
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
        admin('form-drafts'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'sales',
      title: 'Kliyan ek devi',
      intro: 'Technet ERP → Kliyan ena kat paz: Kliyan, Devi (avek Call Log), Swivi ek Kontra.',
      topics: [
        admin('customers'),
        admin('quote-requests'),
        admin('quotations'),
        {
          id: 'follow-up-contracts',
          title: 'Swivi ek kontra',
          path: '/dashboard/erp/customers/follow-up',
          blocks: [
            {
              kind: 'list',
              items: [
                "Swivi montre bann apel ki finn anrezistre lor devi, par kliyan ouswa par dat. Pou anrezistre enn apel, ouver devi la e servi so parti Swivi.",
                "Kontra montre kontra servis avek kliyan, zot valer ek zot dat koumansman ek lafin. Ou kapav lir zot; se enn administrater ouswa Ofisie Finans ki azout ouswa sanz enn kontra.",
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
      title: 'Dokiman, lasa ek res ERP',
      topics: [
        {
          id: 'documents',
          title: 'Dokiman',
          path: '/dashboard/erp/documents',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouver Technet ERP → Dokiman e klik Azout enn dokiman.',
                "Swazir FISIE la, donn li enn TIT ek enn KATEGORI (kontra, proze, devi…), e swazir PROZE ouswa KLIYAN si li pou zot.",
                'Klik Azout enn dokiman. Tou dimoun ki kapav ouver Dokiman pou trouv li.',
              ],
            },
          ],
        },
        {
          id: 'requisitions',
          title: 'Demann enn lasa (demann lasa)',
          path: '/dashboard/erp/procurement/requisitions',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouver Technet ERP → Lasa → Demann lasa e klik Nouvo demann lasa.',
                "Rant NIMERO DEMANN (li pa bizin deza servi), dat BIZIN POU ek, si li pou enn proze, PROZE la.",
                "Azout enn lign pou sak zafer ki bizin: deskripsion, kantite ek, si ou kone, pri inite. Klik Azout enn lign pou plis lign.",
                'Klik Avoy demann.',
              ],
            },
            { kind: 'p', text: "Magazinie ouswa enn administrater aprouv ouswa refiz li, e ou gagn enn notifikasion dan tou le de ka. Enn demann aprouve vinn enn bon komand, ki ou kapav swiv dan Bon komand." },
          ],
        },
        {
          id: 'view-only',
          title: 'Seki ou trouve me ou pa kapav sanze',
          blocks: [
            {
              kind: 'list',
              items: [
                "Proze: kliyan, responsab, dat ek bidze sak proze. Se enn administrater ouswa Responsab Operasion ki zer proze.",
                "Inventer, Fourniser ek Bon komand: nivo stok ek seki finn komande. Magazinie ouswa enn administrater met zot azour.",
                "Technet Operations: Bon travay, Rapor zournalie ek Rapor intervansion, pou trouv kot travay enn kliyan ete. Se Responsab Operasion ouswa enn administrater ki kre ek aprouv zot.",
                'Technet Store: zouti ek materyo ki dan magazin.',
              ],
            },
          ],
        },
      ],
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
      topics: [
        hr('account-security'),
        {
          id: 'support',
          title: 'Kisannla pou demande',
          path: '/dashboard/help',
          blocks: [
            {
              kind: 'list',
              items: [
                "Mo de pas, imel koneksion ouswa enn paz ki ou pa trouve: administrater.",
                'Konze, ouswa Mo Konze ek Mo dokiman ki dir ou kont pa konekte: RH.',
                "Tou lezot zafer, ouswa si aplikasion la pa marse: apel sipor lor 5885 1000 (nimero la osi dan Sant Led).",
              ],
            },
          ],
        },
      ],
    },
  ],
}
