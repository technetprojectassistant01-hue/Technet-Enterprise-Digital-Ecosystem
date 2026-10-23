import type { RoleGuide } from '../types'

/**
 * Gid administrater - Kreol Morisien copy of ../adminGuide.ts (2026-10-21). Same chapters, topics,
 * ids and paths as the English guide; change all three languages together. Button names are the
 * ones the Kreol screen shows (i18n/mfe.ts).
 */
export const ADMIN_GUIDE_MFE: RoleGuide = {
  title: 'Gid administrater',
  intro:
    "Kouma pou fer Technet Digital marse kouma enn administrater: bann login, prezans personel, operasion, RH, magazin ek ERP. Li swiv meni agos, depi anler ziska anba. Responsab Operasion ena exakteman mem akse ki enn administrater, alor sa gid la pou li osi.",
  roles: ['ADMIN', 'OPERATIONS_MANAGER'],
  updated: '2026-10-23',
  chapters: [
    // ------------------------------------------------------------------------------------------
    {
      id: 'getting-started',
      title: 'Pou koumanse',
      topics: [
        {
          id: 'your-role',
          title: 'Ki enn administrater fer',
          blocks: [
            { kind: 'p', text: "Enn administrater prepar ek fer sistem la marse pou tou lezot. Ou kapav ouver tou bann modil, aprouv sa ki lezot avoye ek zer bann login." },
            {
              kind: 'list',
              items: [
                "Ou pa pointe. Ou pena kart pointaz, ni paz Mo Konze ouswa Mo dokiman. Ou paz dakey montre prezans tou lezot olie.",
                "Ou kont pa bizin enn dosie anplwaye. Konekte enn zis si ou osi travay kouma personel e ou bizin paret dan lapey.",
                "Responsab Operasion ena mem akse ki ou, apar enn zafer: zis enn Administrater kapav reinisializ so prop mo de pas par imel.",
              ],
            },
          ],
        },
        {
          id: 'finding-your-way',
          title: 'Kouma pou trouv ou semin',
          blocks: [
            {
              kind: 'list',
              items: [
                "Lor enn ordinater, meni la agos. Klik lor enn modil (par egzanp Technet HR) pou ouver so bann paz.",
                "Lor enn tablet ouswa enn telefonn, tap bouton meni ano agos pou ouver meni la. Lor enn telefonn, ena enn bann rakoursi anba lantet; tap Tou pou trouv meni konple.",
                "Kaz rod dan lantet trouv bann paz par zot nom. Tap enn bout nom la (par egzanp « siplemanter ») e pes Enter.",
                "Dan enn modil, bann tab anler fer ou pas dan enn paz a enn lot.",
                "Sant Led ek Gid Itilizater anba dan meni. Sant Led ena nimero sipor, 5885 1000.",
                "Telesarz PDF, anle dan Gid Itilizater, sov tou gid la dan enn fisie pou gard ouswa enprime. Bann administrater kapav swazir gid nenport ki rol la, par egzanp pou donn enn nouvo anplwaye.",
              ],
            },
          ],
        },
        {
          id: 'notifications',
          title: 'Notifikasion',
          blocks: [
            { kind: 'p', text: "Lakons dan lantet montre sa ki bizin ou atansion: enn teknisien finn pointe so lariver, enn demann konze ouswa enn rapor finn avoye, enn anomali prezans grav finn leve, ek lezot ankor. Klik lor enn notifikasion pou al lor sa dosie la. Mark tou kouma lir met konter la a zero." },
            { kind: 'note', text: "Sa bann notifikasion la paret zis dan aplikasion la. Personn pa gagn imel ouswa SMS pou zot. Zot text ankor an angle pou aster." },
          ],
        },
        {
          id: 'install-language',
          title: 'Instal aplikasion la ek swazir lang',
          path: '/dashboard/settings',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouver Paramet anba dan meni.',
                'Anba Lang, swazir English, Français ouswa Kreol Morisien. Ou swa anrezistre lor ou kont.',
                "Anba Instal aplikasion, klik Instal Technet Digital pou azout li lor ou ordinater ouswa telefonn. Lor enn iPhone ouswa iPad, swiv bann etap ki paret (Share, apre Add to Home Screen).",
              ],
            },
            { kind: 'tip', text: "Ou res konekte pandan 30 zour, e sa 30 zour la rekomans sak fwa ou servi aplikasion la. Dekonekte, anba dan meni, dekonekte ou toutswit." },
          ],
        },
        {
          id: 'slow-first-load',
          title: 'Si enn paz pran letan pou sarze',
          blocks: [
            { kind: 'p', text: "Server la al dormi kan personn pa finn servi aplikasion la depi apepre 15 minit. Premie paz ki ou ouver apre sa kapav pran 30 a 60 segonn. Atann li olie rafresi plizier fwa. Kan li finn leve, tou al vit." },
            { kind: 'p', text: "Kan enn nouvo version aplikasion la sorti, enn bar dir « Ena enn nouvo version Technet Digital. » Klik Rafresi." },
          ],
        },
        {
          id: 'form-drafts',
          title: 'Si enn formiler ferme avan ou sov li',
          blocks: [
            { kind: 'p', text: "Lor bann formiler ki azout kitsoz nouvo (azout enn kliyan, nouvo work order, nouvo kotasion, azout enn anplwaye, demann konze ek lezot), seki ou ekrir reste garde lor sa aparey la amezir ou pe ekrir. Si fenet la, aplikasion la ouswa pop-up la ferme par erer, ouver mem formiler la ankor: enn banier dir « Nou finn remet seki ou ti ekrir » ek ou text retourn dan bann kaz." },
            {
              kind: 'list',
              items: [
                'Brouyon la efase kan dosie la finn sove.',
                'Si ou ferme formiler la san sove, brouyon la reste. Pou rekoumans ar enn formiler vid, klik Zet brouyon lor banier la.',
                'Fisie, foto ek mo de pas zamai garde. Azout zot ankor.',
              ],
            },
            { kind: 'note', text: "Enn brouyon reste zis lor sa aparey ek sa navigater la, zis pou ou login, ziska 30 zour. Li pa swiv ou lor enn lot telefonn ouswa lordinater. Bann formiler ki sanz enn dosie ki deza egziste pa gard brouyon." },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'logins',
      title: 'Login ek sekirite',
      intro: "Se enn administrater ki kre sak login. Personn pa kapav enskrir limem ouswa sanz so prop mo de pas.",
      topics: [
        {
          id: 'add-user',
          title: 'Kre enn login pou enn nouvo dimoun',
          path: '/dashboard/users',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouver Zestion itilizater, anba dan meni.',
                'Klik Azout itilizater.',
                "Rant nom dimoun la, imel ki li pou servi pou konekte, enn mo de pas ek so rol, apre klik Kree itilizater.",
                'Donn dimoun la so imel ek so mo de pas ou-mem.',
                "Si li pou pointe, pran konze ouswa gagn lapey, konekte so login ar so dosie anplwaye (prosenn size).",
              ],
            },
            {
              kind: 'list',
              items: [
                "Teknisien: personel lor teren. Zot pointe, trouv zot travay ek soumet rapor.",
                "Personel biro: mem bann paz personel (prezans, konze, dokiman).",
                "RH: Technet HR, rezis prezans, aprouv konze ek ler siplemanter.",
                "Magazinie: Technet Store, plis Inventer ek Lasa dan ERP.",
                "Ofisie Lavant ek Ofisie Finans: kote kliyan dan ERP. Zot pa pointe, me zot gard Mo Konze ek Mo dokiman.",
                "Responsab Operasion: mem akse ki enn administrater.",
                'Administrater: tou.',
              ],
            },
          ],
        },
        {
          id: 'link-employee',
          title: 'Konekte enn login ar enn dosie anplwaye',
          path: '/dashboard/hr/employees',
          blocks: [
            { kind: 'p', text: "Enn login tousel pa kapav pointe. Kart pointaz, konze, lapey ek dokiman tou pas par dosie anplwaye. Zestion itilizater montre enn banner ki kont bann login san dosie anplwaye, ek enn kolonn Employee Record pou sak login." },
            {
              kind: 'steps',
              items: [
                'Ouver Technet HR → Anplwaye.',
                "Ouver dimoun la (ouswa klik Azout enn anplwaye si li pa ankor la; so kod anplwaye donn otomatikman).",
                'Klik Modifie e swazir so login anba Login konekte.',
                "Anrezistre. Prosenn fwa li ouver aplikasion la, kart pointaz paret.",
              ],
            },
          ],
        },
        {
          id: 'edit-user',
          title: 'Sanz enn nom, enn imel ouswa enn rol, ouswa reinisializ enn mo de pas',
          path: '/dashboard/users',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Ouver Zestion itilizater e trouv dimoun la (servi kaz rod ouswa filtre rol).',
                "Klik Modifie pou sanz so nom, so imel koneksion ouswa so rol, apre Anrezistre sanzman.",
                'Klik Mo de pas pou donn li enn nouvo mo de pas, apre Anrezistre mo de pas. Dir li ki nouvo mo de pas la ete.',
              ],
            },
            { kind: 'tip', text: "Sanz imel enn dimoun isi olie efas so login pou kre enn nouvo. Efas enn login detas li depi so dosie anplwaye e efas so bann notifikasion." },
            { kind: 'note', text: "Si ou bliye ou prop mo de pas, lien « Ou finn bliye ou mo de pas? » lor paz koneksion kapav avoy enn administrater enn lien reinisializasion par imel. Si server la pa ankor ena imel konfigire, paz la dir sa e imel la pa pou ariv. Gard enn deziem login administrater pou ki bann administrater kapav ed zot kamarad." },
          ],
        },
        {
          id: 'security-log',
          title: 'Sekirite ek zournal odit',
          path: '/dashboard/security',
          blocks: [
            {
              kind: 'list',
              items: [
                'Sekirite → Mo kont montre ou prop dernie koneksion.',
                "Sekirite → Rezis odit montre bann levennman sekirite pou tou lantrepriz: koneksion ki finn marse ek ki finn rate, reinisializasion mo de pas, ek login ki finn kre, sanze ouswa efase. Filtre par tip levennman ek par dat.",
              ],
            },
            { kind: 'note', text: "Zournal odit la kouver zis login ek mo de pas. Se pa listwar tou sanzman ki finn fer dan aplikasion la." },
          ],
        },
      ],
    },
    // ------------------------------------------------------------------------------------------
    {
      id: 'attendance',
      title: 'Prezans personel',
      intro: "Bann teknisien pointe zot lariver ek zot depar lor zot telefonn. Sak pointaz anrezistre ler ek landrwa ki zot finn ekrir, ler aplikasion la, enn pozision GPS ek souvan enn foto. Ou paz dakey ek bann ekran Technet Operations montre tou sa.",
      topics: [
        {
          id: 'staff-attendance',
          title: 'Rezis Prezans Personel (ou paz dakey)',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: 'Prezans, premie lartik dan meni, ouver rezis Prezans Personel pou mwa la: enn lign pou sak vizit.' },
            {
              kind: 'list',
              items: [
                "SA KI PERSONEL FINN MET: sa ki dimoun la finn ekrir, so ler ek so landrwa lariver ek depar.",
                "SA KI APLIKASION FINN ANREZISTRE: sa ki aplikasion la finn trouve, so prop ler ek pozision GPS, avek enn lien Kart ek nom landrwa.",
                "Bann siyal montre kan le de pa dakor, par egzanp enn ler ekrir ki lwin ar ler aplikasion la.",
                "Badz akote sak vizit dir Verifie, Pa verifie ouswa Signale. Klik lor Signale pou trouv kifer (get Anomali prezans).",
                "Kolonn ler siplemanter les ou aprouv ouswa refiz ler siplemanter sa zour la direkteman.",
                "Bann fles sanz mwa, e Rezis konple ouver Prezans lekip.",
              ],
            },
            { kind: 'tip', text: "Ler aplikasion la se ler ofisiel. Ler ekrir la gard pou ou kapav konpare, par egzanp enn teknisien ki finn ariv 08:00 me finn ouver aplikasion la 08:20." },
          ],
        },
        {
          id: 'absences',
          title: 'Absans ek eskiz enn zour',
          path: '/dashboard',
          blocks: [
            { kind: 'p', text: "Anba rezis la, Absans montre bann teknisien ki pena okenn pointaz enn zour travay (lindi ziska sanmdi). Dimans, zour ferie ek konze aprouve pa konte. Enn dimoun res absan pou zordi ziska li pointe." },
            {
              kind: 'steps',
              items: [
                'Trouv zour la dan lalis Absans.',
                'Klik Eskize, rant rezon la (par egzanp « Malad, sertifika medikal resevwar ») e anrezistre.',
                'Klik Tir eskiz pou retourn kouma ti ete.',
              ],
            },
            { kind: 'note', text: "Absans pa sanz lapey personn. Lapey pa get zot." },
          ],
        },
        {
          id: 'export-attendance',
          title: 'Telesarz rapor prezans (PDF ouswa Excel)',
          path: '/dashboard',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Lor rezis Prezans Personel, klik Exporte.',
                "Swazir bann dat, ouswa enn swa rapid: Yer (rapor zournalie), Sa mwa-la ouswa Tou bann rezistreman.",
                'Klik Telesarz PDF ouswa Telesarz Excel.',
              ],
            },
            { kind: 'p', text: 'Bann rapor zot-mem an angle, parey kouma pou masinn AiFace. Ladan ena:' },
            {
              kind: 'list',
              items: [
                "Monthly Report: enn lign pou sak dimoun, kouma lor masinn AiFace (Should, Actual, Absence, Late, Leave Early, Holiday, Leave, Overtime, Overtime approved).",
                "Daily Report: bann zour sak dimoun avek In1/Out1 ziska In3/Out3, minit reta ek minit depar boner, ek stati sa zour la.",
                "Overtime Records: ler siplemanter ki RH finn ekrir ar lamin (zis si ena).",
                "Lalis vizit pou verifie avan pey: bann vizit ki finn res ouver plis ki 12 ler, ki souvan vedir enn depar pointe tro tar.",
                "Register: sak vizit, sa ki finn ekrir kont sa ki finn anrezistre, avek landrwa GPS.",
              ],
            },
            { kind: 'tip', text: "Fisie Excel la ena enn fey pou sak parti, ena lantet lantrepriz e li inprime avek nimero paz." },
          ],
        },
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
                "Pointe la minit la montre kisannla prezan aster. Enn vizit ouver depi boukou ler gagn mark « kitfwa finn bliye ».",
                "Rezime prezans se Monthly Report AiFace. Klik lor enn nom pou ouver rapor zournalie sa dimoun la.",
                'Rezis prezans montre sak vizit zour par zour, avek foto pointaz ek bann kontrol konformite.',
                "Exporte mwa / Exporte semenn telesarz rapor Excel, ek Telesarz PDF telesarz PDF la, pou peryod ki lor lekran.",
              ],
            },
          ],
        },
        {
          id: 'close-session',
          title: 'Ferm enn pointaz ki finn bliye',
          path: '/dashboard/operations/team-attendance',
          blocks: [
            { kind: 'p', text: "Enn poste ki ankor ouver apre minwi ferm otomatikman a ler fermtir so prop zour (17:00, ouswa 13:00 sanmdi), e teknisien la gagn enn notifikasion. Ou kapav ferm enn ou-mem pli boner, ouswa koriz ler la." },
            {
              kind: 'steps',
              items: [
                "Dan Prezans lekip, trouv vizit la anba Pointe la minit la.",
                'Klik Ferm sesion.',
                "Met FINN DEPOINTE A lor ler ki li ti vremem ale. Si ou les li lor « aster », tou sa letan la konte kouma ler lor sit.",
                'Azout enn not si ou anvi e konfirme.',
              ],
            },
            { kind: 'note', text: "Okenn pozision pa anrezistre pou enn sesion ki ou ferme, e dosie la montre ki direksion finn ferm li." },
          ],
        },
        {
          id: 'field-ops',
          title: 'Operasion teren ek Kart an direk',
          path: '/dashboard/operations/live-map',
          blocks: [
            {
              kind: 'list',
              items: [
                "Operasion teren montre kisannla pointe aster, kot zot dir zot ete ek depi kominn letan. Demann enn verifikasion avoy zot enn notifikasion pou dir zot ouver aplikasion la. Li pa al rod zot pozision toutswit.",
                "Kart an direk montre tou dimoun ki lor poste: kot zot finn pointe, kot zot finn trouve dernie fwa ek enn lign ant le de. Ver: pre kot pointaz ek trouve resaman. Oranz: pa trouve depi 45 minit ouswa plis, ouswa enn anomali mwayen. Rouz: 500 m ouswa plis depi pointaz, ouswa enn anomali grav. Li rafresi sak 15 segonn.",
                "Anba kart la, PA ANKOR POINTE ZORDI montre bann teknisien ki absan ziska aster.",
              ],
            },
            { kind: 'note', text: "Enn telefonn avoy so pozision zis kan aplikasion la ouver lor lekran. Enn telefonn ki blok ouswa enn aplikasion ki ferme pa avoy nanye, alor « dernie fwa trouve » kapav vie san ki ena okenn problem." },
          ],
        },
        {
          id: 'checks',
          title: 'Kontrol konformite ek pozision anrezistre',
          blocks: [
            {
              kind: 'list',
              items: [
                "Pandan sak poste, aplikasion la avoy 2 a 4 notifikasion a ler o azar pou demann teknisien la konfirm ki li lor sit. Li ena 5 minit pou reponn, e li gagn enn deziem rapel apre apepre 2 minit edmi.",
                "De kontrol rate enn deryer lot (pa reponn, ouswa reponn lwin depi pointaz) leve enn anomali pou ou get.",
                "Pandan ki enn teknisien ena aplikasion la ouver, li osi anrezistre so pozision sak 15 minit.",
                "Enn telefonn ki finn tengn notifikasion paret kouma « Pena aparey anrezistre ». Sa pa konte kouma enn rate.",
              ],
            },
            { kind: 'note', text: "Sa bann kontrol la avoye par enn planifikater deor (cron-job.org). Si kontrol, rapel ouswa nom landrwa aret paret pou tou dimoun, planifikater la kitfwa finn arete: get so istorik exekision avan. Li ti finn arete ant 29 septam ek 12 oktob 2026." },
          ],
        },
        {
          id: 'anomalies',
          title: 'Get bann anomali prezans',
          path: '/dashboard/operations/anomalies',
          blocks: [
            { kind: 'p', text: "Technet Operations → Anomali prezans montre sa ki aplikasion la pa finn kapav verifie: lwin depi travay la, pointe pre kot li reste, deplasman inposib, kitfwa fo GPS, enn ler ouswa landrwa ekrir ki pa koresponn, GPS pa presi, pozision rate ouswa kontrol konformite rate. Sak fis montre enn ti kart ek bann detay." },
            {
              kind: 'steps',
              items: [
                "Filtre par stati, tip, gravite, anplwaye ouswa dat. Bann anomali ouver se lalis pou trete.",
                'Lir fis la e get kart la.',
                "Swazir Konfirm Lezitim (tou ti korek), Marke Fos Alarm (regle la ti tronpe), Konfirm Violasion (ti ena enn vre problem) ouswa Anile. Azout enn not si li itil.",
                'Defer remet enn desizion dan lalis.',
              ],
            },
            {
              kind: 'list',
              items: [
                'Gravite se Elve, Mwayen ouswa Feb. Enn nouvo anomali Elve osi avoy ou enn notifikasion.',
                "Ler siplemanter enn zour ki ena anomali ouver montre enn avertisman avan aprobasion.",
                "RH pa kapav valid mwa enn dimoun tan ki li ena anomali Elve ouver.",
              ],
            },
            { kind: 'note', text: "Enn anomali se enn rezon pou get, pa enn prev ki enn kikenn finn fer enn fot. GPS glise dan batiman, e enn nom landrwa ekrir kouma « Moka » tom dan mitan rezion la, plizier kilomet depi enn vre sit." },
          ],
        },
        {
          id: 'known-places',
          title: 'Plas koni',
          path: '/dashboard/operations/known-places',
          blocks: [
            { kind: 'p', text: "Plas koni se bann sit kot ou bann teknisien vremem travay. Enn pointaz andan enn plas koni paret kouma Verifie. Pena lalis pou ranpli: aplikasion la aprann bann plas depi bann pointaz ki ou konfirme." },
            {
              kind: 'steps',
              items: [
                'Dan Anomali prezans, klik Konfirm Lezitim lor enn pointaz.',
                "Swazir Anrezistre kouma enn nouvo plas koni, donn li enn nom (ek enn kliyan si ou anvi) ek enn reyon (250 m bon pou plipar sit), ouswa swazir plas ki deza egziste ki koresponn.",
                'Konfirme. Lezot pointaz resan dan mem landrwa vinn Verifie osi.',
              ],
            },
            { kind: 'p', text: "Dan Technet Operations → Plas koni, ou kapav sanz nom enn plas, sanz so reyon, met de plas parey ansam (Met ansanm ar…) ouswa efas enn." },
          ],
        },
      ],
    },
    // ------------------------------------------------------------------------------------------
    {
      id: 'operations',
      title: 'Bon travay ek rapor',
      topics: [
        {
          id: 'work-orders',
          title: 'Kre ek donn enn bon travay',
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouver Technet Operations → Bon travay. Kliyan la bizin egziste avan (Technet ERP → Kliyan).",
                'Klik Kre enn nouvo bon travay.',
                "Swazir kliyan la ek kategori travay, rant enn tit, enn deskripsion si bizin ek dat prevwar, e swazir bann teknisien.",
                'Klik Kre bon travay. Nimero la donn otomatikman.',
              ],
            },
            {
              kind: 'list',
              items: [
                "Sak teknisien ki finn gagn travay la resevwar enn notifikasion, e travay la paret anba Mo Travay Zordi lor so telefonn zour ki finn prevwar. Bann travay ki ankor ouver depi lezot zour res lor lalis ziska zot fini.",
                "Kan enn teknisien ena exakteman enn sel travay sa zour la, form pointaz ranpli so sit e konekte pointaz la ar li.",
                "Pou koriz enn erer, servi aksion modifikasion dan lalis bon travay: kliyan, kategori, tit, deskripsion, dat ek teknisien kapav tou sanze.",
              ],
            },
          ],
        },
        {
          id: 'work-order-detail',
          title: 'Stati enn bon travay ek landrwa sit',
          path: '/dashboard/operations/work-orders',
          blocks: [
            {
              kind: 'list',
              items: [
                "Ouver enn bon travay pou fer li avanse: Komans travay, Pe atann pies, Rekomans travay, Mark kouma fini, ek Reouver si bizin. Stati la parey pou tou dimoun ki lor travay la.",
                "Met landrwa sit: tap enn rezion, enn lari ouswa enn lavil (par egzanp « Ebene, Mauritius »), pa enn nom lantrepriz, apre anrezistre. Sit la lerla paret kouma enn lien kart e li servi pou konpar bann pointaz ar travay la.",
                "Paz la osi montre bann pointaz lor sit ek bann rapor intervansion pou travay la.",
              ],
            },
            { kind: 'note', text: "Rod ladres servi done gratis OpenStreetMap. Nom lantrepriz ek nimero letaz rarman trouve. Servi lavil ouswa lari." },
          ],
        },
        {
          id: 'daily-reports',
          title: 'Rapor zournalie',
          path: '/dashboard/operations/daily-reports',
          blocks: [
            { kind: 'p', text: "Bann teknisien soumet enn rapor zournalie avek enn rezime, zot ler si zot anvi, bann bon travay ki zot finn touse ek ziska 3 foto. Bann nouvo rapor paret PE ATANN VERIFIKASION." },
            {
              kind: 'steps',
              items: [
                'Ouver Technet Operations → Rapor zournalie. Filtre par dat ouswa rod dan text la.',
                'Lir rapor la ek so bann foto.',
                'Aprouv li, ouswa refiz li. Teknisien la gagn enn notifikasion dan tou le de ka.',
              ],
            },
          ],
        },
        {
          id: 'intervention-reports',
          title: 'Rapor intervansion',
          path: '/dashboard/operations/intervention-reports',
          blocks: [
            { kind: 'p', text: "Enn rapor intervansion se fis travay pou enn vizit lor sit: kliyan ek kontak, lekipman, pann ek travay ki finn fer, foto avan ek apre, materyo ki finn servi, rapor teknisien la ek sinyatir kliyan la." },
            {
              kind: 'list',
              items: [
                "Filtre par kliyan, stati, tip travay ek dat, ouswa servi bouton 3, 6 ek 12 mwa pou trouv vit listwar enn kliyan pandan ki ou lor telefonn.",
                "Pou refiz enn rapor, ou bizin ekrir enn komanter. Teknisien la trouv li e li kapav servi Correct and Resubmit.",
                "Lor enn rapor, ou kapav konekte enn bon travay, ek met enn rapel swivi. Rapor la lerla paret anba RAPEL POU FER kan dat la finn pase. Okenn imel ni SMS pa avoye.",
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
      intro: 'Tou seki konsern dimoun: dosie anplwaye, konze, ler siplemanter, validasion lafin mwa, lapey, sertifikasion ek disponibilite.',
      topics: [
        {
          id: 'hr-overview',
          title: 'Vi zeneral RH',
          path: '/dashboard/hr',
          blocks: [
            { kind: 'p', text: "Vi zeneral Technet HR montre sa ki bizin enn aksion: kantite anplwaye aktif, kisannla an konze zordi, bann konze ki pe atann aprobasion, ler siplemanter ki pe atann sa mwa la, prezans mwa pase ki bizin valide ek bann sertifikasion ki pou expire dan 60 prosenn zour." },
          ],
        },
        {
          id: 'employees',
          title: 'Dosie anplwaye',
          path: '/dashboard/hr/employees',
          blocks: [
            {
              kind: 'list',
              items: [
                'Azout enn anplwaye kre enn dosie. Kod anplwaye donn otomatikman.',
                "Ouver enn anplwaye pou sanz so detay, konekte so login, met enn saler de baz pou lapey ek trouv so bann sertifikasion.",
                "Kot li reste (RH zis): ladres so lakaz. Enn pointaz mwins ki 300 m depi la leve enn anomali « pointe pre kot li reste », sof si li ena enn travay pre kot li sa zour la. Ladres la zame montre personn deor RH.",
                "Dokiman personel: bann dokiman ki anplwaye la finn azoute limem (kart idantite, permi, sertifika). Ou kapav get zot ek telesarz zot.",
              ],
            },
          ],
        },
        {
          id: 'leave-approvals',
          title: 'Aprouv konze',
          path: '/dashboard/leave-approvals',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouver Aprouv konze dan meni. Pe atann aprobasion montre bann demann ki pe atann enn desizion.",
                "Aprouv ouswa refiz sakenn. Si dimoun la pena ase balans, ou gagn enn avertisman e ou kapav klik Aprouve kanmem.",
                "Tab Aprouve montre bann konze aprouve. Ou kapav sanz zot, ouswa anil zot pou remet bann zour dan balans.",
              ],
            },
            { kind: 'tip', text: "Technet HR → Konze montre tou bann demann, ninport ki stati, e les ou Anrezistre konze pou enn kikenn." },
          ],
        },
        {
          id: 'leave-setup',
          title: 'Tip konze, balans ek zour ferie',
          path: '/dashboard/hr/leave',
          blocks: [
            {
              kind: 'list',
              items: [
                "Tip konze: klik Servi bann default Moris pou koumanse, ouswa Azout tip konze. Sak tip ena enn kod, enn kantite zour par lane, e li dir si li peye ek si bizin dokiman. Kan enn tip finn servi, dezaktiv li (tir tik Aktif) olie efas li.",
                "Balans: klik Zener balans (avek lane la, par egzanp Zener balans 2026) pou kre drwa sakenn, apre azist zour drwa ouswa zour ki finn reporte enn dimoun si bizin. Zour ki finn pran sanze zis kan enn konze aprouve ouswa anile.",
                "Zour ferie: azout zour ferie lane la. Zot pa konte dan zour travay konze ek lapey, dan absans ek dan rapor. Bann fet liner ki ena « (unconfirmed) » se estimasion: koriz dat la kan li anonse.",
              ],
            },
          ],
        },
        {
          id: 'overtime',
          title: 'Aprouv ler siplemanter',
          path: '/dashboard/hr/overtime',
          blocks: [
            { kind: 'p', text: "Ler siplemanter kalkile depi bann pointaz: depi 17:30 lasemenn ek 13:30 sanmdi, ziska ler depar ki teknisien la finn ekrir lor so dernie vizit sa zour la. Tou travay enn dimans konte. Sak zour res pe atann ziska li aprouve ouswa refize, e zis ler siplemanter aprouve konte." },
            {
              kind: 'steps',
              items: [
                'Ouver Technet HR → Ler siplemanter. Bann zour ki pe atann paret premie. Bann fles sanz mwa.',
                "Get bann avertisman: anomali sa zour la, ouswa enn vizit ki finn res ouver plis ki 12 ler (enn depar pointe tro tar fer ler siplemanter paret pli gro).",
                "Klik Aprouve, ouswa Refize avek enn rezon si ou anvi. Teknisien la gagn enn notifikasion.",
                'Defer remet enn zour ki finn deside dan pe atann.',
              ],
            },
            { kind: 'tip', text: "Problem dan done prezans, anba paz la, montre bann dosie ki paret fos lor tou peryod (enn depar avan lariver, sesion ki tom lor zot kamarad, plis ki 12 ler siplemanter dan enn zour). Nanye pa sanze otomatikman." },
          ],
        },
        {
          id: 'overtime-records',
          title: 'Ekrir ler siplemanter ar lamin',
          path: '/dashboard/hr/overtime',
          blocks: [
            { kind: 'p', text: "Parey kouma Overtime Records dan lozisiel AiFace, ou kapav ekrir ler siplemanter ou-mem, par egzanp enn travay aswar ouswa enn zour kot sif aplikasion la fos. Enn rezistreman ranplas ler ki aplikasion la finn kalkile pou sa dimoun la ek sa zour la, li konte kouma aprouve e li montre ou kouma dimoun ki finn aprouv li." },
            {
              kind: 'steps',
              items: [
                "Dan Technet HR → Ler siplemanter, klik Azout ler siplemanter. Ouswa, lor enn zour ki pe atann, klik Ekrir olie pou ranplas sif kalkile sa zour la.",
                "Swazir anplwaye la ek dat la, tip la (Normal, Zour repo ouswa Zour ferie), ler koumansman ek lafin ek enn rezon. Enn ler lafin pli boner ki koumansman konte kouma lander-mo-zour.",
                'Klik Anrezistre. Anplwaye la gagn enn notifikasion.',
              ],
            },
            {
              kind: 'list',
              items: [
                "Bann rezistreman ena enn badz Ekrir ar lamin. Swazir Ekrir ar lamin dan filtre stati pou trouv zis zot.",
                "Modifie sanz enn rezistreman. Efas anrezistreman tir li, e zour la retourn ar so ler kalkile, pe atann.",
                'Bann rezistreman paret dan zot prop parti Overtime Records dan rapor PDF ek Excel.',
              ],
            },
          ],
        },
        {
          id: 'validations',
          title: 'Valid prezans enn mwa',
          path: '/dashboard/hr/validations',
          blocks: [
            { kind: 'p', text: "Lafin sak mwa, RH konfirm prezans sak anplwaye. Ziska sa, PDF prezans ki enn teknisien telesarze ena mark DRAFT." },
            {
              kind: 'steps',
              items: [
                "Ouver Technet HR → Validasion. Li ouver lor mwa pase. Enn mwa kapav valide depi so dernie zour.",
                "Ouver PDF enn dimoun pou verifie, apre klik Valide, ouswa Valid tou pou tou dimoun.",
                'Defer tir enn validasion.',
              ],
            },
            {
              kind: 'list',
              items: [
                "Enn dimoun ki ena anomali Elve ouver pa kapav valide avan ki zot finn gete. Valid tou sot li e dir kominn dimoun finn sote.",
                "Si enn vizit ouswa ler siplemanter aprouve sanze apre validasion, lign la montre « Finn sanze depi validasion » e PDF la retourn DRAFT. Valid li ankor.",
              ],
            },
          ],
        },
        {
          id: 'payroll',
          title: 'Lapey',
          path: '/dashboard/hr/payroll',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Asir ou ki sak anplwaye ki bizin gagn lapey ena enn saler de baz lor so dosie.',
                "Ouver Technet HR → Lapey, swazir mwa ek lane e klik Tret lapey.",
                "Ouver tretman la pou trouv, pou sak dimoun, saler de baz, ler, ler siplemanter, konze san pey, dediksion ek net pou peye.",
              ],
            },
            {
              kind: 'note',
              text: "Net pou peye se saler de baz mwins enn dediksion pou konze san pey ki finn aprouve. Ler (depi pointaz) ek ler siplemanter aprouve paret me zot pa peye, parski pena okenn tarif ler siplemanter ki finn fixe. Anplwaye san saler de baz pa ladan. Depar ki finn bliye fer ler paret pli gro.",
            },
          ],
        },
        {
          id: 'certifications',
          title: 'Sertifikasion ek formasion',
          path: '/dashboard/hr/certifications',
          blocks: [
            { kind: 'p', text: "Technet HR → Sertifikasion montre sertifikasion sak dimoun avek zot dat expirasion, ek zot formasion. Servi Azout enn sertifikasion ouswa Anrezistre enn formasion. Bann sertifikasion ki pou expire dan 60 prosenn zour paret dan Vi zeneral RH." },
          ],
        },
        {
          id: 'availability',
          title: 'Disponibilite',
          path: '/dashboard/hr/availability',
          blocks: [
            { kind: 'p', text: 'Technet HR → Disponibilite met dimoun, pou enn zour, dan Disponib, An konze ek Absan.' },
            { kind: 'note', text: "Disponibilite lir konze aprouve ek ansien rezis manyel biro, pa bann pointaz. Ninport ki dimoun ki pa dan sa rezis la paret kouma Disponib. Pou kone kisannla vremem lor teren, servi Operasion teren ouswa Kart an direk." },
          ],
        },
      ],
    },
    // ------------------------------------------------------------------------------------------
    {
      id: 'store',
      title: 'Technet Store',
      intro: "Zouti ek lekipman swivi enn par enn. Materyo kouma lakol, tep ouswa vis swivi par kantite. Administrater ek Magazinie zer magazin la. Ninport ki dimoun ki ena enn dosie anplwaye kapav fer demann.",
      topics: [
        {
          id: 'tools',
          title: 'Zouti ek lekipman',
          path: '/dashboard/store/tools',
          blocks: [
            {
              kind: 'list',
              items: [
                "Azout enn zouti anrezistre enn zouti. Enn nimero etiket (TL-0001, TL-0002…) donn otomatikman: ekrir li lor zouti la.",
                "Rezis la montre stati sak zouti (Disponib, Finn sorti, Pe repare, Pa servi ankor), kisannla ena li ek kan li bizin retourne. Zouti ki an reta gagn enn mark.",
                "Marke retourne anrezistre enn retour ek so leta. Enn zouti ki retourn Abime al dan Pe repare ziska ou remet li Disponib.",
                "Listwar montre sak fwa enn zouti finn sorti. Enn zouti ki finn deza sorti pa kapav efase: met li Pa servi ankor olie.",
              ],
            },
          ],
        },
        {
          id: 'tool-requests',
          title: 'Demann zouti',
          path: '/dashboard/store/requests',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Ouver Technet Store → Demann zouti. Bann demann Pe atann pe atann magazin.",
                "Klik Sorti, tik bann zouti disponib ki ou pe done, met enn dat retour si ou anvi e konfirme. Ouswa klik Refize avek enn rezon si ou anvi.",
                "Dimoun ki finn demande gagn enn notifikasion, e bann zouti paret anba Zouti ki mo ena lor so lekran.",
              ],
            },
          ],
        },
        {
          id: 'materials',
          title: 'Materyo ek demann materyo',
          path: '/dashboard/store/stock',
          blocks: [
            {
              kind: 'list',
              items: [
                "Materyo: Azout materyo avek enn nom, enn linite (tib, roulo, bwat…), stok depar ek enn stok minimom. Kan li ariv minimom ouswa anba, li paret Ba.",
                "Stok sanze zis par Azout stok (enn livrezon), Koriz stok (apre enn kont) ek kan ou done enn demann. Listwar montre sak sanzman ek kisannla finn fer li.",
                "Demann materyo: klik Done, asosie sak lign ar enn materyo dan stok e met kantite la. Tou sorti dan stok enn sel kou. Servi « Pa depi stok » pou seki finn aste spesialman. Li refize si ena kiksoz ki manke.",
              ],
            },
            { kind: 'note', text: "Materyo magazin separe ar Inventer ERP. Zot pa konekte." },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'erp',
      title: 'Technet ERP',
      intro: "Kliyan ek devi, lasa, inventer, proze ek dokiman. Faktir ek depans gard dan QuickBooks, pa dan sa aplikasion la.",
      topics: [
        {
          id: 'customers',
          title: 'Kliyan ek zot akse portal',
          path: '/dashboard/erp/customers',
          blocks: [
            {
              kind: 'list',
              items: [
                "Technet ERP → Kliyan → Azout enn kliyan kre enn kliyan (nom, lantrepriz, kontak, BRN, nimero TVA, ladres).",
                "Akse portal donn enn kliyan so prop login lor Technet Connect, kot li trouv so devi ek kot so travay ete, e li kapav demann enn devi. Klik ikonn lakle (Donn akse portal), rant so imel, klik Donn akse e donn li mo de pas ki paret. Ou kapav reinisializ ouswa tir li pli tar.",
              ],
            },
          ],
        },
        {
          id: 'quote-requests',
          title: 'Call Log (demann devi)',
          path: '/dashboard/erp/customers/quotations',
          blocks: [
            { kind: 'p', text: "Tab Call Log lor paz Devi ena bann demann devi: sa ki enn kliyan finn avoye depi portal, ek sa ki personel finn ekrir apre enn apel ouswa enn imel." },
            {
              kind: 'steps',
              items: [
                "Klik Anrezistre enn demann e met kliyan la (ouswa nom enn lantrepriz si li nouvo) ek seki li pe demande.",
                "Azout enn not stati pou lezot trouv kifer li ankor pe atann (par egzanp « pe atann pri fourniser »).",
                "Avoy enn akize resepsion: klik Akize resepsion, sanz imel la, apre Anrezistre brouyon ouswa Avoye. Avoye ouver ou progranm imel avek text la deza ranpli (imel la limem an angle, parey kouma devi la).",
                'Konverti fer demann la vinn enn devi brouyon, ouswa Refize ferm li.',
              ],
            },
            { kind: 'note', text: "Enn demann ki pa finn gagn akize resepsion, ki pa finn konverti ouswa refize dan 24 ler gagn mark AN RETAR." },
          ],
        },
        {
          id: 'quotations',
          title: 'Devi',
          path: '/dashboard/erp/customers/quotations',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Klik Nouvo devi. Swazir kliyan la, rant tit la ek dimoun pou kontakte, e azout bann lign (bouton + Labor ek + Transport azout sa bann lign ki servi souvan, an angle kouma res devi la).",
                "Met kondision peyman (bann lign bizin fer 100% total), validite an zour (15 par default) ek disponibilite.",
                "Anrezistre. Nimero devi la donn otomatikman e li koumans kouma brouyon.",
                "Ouver li pou verifie, apre Telesarz PDF, ouswa Avoy kliyan.",
                "Servi Mark kouma avoye kan finn avoy li, apre Mark aprouve, Mark pa aprouve ouswa Mark expire.",
              ],
            },
            {
              kind: 'list',
              items: [
                "Kliyan, kondision ek bann lign kapav sanze zis tan ki devi la enn brouyon.",
                "Swivi lor devi la anrezistre sak apel: dat, kisannla ou finn koze ek rezilta. Ekrir osi bon komand ouswa referans konfirmasion kliyan la la.",
                'Fisie atase ena bann fisie ki konekte ar devi la.',
                "Zis enn administrater kapav azout enn nouvo nom kondision peyman. Lezot swazir parmi bann nom ki deza servi.",
              ],
            },
            { kind: 'note', text: "Avoy kliyan telesarz PDF la e ouver enn imel avek text la pare. Enn navigater pa kapav atas fisie la pou ou, alor atas PDF ki finn telesarze ou-mem avan avoye." },
          ],
        },
        {
          id: 'follow-up-contracts',
          title: 'Swivi ek kontra',
          path: '/dashboard/erp/customers/follow-up',
          blocks: [
            {
              kind: 'list',
              items: [
                'Swivi montre bann apel ki finn anrezistre lor devi, par kliyan ouswa par dat.',
                "Kontra: Nouvo kontra anrezistre enn kontra servis avek enn kliyan, so valer ek so dat koumansman ek lafin.",
              ],
            },
          ],
        },
        {
          id: 'procurement',
          title: 'Lasa: demann lasa ek bon komand',
          path: '/dashboard/erp/procurement/requisitions',
          blocks: [
            {
              kind: 'steps',
              items: [
                "Fourniser: Azout enn fourniser avek kontak ek kondision peyman (par egzanp « Net 30 »).",
                "Demann lasa: Nouvo demann lasa montre seki bizin. Ouver li pou Aprouv li ouswa Refiz li.",
                "Enn demann aprouve kapav konverti: Konverti an bon komand, avek fourniser ek pri inite.",
                "Bon komand: ouver bon la e klik Avoy ar fourniser kan finn avoy li.",
                "Kan marsandiz ariv, klik Anrezistre enn resepsion e rant kantite ki finn resevwar. Bann lartik ki konekte ar inventer azoute dan stok otomatikman. Bon la paret enn parti ouswa tou resevwar.",
                'Kan tou finn ariv, klik Ferm komand.',
              ],
            },
            { kind: 'tip', text: "Anile aret enn bon ki ankor brouyon, ouswa ki finn avoye me ki nanye pa ankor ariv." },
          ],
        },
        {
          id: 'inventory-projects-docs',
          title: 'Inventer, proze ek dokiman',
          blocks: [
            {
              kind: 'list',
              items: [
                "Inventer: Azout enn lartik, apre bouton Azist stok (bann fles) pou bann mouvman. Rezis stok montre zot. Stok ba siyale kan li ariv nivo minimom.",
                'Proze: Nouvo proze avek kliyan, responsab, dat ek bidze.',
                "Dokiman: Azout enn dokiman gard enn fisie dan enn kategori (kontra, RH, proze, devi…) e kapav konekte li ar enn kliyan ouswa enn proze.",
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'other-modules',
      title: 'Connect, Marketing ek Insight',
      topics: [
        {
          id: 'connect',
          title: 'Technet Connect (portal kliyan)',
          path: '/dashboard/connect',
          blocks: [
            { kind: 'p', text: "Bann kliyan ki ou donn akse konekte lor portal kliyan e trouv zot prop devi ek kot zot travay ete, e zot kapav demann enn devi. Brouyon, done GPS ek nom teknisien zame montre zot. Zot demann devi ariv dan Call Log." },
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
                "Kanpagn: Azout enn kanpagn, apre ouver li e klik Azout enn piblikasion pou sak piblikasion (tit, platform, text, dat).",
                'Kalandrie kontni montre tou piblikasion prevwar dan tou kanpagn, avek filtre.',
                'Apre ki ou finn poste lor rezo sosial la ou-mem, klik Marke piblie isi.',
              ],
            },
            { kind: 'note', text: "Aplikasion la pa poste lor rezo sosial e li pa ekrir piblikasion pou ou. Se enn lalis planifikasion." },
          ],
        },
        {
          id: 'insight',
          title: 'Technet Insight',
          path: '/dashboard/insight',
          blocks: [
            { kind: 'p', text: "Technet Insight, zis pou administrater, montre lantrepriz dan enn koudey: proze aktif, bon travay aktif, lartik stok ba, demann zouti ki pe atann ek teknisien lor sit." },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------------------------------
    {
      id: 'automatic',
      title: 'Seki aplikasion la fer tousel',
      topics: [
        {
          id: 'automatic-list',
          title: 'Rapel ek netwayaz otomatik',
          blocks: [
            {
              kind: 'list',
              items: [
                "08:15 ek 17:15, lindi ziska sanmdi: enn rapel pou bann teknisien ki pa finn pointe zot lariver, ouswa ki ankor pointe. Sakenn kapav tengn zot. Kontrol konformite pa kapav tengn.",
                'Apre 14 ler pointe: enn rapel « ankor pointe? ».',
                "Apre minwi: enn poste ki ankor ouver ferm otomatikman a ler fermtir so zour.",
                'Foto pointaz efase otomatikman apre 90 zour.',
                "Kan enn teknisien pointe so depar avek ler siplemanter, RH gagn enn notifikasion ki bizin aprouv li.",
              ],
            },
            { kind: 'note', text: "Rapel, kontrol konformite ek nom landrwa depann lor planifikater cron-job.org. Si zot tou aret, get so istorik exekision." },
          ],
        },
      ],
    },
  ],
}
