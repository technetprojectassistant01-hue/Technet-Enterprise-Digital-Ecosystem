import type { Dict } from './en'

/**
 * Mauritian Creole (Kreol Morisien), in the standard Grafi Larmoni spelling. Typed against the
 * English master (en.ts) — every key there must exist here.
 *
 * iPhone/Android menu labels are quoted in English ("Share", "Add to Home Screen"): the phone's
 * own menus aren't in Creole, and English is what most phones here show.
 */
export const mfe: Dict = {
  common: {
    cancel: 'Anile',
    confirm: 'Konfirme',
    areYouSure: 'Ou sir?',
    close: 'Ferme',
    loading: 'Pe sarze…',
    somethingWentWrong: 'Ena enn problem. Silvouple eseye ankor.',
  },

  language: {
    label: 'Lang',
    settingsHint: 'Swazir lang aplikasion la. Li anrezistre lor ou kont, alor li swiv ou lor nenport ki aparey.',
  },

  roles: {
    ADMIN: 'Administrater',
    SALES_OFFICER: 'Ofisie Lavant',
    FINANCE_OFFICER: 'Ofisie Finans',
    STOREKEEPER: 'Magazinie',
    HR_OFFICER: 'Ofisie RH',
    OPERATIONS_MANAGER: 'Manazer Operasion',
    FIELD_TECHNICIAN: 'Teknisien Teren',
    EMPLOYEE: 'Anplwaye',
  },

  nav: {
    Overview: 'Vi zeneral',
    'My Leave': 'Mo Konze',
    'Technet ERP': 'Technet ERP',
    Inventory: 'Inventer',
    Finance: 'Finans',
    Customers: 'Kliyan',
    Invoices: 'Fakir',
    Expenses: 'Depans',
    Quotations: 'Devi',
    'Follow-Up': 'Swivi',
    Contracts: 'Kontra',
    Procurement: 'Lasa',
    Suppliers: 'Fourniser',
    Requisitions: 'Demann lasa',
    'Purchase Orders': 'Bon komand',
    HR: 'RH',
    Employees: 'Anplwaye',
    Leave: 'Konze',
    Certifications: 'Sertifikasion',
    Projects: 'Proze',
    Documents: 'Dokiman',
    'Technet Maintenance': 'Technet Maintenance',
    Assets: 'Lekipman',
    Requests: 'Demann',
    Schedule: 'Planing',
    'Technet Connect': 'Technet Connect',
    'Technet Operations': 'Technet Operations',
    'Work Orders': 'Bon travay',
    'Daily Reports': 'Rapor zournalie',
    'Intervention Reports': 'Rapor intervansion',
    'Team Attendance': 'Prezans lekip',
    'Field Operations': 'Operasion teren',
    'Technet Workforce': 'Technet Workforce',
    Availability: 'Disponibilite',
    Attendance: 'Prezans',
    Payroll: 'Pey',
    'Technet Digital Marketing': 'Technet Digital Marketing',
    'Technet Insight': 'Technet Insight',
    Settings: 'Paramet',
    Security: 'Sekirite',
    'User Management': 'Zestion itilizater',
  },

  auth: {
    helpCenter: 'Sant Led',
    welcomeBack: 'Byenveni ankor',
    loginSubtitle: 'Akse sekirize pou ou portay teknik',
    userIdentifier: 'IDANTIFIAN',
    accessToken: 'MO DE PAS',
    emailPlaceholder: 'non@konpani.com',
    showPassword: 'Montre mo de pas',
    hidePassword: 'Kasiet mo de pas',
    rememberSession: 'Res konekte',
    forgotPassword: 'Ou finn bliye ou mo de pas?',
    signIn: 'Konekte',
    signingIn: 'Pe konekte…',
    loginFailed: 'Koneksion pa finn marse',
    systemsOperational: 'TOU SISTEM PE MARSE',
    copyright: '© 2026 Technet Engineering. Digital Kineticism Secured.',
    privacyPolicy: 'Politik konfidansialite',
    termsOfService: 'Kondision servis',
    securityAudit: 'Odit sekirite',
    contactSupport: 'Kontakte sipor',
    backToSignIn: 'Retourn lor koneksion',
    checkInbox: 'Get ou bwat imel',
    ifAccountExistsBefore: 'Si ena enn kont pou ',
    ifAccountExistsAfter: ', enn lien sekirize pe vini pou ou.',
    resetYourAccess: 'Rekouver ou akse',
    resetSubtitle: 'Rant ou idantifian pou resevwar enn lien sekirize.',
    sendRecovery: 'AVOY LIEN',
    sending: 'PE AVOYE…',
    invalidLink: 'Lien pa valid',
    invalidLinkBody: 'Sa lien la pa konple. Demann enn nouvo lien pou kontinie.',
    requestNewLink: 'Demann enn nouvo lien',
    passwordUpdated: 'Mo de pas finn sanze',
    passwordUpdatedBody: 'Ou mo de pas finn sanze. Aster ou kapav konekte ar ou nouvo mo de pas.',
    setNewPassword: 'Met enn nouvo mo de pas',
    chooseNewPassword: 'Swazir enn nouvo mo de pas pou ou kont.',
    newPassword: 'NOUVO MO DE PAS',
    confirmPassword: 'KONFIRM MO DE PAS',
    atLeast8: 'Omwin 8 karakter',
    reEnterPassword: 'Retap ou nouvo mo de pas',
    updatePassword: 'SANZ MO DE PAS',
    updating: 'PE SANZE…',
    passwordTooShort: 'Mo de pas bizin ena omwin 8 karakter',
    passwordsDontMatch: 'Bann mo de pas pa parey',
  },

  shell: {
    searchPlaceholder: 'Rod komand, kliyan, fakir...',
    moduleSearchPlaceholder: 'Rod...',
    offlineBanner:
      'Pa konekte — ou pe trouv dernie donne ki ti finn sinkronize. Tou seki ou anrezistre res lor sa aparey la e li monte otomatikman kan ou rekonekte.',
    newVersion: 'Ena enn nouvo version Technet Digital.',
    reload: 'Rafresi',
    openMenu: 'Ouver meni',
    closeMenu: 'Ferm meni',
    settings: 'Paramet',
    notifications: 'Notifikasion',
    copyright: '© 2026 Technet Engineering.',
    systemStable: 'SISTEM STAB:',
    mainMenu: 'MENI PRINSIPAL',
    system: 'SISTEM',
    newProject: 'Nouvo proze',
    helpCenter: 'Sant Led',
    logOut: 'Dekonekte',
    all: 'Tou',
    expand: (section: string) => `Ouver ${section}`,
    collapse: (section: string) => `Ferm ${section}`,
    notAvailableForRole: 'Sa modil la pa disponib pou ou rol.',
  },

  sync: {
    offline: 'Pa konekte',
    waiting: (count: number) => `${count} pa ankor monte`,
    title: 'Pe atann pou monte',
    onlineBody:
      'Sa bann antre la finn anrezistre lor sa aparey la e zot pou monte zot-mem. Ou kapav osi fer li aster.',
    offlineBody:
      'Ou pa konekte. Tou seki ou anrezistre res lor sa aparey la e li monte otomatikman kan ou rekonekte — pa bizin retap li.',
    nothingWaiting: 'Nanye pe atann.',
    retried: (times: number) => `finn reseye ${times} fwa`,
    saved: 'anrezistre',
    syncing: 'Pe monte…',
    tryNow: 'Eseye aster',
  },

  notifications: {
    title: 'Notifikasion',
    markAllRead: 'Mark tou kouma lir',
    empty: 'Pena notifikasion ankor.',
  },

  settings: {
    title: 'Paramet',
    changePassword: 'Sanz mo de pas',
    currentPassword: 'MO DE PAS AKTIEL',
    newPassword: 'NOUVO MO DE PAS',
    confirmNewPassword: 'KONFIRM NOUVO MO DE PAS',
    updatePassword: 'Sanz mo de pas',
    updating: 'Pe sanze…',
    mismatch: 'Nouvo mo de pas ek konfirmasion la pa parey',
    updated: 'Mo de pas finn sanze.',
    failed: 'Pa finn kapav sanz mo de pas',
  },

  install: {
    title: (app: string) => `Instal ${app}`,
    body: 'Instal sa aplikasion la pou gagn akse vit.',
    installNow: 'Instal aster',
    notNow: 'Pa aster',
    done: 'Fini',
    gotIt: 'Mo finn konpran',
    howTo: (app: string) => `Kouma pou instal ${app}`,
    addToHomeScreen: (app: string) => `Azout ${app} lor ou lekran dakey`,
    tapShare: 'Tap "Share"',
    tapMoreThenShare: 'Tap ⋯ apre "Share"',
    tapAddToHomeScreen: 'Tap "Add to Home Screen"',
    tapAdd: 'Tap "Add"',
    macSafari: 'Dan meni Safari, swazir "File → Add to Dock".',
    androidMenu: 'Ouver meni navigater la (⋮) e tap "Install".',
    panelTitle: 'Instal aplikasion',
    alreadyInstalled: 'Ou pe servi aplikasion ki finn instale.',
    panelHint: 'Instal Technet Digital lor sa aparey la pou gagn akse vit depi ou lekran dakey.',
    panelButton: 'Instal Technet Digital',
    cannotInstall:
      'Swa aplikasion la deza instale lor sa aparey la, swa sa navigater la pa kapav instal aplikasion. Chrome, Edge, Samsung Internet ek Safari kapav.',
  },

  help: {
    title: 'Sant Led',
    subtitle: 'Repons pou bann kestion ki dimoun demann souvan lor Technet Digital.',
    contactTitle: 'Ena enn problem? Apel nou.',
    contactBody: 'Dir nou ki ou ti pe fer, lor ki paz ou ti ete, ek si ena enn mesaz erer ki ti paret.',
    searchPlaceholder: 'Rod led — egz. mo de pas, pointaz, konze',
    searchLabel: 'Rod led',
    noMatchBefore: (query: string) => `Pena okenn repons pou "${query}". Apel sipor lor `,
    noMatchAfter: ' e nou pou ed ou.',
    backToApp: 'Retourn dan aplikasion',
    backToSignIn: 'Retourn lor koneksion',
    sections: [
      {
        title: 'Konekte',
        faqs: [
          {
            q: 'Mo finn bliye mo mo de pas',
            a: [
              'Lor paz koneksion, tap "Ou finn bliye ou mo de pas?" e rant ou ladres imel. Ou pou resevwar enn imel avek enn lien pou met enn nouvo mo de pas.',
              'Si imel la pa arive apre enn detrwa minit (get dan spam osi), apel sipor lor 5885 1000.',
            ],
          },
          {
            q: 'Konbien letan mo res konekte?',
            a: [
              'Ou res konekte pandan 30 zour, e sa 30 zour la rekomans sak fwa ou servi aplikasion la — alor si ou servi li regilierman, li pa pou demann ou konekte ankor. Tap "Dekonekte" pou dekonekte toutswit.',
            ],
          },
          {
            q: 'Kouma pou sanz mo mo de pas?',
            a: ['Tap ikonn angrenaz ano adrwat pou ouver Paramet, apre servi kare "Sanz mo de pas".'],
          },
        ],
      },
      {
        title: 'Lang',
        faqs: [
          {
            q: 'Kouma pou sanz lang?',
            a: [
              'Lor paz koneksion, servi meni lang anler. Kan ou finn konekte, al dan Paramet (ikonn angrenaz, ano adrwat) → "Lang". Ou swa anrezistre lor ou kont, alor li swiv ou lor nenport ki aparey.',
            ],
          },
        ],
      },
      {
        title: 'Instal aplikasion',
        faqs: [
          {
            q: 'Kouma pou instal aplikasion la lor mo telefonn?',
            a: [
              'Android (Chrome ouswa Samsung Internet): tap "Instal aster" kan fenet instalasion la paret, apre konfirme. Ikonn Technet pou azoute lor ou lekran dakey.',
              'iPhone ouswa iPad: ouver sit la dan Safari, tap bouton "Share", apre "Add to Home Screen", apre "Add". (Lor bann iPhone resan, "Share" dan bouton ⋯ anba adrwat.)',
              'Ordinater (Chrome ouswa Edge): tap "Instal aster" lor fenet la.',
            ],
          },
          {
            q: 'Mo finn tap "Pa aster" lor fenet instalasion la',
            a: ['Ou kapav touzour instal li nenport ki ler depi Paramet (ikonn angrenaz, ano adrwat) → "Instal aplikasion".'],
          },
        ],
      },
      {
        title: 'Prezans',
        faqs: [
          {
            q: 'Kouma pou pointe mo lariver ek mo depar?',
            a: [
              'Servi kart "Mo Prezans" lor paz Vi zeneral. Verifie ler lariver (li deza ranpli pou ou), ekrir kot ou ete, rant ou fre transpor (met 0 si pena), apre tap "Pointe lariver".',
              'Kan ou pe ale, fer parey avek "Pointe depar". Ou kapav pointe plizier fwa dan enn zour si ou al lor plis ki enn sit.',
            ],
          },
          {
            q: 'Kifer aplikasion la demann mo landrwa?',
            a: [
              'Sak lariver ek sak depar anrezistre kot ou ete ansam ek ler la, e ou bann manazer kapav trouv sa. Pointaz pa kapav marse san sa.',
              'Si ou finn refiz landrwa par erer, permet landrwa pou sa sit la dan paramet ou telefonn ouswa ou navigater, apre reseye.',
            ],
          },
          {
            q: 'Mo pa trouv kart "Mo Prezans"',
            a: ['Ou kont bizin konekte ar ou dosie anplwaye. Kontakte RH e demann zot konekte ou kont.'],
          },
          {
            q: 'Eski aplikasion la kapav rapel mwa pou pointe?',
            a: [
              'Wi. Tap "Rapel mwa" lor kart "Mo Prezans" e permet notifikasion. Dan lasemenn ou pou gagn enn rapel a 8h15 si ou pa ankor pointe.',
              'Lor enn iPhone, instal aplikasion la lor ou lekran dakey avan — iPhone permet rapel zis pou bann aplikasion ki instale.',
            ],
          },
        ],
      },
      {
        title: 'Travay san rezo',
        faqs: [
          {
            q: 'Ki arive si mo perdi rezo pandan mo pe avoy kiksoz?',
            a: [
              'Lariver, depar, rapor zournalie, rapor mintenans ek rapor intervansion anrezistre lor ou telefonn e zot monte otomatikman kan rezo retourne. Pa bizin avoy zot ankor.',
              'Kan ena kiksoz pe atann, bar anler montre "pa ankor monte". Tap lor li apre "Eseye aster" pou reseye toutswit.',
              'Lor enn iPhone, bann zafer anrezistre monte prosenn fwa ou ouver aplikasion la avek rezo.',
            ],
          },
          {
            q: 'Eski mo kapav trouv mo travay san rezo?',
            a: [
              'Wi — ou bon travay, ou planing ek ou rapor montre dernie version ki ou telefonn ti sarze kan li ti ena rezo. Ouver zot enn fwa kan ou konekte pou ki zot res lor ou telefonn.',
            ],
          },
        ],
      },
      {
        title: 'Konze',
        faqs: [
          {
            q: 'Kouma pou demann konze?',
            a: [
              'Ouver "Mo Konze" dan meni la e tap "Demann konze". RH pou get ou demann e ou pou gagn enn notifikasion kan li aksepte ouswa refize.',
              'Tan ki enn demann pa ankor desid, ou kapav retir li depi mem paz la.',
            ],
          },
        ],
      },
      {
        title: 'Akse',
        faqs: [
          {
            q: 'Mo pa trouv enn paz ouswa enn modil ki mo bizin',
            a: [
              'Seki ou kapav trouv depann lor ou rol. Si ou bizin akse enn kiksoz, demann ou manazer ouswa administrater sistem la.',
            ],
          },
        ],
      },
    ],
  },
}
