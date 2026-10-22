import { topicsFrom } from '../shared'
import type { RoleGuide } from '../types'
import { ADMIN_GUIDE_MFE } from './adminGuide'

/**
 * Gid RH - Kreol Morisien copy of ../hrGuide.ts (2026-10-21). Same chapters, topics, ids and
 * paths; shared topics come from the Kreol Admin guide.
 */

const shared = topicsFrom(ADMIN_GUIDE_MFE)

export const HR_GUIDE_MFE: RoleGuide = {
  title: 'Gid RH',
  intro:
    "Travay RH dan Technet Digital: dosie anplwaye, konze, ler siplemanter, validasion lafin mwa, lapey ek sertifikasion, ek prezans personel ki servi pou verifie zot. Li swiv ou meni depi anler ziska anba. Kek paz pa ankor tradwir; zot bouton ekrir isi an angle, kouma zot paret lor lekran.",
  roles: ['HR_OFFICER'],
  updated: '2026-10-22',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pou koumanse',
      topics: [
        {
          id: 'your-role',
          title: 'Seki RH kapav fer',
          blocks: [
            { kind: 'p', text: "RH okip dimoun: zot dosie, zot konze, zot ler siplemanter, validasion prezans ek lapey. Ou meni ena Prezans, Technet HR, Technet Store ek Technet Operations." },
            {
              kind: 'list',
              items: [
                "Ou zer tou dan Technet HR, ar saler, detay labank ek nimero kart idantite ladan.",
                'Lor rezis prezans, ou kapav aprouv ler siplemanter ek eskiz absans.',
                "Technet Operations ek Technet Store se zis pou get pou ou: ou trouv bon travay, rapor, prezans, anomali ek magazin, me se administrater, Responsab Operasion ouswa Magazinie ki sanz zot.",
                "Ou pa pointe, e ou pena paz Mo Konze ni Mo dokiman. Ou kont pa bizin enn dosie anplwaye, sof si ou osi gagn lapey par sistem la.",
                'Se enn administrater ki kre bann login. Ou pa kapav kre ni reinisializ login.',
              ],
            },
          ],
        },
        shared('finding-your-way'),
        {
          id: 'notifications',
          title: 'Notifikasion',
          blocks: [
            { kind: 'p', text: "Lakons dan lantet montre seki pe atann RH: enn demann konze ki finn avoye ouswa sanze, ek ler siplemanter pou aprouve apre enn teknisien finn pointe so depar tar. Klik lor enn notifikasion pou al lor dosie la. Mark tou kouma lir met konter la a zero." },
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
      id: 'attendance',
      title: 'Prezans personel',
      intro: "Bann teknisien pointe zot lariver ek zot depar lor zot telefonn. Sak pointaz anrezistre ler ek landrwa ki zot finn ekrir, ler aplikasion la, enn pozision GPS ek souvan enn foto. RH servi sa pou aprouv ler siplemanter, valid bann mwa ek fer lapey.",
      topics: [
        shared('staff-attendance'),
        shared('absences'),
        shared('export-attendance'),
        {
          id: 'team-attendance',
          title: 'Prezans lekip',
          path: '/dashboard/operations/team-attendance',
          blocks: [
            { kind: 'p', text: "Technet Operations → Prezans lekip se rezis konple la, par mwa ouswa par semenn." },
            {
              kind: 'list',
              items: [
                'Mwa / Semenn sanz peryod la. Bann fles al divan ek deryer.',
                "Swazir enn teknisien pou trouv zis enn dimoun. Tik Inklir ansien anplwaye pou trouv dimoun ki finn ale.",
                "Rezime prezans se Monthly Report AiFace. Klik lor enn nom pou ouver rapor zournalie sa dimoun la.",
                'Rezis prezans montre sak vizit zour par zour, avek foto pointaz ek bann kontrol konformite.',
                'Exporte mwa / Exporte semenn telesarz rapor Excel, ek Telesarz PDF telesarz PDF la, pou peryod ki lor lekran.',
              ],
            },
            { kind: 'note', text: "Se enn administrater ouswa Responsab Operasion ki ferm enn pointaz ki finn bliye. Enn poste ki ankor ouver apre minwi ferm otomatikman a ler fermtir so zour (17:00, ouswa 13:00 sanmdi)." },
          ],
        },
        {
          id: 'anomalies',
          title: 'Anomali prezans (zis pou get)',
          path: '/dashboard/operations/anomalies',
          blocks: [
            { kind: 'p', text: "Technet Operations → Anomali prezans montre sa ki aplikasion la pa finn kapav verifie: lwin depi travay la, pointe pre kot li reste, deplasman inposib, kitfwa fo GPS, enn ler ouswa landrwa ekrir ki pa koresponn, GPS pa presi, pozision rate ouswa kontrol konformite rate." },
            {
              kind: 'list',
              items: [
                "Ou kapav lir tou anomali e filtre par stati, tip, gravite, anplwaye ek dat. Se enn administrater ouswa Responsab Operasion ki deside zot (Konfirm Lezitim, Marke Fos Alarm, Konfirm Violasion, Anile).",
                "Ler siplemanter enn zour ki ena anomali ouver montre enn avertisman avan ou aprouv li.",
                "Ou pa kapav valid mwa enn dimoun tan ki li ena anomali Elve ouver. Demann Operasion get zot avan.",
              ],
            },
            { kind: 'note', text: "Enn anomali se enn rezon pou get, pa enn prev ki enn kikenn finn fer enn fot. GPS glise dan batiman, e enn nom landrwa ekrir kouma « Moka » tom dan mitan rezion la, plizier kilomet depi enn vre sit." },
          ],
        },
        {
          id: 'field-ops',
          title: 'Operasion teren, Kart an direk ek Plas koni (zis pou get)',
          path: '/dashboard/operations/live-map',
          blocks: [
            {
              kind: 'list',
              items: [
                "Operasion teren montre kisannla pointe aster, kot zot dir zot ete ek depi kominn letan.",
                "Kart an direk montre tou dimoun ki lor poste: kot zot finn pointe ek kot zot finn trouve dernie fwa. Ver: pre kot pointaz ek trouve resaman; oranz: pa trouve depi 45 minit ouswa plis; rouz: 500 m ouswa plis, ouswa enn anomali grav.",
                "Plas koni montre bann sit ki aplikasion la finn aprann. Enn pointaz andan enn sa bann plas la paret kouma Verifie.",
              ],
            },
            { kind: 'note', text: "Enn telefonn avoy so pozision zis kan aplikasion la ouver lor lekran. Enn telefonn ki blok ouswa enn aplikasion ki ferme pa avoy nanye, alor « dernie fwa trouve » kapav vie san ki ena okenn problem." },
          ],
        },
        shared('checks'),
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'people',
      title: 'Anplwaye',
      topics: [
        shared('hr-overview'),
        shared('employees'),
        {
          id: 'link-employee',
          title: 'Konekte enn anplwaye ar so login',
          path: '/dashboard/hr/employees',
          blocks: [
            { kind: 'p', text: "Enn anplwaye kapav pointe, demann konze ouswa azout dokiman zis kan so dosie konekte ar enn login. Enn nouvo teknisien ki « pena kart pointaz » souvan vedir sa lien la manke." },
            {
              kind: 'steps',
              items: [
                "Demann enn administrater kre login dimoun la dan Zestion itilizater (RH pa kapav kre login).",
                "Ouver Technet HR → Anplwaye e ouver dimoun la, ouswa klik Add Employee. Kod anplwaye donn otomatikman.",
                'Klik Edit, swazir so login anba Linked Login, apre anrezistre.',
                "Prosenn fwa li ouver aplikasion la, kart pointaz paret.",
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
      title: 'Konze',
      topics: [
        {
          id: 'leave-requests',
          title: 'Aprouv konze',
          path: '/dashboard/hr/leave',
          blocks: [
            { kind: 'p', text: "Personel demann konze depi Mo Konze lor zot telefonn. Ou gagn enn notifikasion, e demann la atann dan Technet HR → Konze → Demann." },
            {
              kind: 'steps',
              items: [
                'Ouver Technet HR → Konze. Demann montre tou bann demann; filtre par stati pou trouv seki pe atann.',
                "Aprouv ouswa refiz sakenn. Si dimoun la pena ase balans, ou gagn enn avertisman e ou kapav klik Aprouve kanmem.",
                'Dimoun la gagn enn notifikasion. Bann zour aprouve tir dan so balans.',
              ],
            },
            {
              kind: 'list',
              items: [
                "Anrezistre konze anrezistre enn konze ou-mem, par egzanp apre enn apel ouswa enn form papie.",
                'Modifie sanz enn demann. Anil enn konze aprouve remet bann zour dan balans.',
                "Personel kapav sanz ouswa retir zot prop demann zis tan ki li pe atann.",
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
      title: 'Ler siplemanter, validasion ek lapey',
      topics: [shared('overtime'), shared('overtime-records'), shared('validations'), shared('payroll')],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'operations',
      title: 'Bon travay, rapor ek magazin (zis pou get)',
      topics: [
        {
          id: 'operations-view',
          title: 'Bon travay ek rapor',
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'list',
              items: [
                "Bon travay montre bann travay prevwar pou teknisien, avek kisannla lor li ek stati la.",
                "Rapor zournalie ek Rapor intervansion montre seki teknisien finn soumet pou sak zour ek sak vizit. Servi filtre dat ek kliyan pou trouv enn.",
              ],
            },
            { kind: 'note', text: "Se enn administrater ouswa Responsab Operasion ki kre bon travay e ki aprouv ouswa refiz rapor." },
          ],
        },
        {
          id: 'store-view',
          title: 'Technet Store',
          path: '/dashboard/store/tools',
          blocks: [
            { kind: 'p', text: "Ou trouv rezis zouti ek lekipman ek materyo ki ena dan stok. Se Magazinie ouswa enn administrater ki fer sorti, retour ek sanzman stok." },
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
