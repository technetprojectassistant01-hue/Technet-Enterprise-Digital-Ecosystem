import type { RoleGuide } from '../types'

/**
 * Gid teknisien - Kreol Morisien copy of ../technicianGuide.ts (2026-10-21). Same chapters, topics,
 * ids and paths; change all three languages together. Short sentences and the exact Kreol button
 * names, for people who are not very technical.
 */
export const TECHNICIAN_GUIDE_MFE: RoleGuide = {
  title: 'Gid teknisien',
  intro:
    "Kouma pou servi Technet Digital lor ou telefonn: pointe ou lariver ek ou depar, ou travay pou zordi, bann rapor, konze, zouti ek dokiman. Sak size se enn travay, etap par etap.",
  roles: ['FIELD_TECHNICIAN'],
  updated: '2026-10-22',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pou koumanse',
      topics: [
        {
          id: 'sign-in',
          title: 'Konekte',
          blocks: [
            {
              kind: 'list',
              items: [
                "Se administrater ki donn ou ou imel ek ou mo de pas. Ou pa kapav sanz ou mo de pas ou-mem.",
                "Si ou bliye ou mo de pas, demann administrater met enn nouvo.",
                "Ou res konekte pandan 30 zour, e sa 30 zour la rekomans sak fwa ou servi aplikasion la, alor ou rarman bizin rekonekte.",
              ],
            },
          ],
        },
        {
          id: 'install',
          title: 'Met aplikasion la lor ou telefonn',
          path: '/dashboard/settings',
          blocks: [
            { kind: 'p', text: "Instal aplikasion la pou ouver li depi enn ikonn kouma tou lezot aplikasion. Lor enn iPhone, sa obligatwar: kontrol konformite ek rapel ariv zis lor enn aplikasion ki instale." },
            {
              kind: 'list',
              items: [
                "Android: kan fenet « Instal Technet Digital » paret, tap Instal aster.",
                "iPhone: ouver sit la dan Safari, tap Share, apre Add to Home Screen, apre Add. Lor bann iPhone resan, Share dan bouton ⋯.",
                "Ou finn rat fenet la? Ouver Paramet e tap Instal Technet Digital.",
              ],
            },
          ],
        },
        {
          id: 'permissions',
          title: 'Permet landrwa ek notifikasion',
          blocks: [
            { kind: 'p', text: "Aplikasion la bizin de permision. Dir Permet pou tou le de." },
            {
              kind: 'list',
              items: [
                "Landrwa: bizin pou pointe. San sa, Pointe lariver pa marse.",
                "Notifikasion: bizin pou kontrol konformite pandan ou poste. Aplikasion la demann sa apre ou premie pointaz. Tap Permet, apre Permet ankor kan ou telefonn demande.",
              ],
            },
            { kind: 'tip', text: "Si ou finn tap « Pa permet » par erer, aplikasion la montre ou kouma pou relimin li dan paramet ou telefonn. Swiv bann etap, apre tap Reseye." },
          ],
        },
        {
          id: 'language',
          title: 'Sanz lang',
          path: '/dashboard/settings',
          blocks: [
            { kind: 'p', text: "Ouver Paramet e swazir English, Français ouswa Kreol anba Lang. Ou swa anrezistre lor ou kont. Sa gid la egziste an angle, an franse ek an kreol." },
          ],
        },
        {
          id: 'no-card',
          title: 'Mo pa trouv kart pointaz',
          blocks: [
            { kind: 'p', text: "Ou login pa ankor konekte ar ou dosie anplwaye. Demann RH konekte li. Kan zot finn fer li, kart la paret prosenn fwa ou ouver aplikasion la." },
          ],
        },
        {
          id: 'form-drafts',
          title: 'Si enn formiler ferme avan ou avoy li',
          blocks: [
            { kind: 'p', text: "Kan ou ranpli kitsoz nouvo (enn rapor zournalie, enn demann zouti ouswa materyo, enn demann konze, enn dokiman), telefonn la gard seki ou ekrir. Si aplikasion la ouswa formiler la ferme par erer, ouver mem formiler la ankor. Enn mesaz dir « Nou finn remet seki ou ti ekrir » ek ou text retourne." },
            {
              kind: 'list',
              items: [
                'Brouyon la disparet kan ou finn avoy li.',
                'Pou rekoumans ar enn formiler vid, tap Zet brouyon.',
                'Foto ek fisie pa garde. Azout zot ankor.',
                'Brouyon la zis lor sa telefonn la, pou ou login.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'attendance',
      title: 'Pointe lariver ek depar',
      intro: "Pointe ou lariver kan ou ariv lor enn sit e pointe ou depar kan ou ale. Ou telefonn anrezistre ler, ou landrwa ek enn foto.",
      topics: [
        {
          id: 'check-in',
          title: 'Pointe lariver',
          path: '/dashboard',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouver aplikasion la. Kart Mo Prezans anler lor paz Prezans.",
                "Verifie LER LARIVER. Li deza ranpli avek ler aster. Sanz li zis si ou finn ariv pli boner.",
                "Rant TRANSPOR (MUR), ou fre pou ariv laba. Met 0 si pena, e dir kifer dan kaz ki paret.",
                "SIT ek LANDRWA pa obligatwar: kliyan la ouswa batiman la (par egzanp « Celero Level 5 ») ek lavil ouswa rezion la (par egzanp « Ebène »). Si ou ena enn sel travay zordi, zot deza ranpli pou ou.",
                'Tap Pran enn foto e pran enn foto avek kamera devan.',
                'Tap Pointe lariver.',
              ],
            },
            {
              kind: 'list',
              items: [
                "Kart la lerla montre PREZAN ek depi kominn letan ou lor sit.",
                "Ou kapav pointe plizier fwa dan enn zour si ou al lor plis ki enn sit.",
                "Si ou deza pointe, aplikasion la dir ou e li propoz Al pointe depar. Pointe depar sa vizit la avan.",
              ],
            },
            { kind: 'note', text: "Ler aplikasion la se ler ofisiel. Si ou ekrir enn ler ki lwin ar li, ou manazer trouv le de, alor touzour ekrir vre ler la." },
          ],
        },
        {
          id: 'check-out',
          title: 'Pointe depar',
          path: '/dashboard',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Lor kart Mo Prezans, verifie LER DEPAR. Li deza ranpli avek ler aster.",
                "Rant TRANSPOR (MUR) pou retour (0 si pena, avek rezon la).",
                'Azout sit ek landrwa si ou anvi.',
                'Tap Pointe depar.',
              ],
            },
            {
              kind: 'note',
              text: "Ou finn bliye pointe depar? Apre minwi aplikasion la pointe ou depar otomatikman a ler fermtir (17:00, ouswa 13:00 sanmdi) e li avoy ou enn notifikasion. Ler siplemanter sa zour la perdi sof si RH koriz li, alor pointe ou depar ou-mem kan ou ale.",
            },
          ],
        },
        {
          id: 'compliance-check',
          title: 'Kontrol konformite',
          blocks: [
            { kind: 'p', text: "Pandan ou poste, enn notifikasion demann ou konfirm ki ou lor sit. Li vini 2 a 4 fwa par poste, a ler o azar." },
            {
              kind: 'steps',
              items: [
                'Tap notifikasion la. Paz Kontrol konformite ouver.',
                'Tap Konfirm ki ou lor sit. Aplikasion la anrezistre ou landrwa.',
                'Ou trouv « Mersi — anrezistre. »',
              ],
            },
            {
              kind: 'list',
              items: [
                "Ou ena 5 minit. Si ou pa reponn, enn deziem rapel vini apre apepre 2 minit edmi.",
                "Enn repons tro tar montre « Kontrol la finn expire. » Sa konte kouma rate.",
                'De kontrol rate enn deryer lot raporte ar ou manazer.',
                'Sa bann kontrol la pa kapav tengn.',
              ],
            },
          ],
        },
        {
          id: 'location-while-in',
          title: 'Ou landrwa pandan enn poste',
          blocks: [
            { kind: 'p', text: "Pandan ki ou pointe, aplikasion la osi anrezistre ou landrwa sak 15 minit kan li ouver lor ou lekran. Li pa kapav anrezistre nanye kan aplikasion la ferme ouswa ou telefonn blok, e nanye pa anrezistre kan ou pa pointe." },
            { kind: 'p', text: "Ou bann manazer kapav trouv landrwa kot ou finn pointe lariver ek depar, foto la ek sa bann landrwa la." },
          ],
        },
        {
          id: 'reminders',
          title: 'Rapel pou pointe',
          path: '/dashboard',
          blocks: [
            {
              kind: 'list',
              items: [
                "Bouton Rapel mwa lor kart Mo Prezans limin bann rapel: 08:15 si ou pa finn pointe ou lariver, ek 17:15 si ou ankor pointe, lindi ziska sanmdi. Kan zot limen, li dir Rapel aktive.",
                'Tap li pou tengn ouswa relimin bann rapel. Kontrol konformite kontinie vini kanmem.',
                'Avoy enn test avoy enn notifikasion test pou verifie ki ou telefonn resevwar zot.',
                'Si ou ankor pointe apre 14 ler, ou gagn enn rapel « ankor pointe? ».',
              ],
            },
          ],
        },
        {
          id: 'no-signal',
          title: 'Pena rezo',
          blocks: [
            { kind: 'p', text: "Ou kapav pointe lariver, pointe depar ek avoy rapor san rezo. Zot gard lor ou telefonn e zot monte tousel kan rezo retourne. Pa bizin rekomanse." },
            {
              kind: 'list',
              items: [
                "Kan ena kiksoz pe atann, anler lekran la montre « Pe atann pou monte ». Tap li, apre Eseye aster pou avoy li toutswit.",
                "Lor enn iPhone, seki pe atann monte prosenn fwa ou ouver aplikasion la avek rezo.",
                "Ou travay ek ou rapor res vizib san rezo si ou finn ouver zot enn fwa kan ou ti ena rezo.",
              ],
            },
          ],
        },
        {
          id: 'my-attendance',
          title: 'Get ou prezans e telesarz li',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: "Anba kart la, Zordi montre vizit zordi, e Mo prezans montre mwa la: zour, ler, transpor, reta, absans ek ler siplemanter aprouve." },
            {
              kind: 'list',
              items: [
                "Ler travay se lindi ziska vandredi 08:00–17:00 ek sanmdi 08:00–13:00. Ou an reta si ou premie pointaz, dapre ler aplikasion la, apre 08:30.",
                "Ler siplemanter konte depi 17:30 lasemenn ek 13:30 sanmdi. Zot paret isi zis apre ki RH finn aprouv zot.",
                "Enn zour travay san pointaz paret kouma Absan, sof si ou ti an konze aprouve ouswa si RH finn eskiz li.",
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
      id: 'jobs',
      title: 'Ou travay ek ou rapor',
      topics: [
        {
          id: 'my-jobs',
          title: 'Mo Travay Zordi',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: "Mo Travay Zordi, anba kart pointaz, montre bann travay ki finn donn ou zordi. Ankor ouver depi enn lot zour montre bann travay pli vie ki pa ankor fini." },
            {
              kind: 'list',
              items: [
                'Ouver dan Maps montre ladres sit la dan ou aplikasion kart.',
                'Apel kliyan apel kliyan la.',
                'Ar ou montre kisannla ankor lor travay la.',
                'Ouver travay ouver bon travay konple.',
              ],
            },
            { kind: 'tip', text: "Pena travay lor lalis me finn dir ou al kot enn plas? Kontakte ou siperviser." },
          ],
        },
        {
          id: 'job-status',
          title: 'Met enn travay azour',
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouver travay la (Ouver travay, ouswa Technet Operations → Bon travay).',
                'Tap Komans travay kan ou koumanse.',
                "Tap Pe atann pies si ou bizin aret pou pies, ek Rekomans travay kan ou kontinye.",
                'Tap Mark kouma fini kan travay la fini.',
              ],
            },
            { kind: 'note', text: "Stati la parey pou tou dimoun: kan ou mark enn travay fini, li fini pou tou dimoun ki lor li. Zis enn manazer kapav reouver li." },
          ],
        },
        {
          id: 'daily-report',
          title: 'Soumet enn rapor zournalie',
          path: '/dashboard/operations/daily-reports',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouver Technet Operations → Rapor zournalie e tap Soumet rapor zournalie.',
                'Ekrir REZIME seki ou finn fer zordi.',
                "Si ou anvi, azout ou ler, bann teknisien ki ti avek ou ek bann bon travay ki ou finn travay lor la.",
                "Si ou finn soumet enn rapor intervansion zordi pou sa bann travay la, li lor lalis. Tap Met ladan pou kopie li dan ou rezime.",
                'Azout ziska 3 foto avek Azout foto.',
                'Tap Avoy rapor. Ou manazer aprouv ouswa refiz li, e ou gagn enn notifikasion.',
              ],
            },
          ],
        },
        {
          id: 'intervention-report',
          title: 'Soumet enn rapor intervansion',
          path: '/dashboard/operations/intervention-reports',
          blocks: [
            { kind: 'p', text: "Ranpli li zis apre enn vizit lor sit. Koumans li depi Technet Operations → Rapor intervansion → Nouvo intervansion, ouswa depi enn travay avek Soumet rapor." },
            {
              kind: 'steps',
              items: [
                "Kliyan ek kontak: swazir kliyan la, bon travay si ena, ek dimoun pou kontakte.",
                'Lekipman / sistem (pa obligatwar): lekipman, mark, model, nimero seri ek foto.',
                "Pann ek travay ki finn fer: seki finn signale, seki ou finn fer, foto avan ek apre, ek materyo ki finn servi. Pou plizier linite, servi detay par linite.",
                'Teknisien ek ler: kisannla ti la.',
                'Garanti ek rapor: garanti, ou rapor ek ou rekomandasion.',
                "Sinyatir ek fisie: kliyan la sinn lor lekran, e ou kapav azout enn foto fey papie ki finn sinye.",
                'Avoye.',
              ],
            },
            {
              kind: 'list',
              items: [
                "Si aplikasion la ferme avan ou avoye, ou brouyon gard. Foto, fisie ek sinyatir bizin azout ankor.",
                "Si ou manazer refiz rapor la, ouver li, lir so komanter, e tap Correct and Resubmit.",
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
      topics: [
        {
          id: 'request-leave',
          title: 'Demann konze',
          path: '/dashboard/my-leave',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouver Mo Konze dan meni e tap Demann konze.',
                'Swazir tip konze ek dat koumansman ek lafin (ouswa Demi-zourne). Verifie ZOUR KI KONTE.',
                'Azout enn rezon ek remark si ou anvi (par egzanp « Finn gagn sertifika medikal »).',
                'Tap Avoy demann. RH gagn enn notifikasion e ou gagn enn notifikasion kan zot deside.',
              ],
            },
            {
              kind: 'list',
              items: [
                'Mo balans montre kominn zour ou ena ankor pou sak tip.',
                "Tan ki enn demann PE ATANN, ou kapav Modifie li ouswa Retir li. Kan RH finn deside, ou kapav zis retir li.",
              ],
            },
          ],
        },
        {
          id: 'my-documents',
          title: 'Gard ou dokiman',
          path: '/dashboard/my-documents',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouver Mo dokiman e tap Azout enn dokiman.',
                'Donn li enn NOM (par egzanp « Permi kondir ») e swazir KALITE.',
                "Tap pou swazir enn foto ouswa enn PDF (ziska 10MB) e avoye.",
              ],
            },
            { kind: 'p', text: 'Zis ou ek RH trouv sa bann dokiman la. Ou kapav telesarz zot ouswa efas zot ninport kan.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Zouti ek materyo',
      topics: [
        {
          id: 'request-tools',
          title: 'Demann zouti',
          path: '/dashboard/store/requests',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouver Technet Store → Demann zouti e tap Demann zouti.',
                "Ekrir bann zouti ouswa lekipman ki ou bizin, e si ou anvi, tip ouswa mark la, pou ki ete ek pou kan.",
                'Tap Avoy demann. Magazin gagn enn notifikasion, e ou gagn enn notifikasion kan ou zouti pare pou pran.',
              ],
            },
            {
              kind: 'list',
              items: [
                "Tan ki demann la pe atann, ou kapav Modifie li. Ou kapav Efas li tan ki okenn zouti pa finn sorti.",
                "Technet Store → Zouti ek lekipman montre Zouti ki mo ena: sak zouti ki finn done ou ek kan pou remet li. Remet bann zouti ar magazin: se zot ki anrezistre retour la.",
              ],
            },
          ],
        },
        {
          id: 'request-materials',
          title: 'Demann materyo',
          path: '/dashboard/store/materials',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouver Technet Store → Demann materyo e tap Demann materyo.',
                "Pou sak materyo ekrir DESKRIPSION (par egzanp « Lakol silikonn »), referans si ou kone, ek KANTITE. Tap Azout enn lot materyo pou plis lign.",
                "Si ou anvi, dir pou ki ete ek pou kan.",
                'Tap Avoy demann. Ou gagn enn notifikasion kan li pare pou pran.',
              ],
            },
            { kind: 'p', text: 'Technet Store → Materyo montre Materyo ki mo ena: seki finn done ou.' },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'help',
      title: 'Gagn led',
      topics: [
        {
          id: 'support',
          title: 'Kisannla pou demande',
          path: '/dashboard/help',
          blocks: [
            {
              kind: 'list',
              items: [
                "Mo de pas, imel koneksion ouswa enn paz ki ou pa trouve: administrater.",
                'Kart pointaz manke, konze, ler siplemanter ouswa ou PDF prezans: RH.',
                'Travay ek rapor: ou siperviser.',
                "Tou lezot zafer, ouswa si aplikasion la pa marse: apel sipor lor 5885 1000 (nimero la osi dan Sant Led).",
              ],
            },
          ],
        },
      ],
    },
  ],
}
