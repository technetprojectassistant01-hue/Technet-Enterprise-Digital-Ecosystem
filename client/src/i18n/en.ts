/**
 * English — the master dictionary. fr.ts and mfe.ts are typed against this shape (`Dict`), so a
 * key added here fails the build until it's translated in both.
 *
 * Plain strings for fixed text; small functions where a value is inserted, so each language can
 * put it where its word order needs it. The Help Center answers quote on-screen labels — each
 * language quotes its own, so keep them in step when a label changes.
 */
export const en = {
  common: {
    cancel: 'Cancel',
    confirm: 'Confirm',
    areYouSure: 'Are you sure?',
    close: 'Close',
    loading: 'Loading…',
    somethingWentWrong: 'Something went wrong. Please try again.',
  },

  language: {
    label: 'Language',
    settingsHint: "Choose the language for the app. It's saved to your account, so it follows you to any device.",
  },

  roles: {
    ADMIN: 'Admin',
    SALES_OFFICER: 'Sales Officer',
    FINANCE_OFFICER: 'Finance Officer',
    STOREKEEPER: 'Storekeeper',
    HR_OFFICER: 'HR Officer',
    OPERATIONS_MANAGER: 'Operations Manager',
    FIELD_TECHNICIAN: 'Field Technician',
    EMPLOYEE: 'Employee',
  },

  /** Keyed by the English label in dashboard/nav.ts. Technet module names are brand names. */
  nav: {
    Overview: 'Overview',
    'My Leave': 'My Leave',
    'Technet ERP': 'Technet ERP',
    Inventory: 'Inventory',
    Finance: 'Finance',
    Customers: 'Customers',
    Invoices: 'Invoices',
    Expenses: 'Expenses',
    Quotations: 'Quotations',
    'Follow-Up': 'Follow-Up',
    Contracts: 'Contracts',
    Procurement: 'Procurement',
    Suppliers: 'Suppliers',
    Requisitions: 'Requisitions',
    'Purchase Orders': 'Purchase Orders',
    HR: 'HR',
    Employees: 'Employees',
    Leave: 'Leave',
    Certifications: 'Certifications',
    Projects: 'Projects',
    Documents: 'Documents',
    'Technet Maintenance': 'Technet Maintenance',
    Assets: 'Assets',
    Requests: 'Requests',
    Schedule: 'Schedule',
    'Technet Connect': 'Technet Connect',
    'Technet Operations': 'Technet Operations',
    'Work Orders': 'Work Orders',
    'Daily Reports': 'Daily Reports',
    'Intervention Reports': 'Intervention Reports',
    'Team Attendance': 'Team Attendance',
    'Field Operations': 'Field Operations',
    'Technet Workforce': 'Technet Workforce',
    Availability: 'Availability',
    Attendance: 'Attendance',
    Payroll: 'Payroll',
    'Technet Digital Marketing': 'Technet Digital Marketing',
    'Technet Insight': 'Technet Insight',
    Settings: 'Settings',
    Security: 'Security',
    'User Management': 'User Management',
  },

  auth: {
    helpCenter: 'Help Center',
    welcomeBack: 'Welcome Back',
    loginSubtitle: 'Secure access to your engineering portal',
    userIdentifier: 'USER IDENTIFIER',
    accessToken: 'ACCESS TOKEN',
    emailPlaceholder: 'name@company.com',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    rememberSession: 'Remember session',
    forgotPassword: 'Forgot Password?',
    signIn: 'Sign In',
    signingIn: 'Signing in…',
    loginFailed: 'Login failed',
    systemsOperational: 'ALL CORE SYSTEMS OPERATIONAL',
    copyright: '© 2026 Technet Engineering. Digital Kineticism Secured.',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    securityAudit: 'Security Audit',
    contactSupport: 'Contact Support',
    backToSignIn: 'Back to Sign In',
    // Forgot password
    checkInbox: 'Check Your Inbox',
    ifAccountExistsBefore: 'If an account exists for ',
    ifAccountExistsAfter: ', a secure recovery link is on its way.',
    resetYourAccess: 'Reset Your Access',
    resetSubtitle: 'Enter your user identifier to receive a secure recovery token.',
    sendRecovery: 'SEND RECOVERY TOKEN',
    sending: 'SENDING…',
    // Reset password
    invalidLink: 'Invalid Link',
    invalidLinkBody: 'This password reset link is missing its token. Request a new one to continue.',
    requestNewLink: 'Request a New Link',
    passwordUpdated: 'Password Updated',
    passwordUpdatedBody: 'Your password has been reset. You can now sign in with your new password.',
    setNewPassword: 'Set a New Password',
    chooseNewPassword: 'Choose a new password for your account.',
    newPassword: 'NEW PASSWORD',
    confirmPassword: 'CONFIRM PASSWORD',
    atLeast8: 'At least 8 characters',
    reEnterPassword: 'Re-enter your new password',
    updatePassword: 'UPDATE PASSWORD',
    updating: 'UPDATING…',
    passwordTooShort: 'Password must be at least 8 characters',
    passwordsDontMatch: 'Passwords do not match',
  },

  shell: {
    searchPlaceholder: 'Search orders, clients, invoices...',
    moduleSearchPlaceholder: 'Search systems...',
    offlineBanner:
      'Offline — showing your last synced data. Anything you save is kept on this device and uploads automatically when you reconnect.',
    newVersion: 'A new version of Technet Digital is available.',
    reload: 'Reload',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    settings: 'Settings',
    notifications: 'Notifications',
    copyright: '© 2026 Technet Engineering.',
    systemStable: 'SYSTEM STABLE:',
    mainMenu: 'MAIN MENU',
    system: 'SYSTEM',
    newProject: 'New Project',
    helpCenter: 'Help Center',
    logOut: 'Log out',
    all: 'All',
    expand: (section: string) => `Expand ${section}`,
    collapse: (section: string) => `Collapse ${section}`,
    notAvailableForRole: "This module isn't available for your role.",
  },

  sync: {
    offline: 'Offline',
    waiting: (count: number) => `${count} waiting to sync`,
    title: 'Waiting to sync',
    onlineBody:
      'These field entries are saved on this device and will upload on their own. You can also sync them now.',
    offlineBody:
      "You're offline. Anything you save is kept on this device and uploads automatically once you're back online — you don't need to re-enter it.",
    nothingWaiting: 'Nothing waiting.',
    retried: (times: number) => `retried ${times}×`,
    saved: 'saved',
    syncing: 'Syncing…',
    tryNow: 'Try now',
  },

  notifications: {
    title: 'Notifications',
    markAllRead: 'Mark all read',
    empty: 'No notifications yet.',
  },

  settings: {
    title: 'Settings',
    changePassword: 'Change password',
    currentPassword: 'CURRENT PASSWORD',
    newPassword: 'NEW PASSWORD',
    confirmNewPassword: 'CONFIRM NEW PASSWORD',
    updatePassword: 'Update password',
    updating: 'Updating…',
    mismatch: 'New password and confirmation do not match',
    updated: 'Password updated successfully.',
    failed: 'Failed to change password',
  },

  install: {
    title: (app: string) => `Install ${app}`,
    body: 'Install this app for quick access.',
    installNow: 'Install now',
    notNow: 'Not now',
    done: 'Done',
    gotIt: 'Got it',
    howTo: (app: string) => `How to install ${app}`,
    addToHomeScreen: (app: string) => `Add ${app} to your Home Screen`,
    tapShare: 'Tap Share',
    tapMoreThenShare: 'Tap ⋯ then Share',
    tapAddToHomeScreen: 'Tap Add to Home Screen',
    tapAdd: 'Tap Add',
    macSafari: "In Safari's menu bar, choose File → Add to Dock.",
    androidMenu: 'Open the browser menu (⋮) and tap Install.',
    panelTitle: 'Install app',
    alreadyInstalled: "You're using the installed app.",
    panelHint: 'Install Technet Digital on this device for quick access from your home screen.',
    panelButton: 'Install Technet Digital',
    cannotInstall:
      "Either the app is already installed on this device, or this browser can't install apps. Chrome, Edge, Samsung Internet and Safari all can.",
  },

  help: {
    title: 'Help Center',
    subtitle: 'Answers to common questions about Technet Digital.',
    contactTitle: 'Having an issue? Call us.',
    contactBody: 'Tell us what you were doing, which page you were on, and any error message you saw.',
    searchPlaceholder: 'Search help — e.g. password, check in, leave',
    searchLabel: 'Search help',
    noMatchBefore: (query: string) => `No answers match "${query}". Call support on `,
    noMatchAfter: " and we'll help.",
    backToApp: 'Back to app',
    backToSignIn: 'Back to sign in',
    sections: [
      {
        title: 'Signing in',
        faqs: [
          {
            q: 'I forgot my password',
            a: [
              'On the sign-in page, tap "Forgot Password?" and enter your email address. You\'ll receive an email with a link to set a new password.',
              "If the email doesn't arrive after a few minutes (check your spam folder too), call support on 5885 1000.",
            ],
          },
          {
            q: 'How long do I stay signed in?',
            a: [
              'You stay signed in for 30 days, and the 30 days restart every time you use the app — so if you use it regularly you won\'t be asked to sign in again. Tapping "Log out" signs you out straight away.',
            ],
          },
          {
            q: 'How do I change my password?',
            a: ['Tap the gear icon at the top right to open Settings, then use the "Change password" box.'],
          },
        ],
      },
      {
        title: 'Language',
        faqs: [
          {
            q: 'How do I change the language?',
            a: [
              'On the sign-in page, use the language menu at the top. Once signed in, go to Settings (gear icon, top right) → "Language". Your choice is saved to your account, so it follows you to any device.',
            ],
          },
        ],
      },
      {
        title: 'Installing the app',
        faqs: [
          {
            q: 'How do I install the app on my phone?',
            a: [
              'Android (Chrome or Samsung Internet): tap "Install now" when the install pop-up appears, then confirm. The Technet icon is added to your home screen.',
              'iPhone or iPad: open the site in Safari, tap the Share button, then "Add to Home Screen", then "Add". (On newer iPhones, Share is inside the ⋯ button at the bottom right.)',
              'Computer (Chrome or Edge): tap "Install now" on the pop-up.',
            ],
          },
          {
            q: 'I tapped "Not now" on the install pop-up',
            a: ['You can still install it any time from Settings (gear icon, top right) → "Install app".'],
          },
        ],
      },
      {
        title: 'Attendance',
        faqs: [
          {
            q: 'How do I check in and check out?',
            a: [
              'Use the "My Attendance" card on the Overview page. Check the arrival time (it\'s filled in for you), type where you are, enter your transport cost (enter 0 if you had none), then tap "Check In".',
              'When you leave, do the same with "Check Out". You can check in and out several times a day if you visit more than one site.',
            ],
          },
          {
            q: 'Why does the app ask for my location?',
            a: [
              "Each check-in and check-out records your location along with the time, and your managers can see it. Check-in can't work without it.",
              'If you declined the location request by mistake, allow location for this site in your phone or browser settings, then try again.',
            ],
          },
          {
            q: 'I don\'t see the "My Attendance" card',
            a: ['Your login needs to be linked to your employee record. Contact HR and ask them to link your account.'],
          },
          {
            q: 'Can the app remind me to check in?',
            a: [
              'Yes. Tap "Remind me" on the "My Attendance" card and allow notifications. On weekdays you\'ll get a reminder at 8:15 if you haven\'t checked in yet.',
              'On an iPhone, install the app to your home screen first — iPhones only allow reminders from installed apps.',
            ],
          },
        ],
      },
      {
        title: 'Working without signal',
        faqs: [
          {
            q: 'What happens if I lose signal while submitting something?',
            a: [
              "Check-ins, check-outs, daily reports, maintenance reports and intervention reports are saved on your phone and uploaded automatically as soon as the signal comes back. There's no need to submit them again.",
              'While something is waiting, the top bar shows "waiting to sync". Tap it and then "Try now" to retry straight away.',
              'On an iPhone, saved items upload the next time you open the app with signal.',
            ],
          },
          {
            q: 'Can I see my jobs without signal?',
            a: [
              "Yes — your work orders, schedule and reports show the last version your phone loaded while it had signal. Open them once while connected so they're saved on your phone.",
            ],
          },
        ],
      },
      {
        title: 'Leave',
        faqs: [
          {
            q: 'How do I request leave?',
            a: [
              'Open "My Leave" from the menu and tap "Request Leave". HR reviews the request and you\'ll get a notification when it\'s approved or rejected.',
              'While a request is still pending you can withdraw it from the same page.',
            ],
          },
        ],
      },
      {
        title: 'Access',
        faqs: [
          {
            q: "I can't see a page or module I need",
            a: [
              'What you can see depends on your role. If you need access to something, ask your manager or the system administrator.',
            ],
          },
        ],
      },
    ],
  },
}

export type Dict = typeof en
