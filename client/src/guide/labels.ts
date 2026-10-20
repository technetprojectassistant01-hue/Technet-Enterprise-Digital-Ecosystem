import type { Language } from '../lib/api'

/**
 * The User Guide page's own labels. Kept beside the guide text rather than in the i18n
 * dictionaries because they follow the same rule as the guides: a language without a guide yet
 * (Kreol, until it is written) shows the English guide with English labels, not a mix.
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
  /** BCP 47 locale for the "last checked" date. */
  locale: string
}

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
  locale: 'en-GB',
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
  locale: 'fr-FR',
}

export const GUIDE_LABELS: Record<Language, GuideLabels> = { en: EN, fr: FR, mfe: EN }
