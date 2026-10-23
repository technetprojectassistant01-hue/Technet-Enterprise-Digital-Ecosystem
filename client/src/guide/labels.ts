import type { Language } from '../lib/api'

/**
 * The User Guide page's own labels. Kept beside the guide text rather than in the i18n
 * dictionaries because they follow the same rule as the guides: a language without guides shows
 * the English guide with English labels, never a mix.
 */
export interface GuideLabels {
  pageTitle: string
  contents: string
  searchPlaceholder: string
  searchAria: string
  openPage: string
  /** "Last checked against the app on {date}." */
  lastChecked: (date: string) => string
  noGuide: string
  openHelp: string
  /** Before and after the Help Center link, for "Nothing in the guide matches …". */
  noMatch: (query: string) => string
  noMatchHelp: string
  /** The "last checked" date, e.g. "20 October 2026". */
  formatDate: (date: Date) => string
  /** The Download PDF button and its menu (2026-10-23). */
  downloadPdf: string
  preparingPdf: string
  downloadFailed: string
  /** Heading of the administrator's menu of every role's guide. */
  chooseGuide: string
  /** After the signed-in person's own guide in that menu. */
  yours: string
  /** The PDF's page footer; {n} and {total} are filled in by the server. */
  pdfPage: string
}

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
const MFE_MONTHS = ['zanvie', 'fevrie', 'mars', 'avril', 'me', 'zin', 'zilyet', 'out', 'septam', 'oktob', 'novam', 'desam']

const EN: GuideLabels = {
  pageTitle: 'User Guide',
  contents: 'Contents',
  searchPlaceholder: 'Search the guide — e.g. overtime, password, quotation',
  searchAria: 'Search the guide',
  openPage: 'Open this page',
  lastChecked: (date) => `Last checked against the app on ${date}.`,
  noGuide: 'The guide for your role is still being written. In the meantime, the Help Center answers common questions.',
  openHelp: 'Open the Help Center',
  noMatch: (query) => `Nothing in the guide matches "${query}". Try another word, or look in the `,
  noMatchHelp: 'Help Center',
  formatDate: (date) => date.toLocaleDateString('en-GB', LONG_DATE),
  downloadPdf: 'Download PDF',
  preparingPdf: 'Preparing PDF…',
  downloadFailed: 'The PDF could not be downloaded. Check your connection and try again.',
  chooseGuide: 'Which guide?',
  yours: '(yours)',
  pdfPage: 'Page {n} of {total}',
}

const FR: GuideLabels = {
  pageTitle: "Guide d'utilisation",
  contents: 'Sommaire',
  searchPlaceholder: 'Rechercher dans le guide — ex. heures sup., mot de passe, devis',
  searchAria: 'Rechercher dans le guide',
  openPage: 'Ouvrir cette page',
  lastChecked: (date) => `Vérifié dans l'application le ${date}.`,
  noGuide: "Le guide de votre rôle est en cours de rédaction. En attendant, le Centre d'aide répond aux questions courantes.",
  openHelp: "Ouvrir le Centre d'aide",
  noMatch: (query) => `Rien dans le guide ne correspond à « ${query} ». Essayez un autre mot, ou consultez le `,
  noMatchHelp: "Centre d'aide",
  formatDate: (date) => date.toLocaleDateString('fr-FR', LONG_DATE),
  downloadPdf: 'Télécharger le PDF',
  preparingPdf: 'Préparation du PDF…',
  downloadFailed: "Le PDF n'a pas pu être téléchargé. Vérifiez votre connexion et réessayez.",
  chooseGuide: 'Quel guide ?',
  yours: '(le vôtre)',
  pdfPage: 'Page {n} sur {total}',
}

const MFE: GuideLabels = {
  pageTitle: 'Gid Itilizater',
  contents: 'Sommer',
  searchPlaceholder: 'Rod dan gid la — egz. ler siplemanter, mo de pas, devi',
  searchAria: 'Rod dan gid la',
  openPage: 'Ouver sa paz la',
  lastChecked: (date) => `Finn verifie dan aplikasion la le ${date}.`,
  noGuide: 'Gid pou ou rol pe ekrir ankor. Antan, Sant Led reponn bann kestion ki dimoun demann souvan.',
  openHelp: 'Ouver Sant Led',
  noMatch: (query) => `Nanye dan gid la pa koresponn ar « ${query} ». Eseye enn lot mo, ouswa get dan `,
  noMatchHelp: 'Sant Led',
  // Browsers have no Kreol month names, so they are written out here.
  formatDate: (date) => `${date.getDate()} ${MFE_MONTHS[date.getMonth()]} ${date.getFullYear()}`,
  downloadPdf: 'Telesarz PDF',
  preparingPdf: 'Pe prepar PDF la…',
  downloadFailed: 'PDF la pa finn kapav telesarze. Verifie ou koneksion ek reeseye.',
  chooseGuide: 'Ki gid?',
  yours: '(pou ou)',
  pdfPage: 'Paz {n} lor {total}',
}

export const GUIDE_LABELS: Record<Language, GuideLabels> = { en: EN, fr: FR, mfe: MFE }
