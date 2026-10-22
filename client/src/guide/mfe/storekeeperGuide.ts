import { topicsFrom } from '../shared'
import type { RoleGuide } from '../types'
import { ADMIN_GUIDE_MFE } from './adminGuide'

/**
 * Gid magazinie - Kreol Morisien copy of ../storekeeperGuide.ts (2026-10-21). Same chapters,
 * topics, ids and paths; shared topics come from the Kreol Admin guide.
 */

const shared = topicsFrom(ADMIN_GUIDE_MFE)

export const STOREKEEPER_GUIDE_MFE: RoleGuide = {
  title: 'Gid magazinie',
  intro:
    "Kouma pou fer magazin la marse dan Technet Digital: zouti ek lekipman, materyo, bann demann ki ariv, ek inventer ek lasa dan ERP. Li swiv ou meni depi anler ziska anba. Paz Sekirite pa ankor tradwir; so bann bouton ekrir isi an angle.",
  roles: ['STOREKEEPER'],
  updated: '2026-10-22',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pou koumanse',
      topics: [
        {
          id: 'your-role',
          title: 'Ki magazinie la fer',
          blocks: [
            { kind: 'p', text: "Ou okip magazin la: zouti ek lekipman ki done enn par enn, materyo ki swivi par kantite, ek aste stok par ERP. Aplikasion la ouver lor Technet Store → Zouti ek lekipman." },
            {
              kind: 'list',
              items: [
                'Technet Store: ou azout zouti ek materyo, ou done zot dapre bann demann, ou anrezistre retour e ou koriz stok.',
                'Technet ERP: Inventer, Fourniser, Demann lasa ek Bon komand.',
                'Technet Operations: bon travay ek rapor, zis pou get.',
                "Ou pa pointe, e ou pena paz Mo Konze ni Mo dokiman.",
                'Se enn administrater ki zer login ek mo de pas.',
              ],
            },
          ],
        },
        shared('finding-your-way'),
        {
          id: 'notifications',
          title: 'Notifikasion',
          blocks: [
            { kind: 'p', text: "Lakons dan lantet dir ou kan enn kikenn avoy ouswa sanz enn demann zouti ouswa enn demann materyo. Klik lor enn notifikasion pou ouver li. Mark tou kouma lir met konter la a zero." },
            { kind: 'note', text: "Sa bann notifikasion la paret zis dan aplikasion la. Personn pa gagn imel ouswa SMS pou zot. Zot text ankor an angle pou aster." },
          ],
        },
        shared('install-language'),
        shared('slow-first-load'),
        shared('form-drafts'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Technet Store',
      intro: "Zouti ek lekipman swivi enn par enn. Materyo kouma lakol, tep ouswa vis swivi par kantite. Ninport ki dimoun ki ena enn dosie anplwaye kapav avoy ou enn demann.",
      topics: [
        shared('tools'),
        {
          id: 'tool-statuses',
          title: 'Stati ek leta enn zouti',
          path: '/dashboard/store/tools',
          blocks: [
            {
              kind: 'list',
              items: [
                'Disponib: dan magazin, kapav done.',
                "Finn sorti: enn kikenn ena li. Sa stati la met kan ou done li e tire kan ou anrezistre retour la. Ou pa kapav sanz li ar lamin.",
                'Pe repare: finn retourn abime, ouswa finn avoye pou repare. Remet li Disponib avek Modifie kan li finn repare.',
                "Pa servi ankor: pa servi zot ankor. Met enn zouti Pa servi ankor olie efas li, pou gard so listwar.",
                "Leta (Bon, Pasab, Abime) anrezistre kan ou azout zouti la, e ankor lor sak retour.",
              ],
            },
            { kind: 'tip', text: "Rod dan rezis la par etiket, nom ouswa nimero seri. Bann zouti an reta gagn enn mark pou ou kapav al rod zot." },
          ],
        },
        shared('tool-requests'),
        shared('materials'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'erp',
      title: 'Inventer ek lasa',
      intro: "Technet ERP → Inventer ek Lasa. Zot separe ar Materyo magazin: aste isi azout dan Inventer, pa dan Materyo.",
      topics: [
        {
          id: 'inventory',
          title: 'Inventer',
          path: '/dashboard/erp/inventory',
          blocks: [
            {
              kind: 'list',
              items: [
                "Azout enn lartik kre enn lartik avek so REF., kategori, linite, pri inite, plas, kantite depar ek stok minimom.",
                "Bouton Azist stok (bann fles) anrezistre enn Rantre, enn Sorti ouswa enn Azisteman, avek enn rezon si ou anvi. Rezis stok montre sak mouvman.",
                'Bann lartik ki ariv nivo minimom ouswa anba konte kouma STOK BA.',
                "Marsandiz ki resevwar lor enn bon komand azoute dan Inventer otomatikman pou bann lign ki konekte ar enn lartik.",
              ],
            },
          ],
        },
        {
          id: 'requisitions',
          title: 'Aprouv demann lasa',
          path: '/dashboard/erp/procurement/requisitions',
          blocks: [
            { kind: 'p', text: "Enn demann lasa se enn demann depi biro pou aste kiksoz. Personel biro kre zot avek Nouvo demann lasa; ou ek administrater deside." },
            {
              kind: 'steps',
              items: [
                "Ouver Technet ERP → Lasa → Demann lasa e ouver enn demann PE ATANN.",
                "Klik Aprouve, ouswa Refize avek enn rezon. Dimoun ki finn demande gagn enn notifikasion.",
                "Pou enn demann aprouve, klik Konverti an bon komand, swazir fourniser la e rant pri inite.",
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
      title: 'Bon travay ek rapor (zis pou get)',
      topics: [
        {
          id: 'operations-view',
          title: 'Bon travay ek rapor',
          path: '/dashboard/operations/work-orders',
          blocks: [
            { kind: 'p', text: "Technet Operations montre bann travay prevwar pou teknisien ek bann rapor zournalie ek intervansion ki zot soumet. Rapor intervansion montre materyo ki finn servi lor sak vizit." },
            { kind: 'note', text: "Se enn administrater ouswa Responsab Operasion ki kre travay e ki aprouv rapor." },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'account',
      title: 'Ou kont',
      topics: [
        {
          id: 'account-security',
          title: 'Mo de pas ek listwar koneksion',
          path: '/dashboard/security',
          blocks: [
            {
              kind: 'list',
              items: [
                "Se enn administrater ki zer ou mo de pas. Si ou bliye li, demann li reinisializ li dan Zestion itilizater.",
                'Sekirite → My Account montre ou prop dernie koneksion.',
                "Ou res konekte pandan 30 zour, e sa 30 zour la rekomans sak fwa ou servi aplikasion la. Dekonekte, anba dan meni, dekonekte ou toutswit.",
              ],
            },
          ],
        },
      ],
    },
  ],
}
