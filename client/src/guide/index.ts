import type { Language, Role } from '../lib/api'
import { hasRole } from '../lib/permissions'
import { ADMIN_GUIDE } from './adminGuide'
import { FINANCE_GUIDE } from './financeGuide'
import { HR_GUIDE } from './hrGuide'
import { OFFICE_GUIDE } from './officeGuide'
import { SALES_GUIDE } from './salesGuide'
import { STOREKEEPER_GUIDE } from './storekeeperGuide'
import { TECHNICIAN_GUIDE } from './technicianGuide'
import { FR_GUIDES } from './fr'
import type { RoleGuide } from './types'

/**
 * Every role guide written so far. Written role by role (Admin, HR, Staff Technician, Storekeeper,
 * Staff Office, Sales Officer, 2026-10-19; Finance Officer, 2026-10-20); add each new guide here and it appears in the menu for
 * that role. French copies (2026-10-20) live in ./fr, one per English guide, same chapter and
 * topic ids. Kreol shows the English guide until its copies are written.
 */
export const GUIDES: RoleGuide[] = [ADMIN_GUIDE, HR_GUIDE, TECHNICIAN_GUIDE, STOREKEEPER_GUIDE, OFFICE_GUIDE, SALES_GUIDE, FINANCE_GUIDE]

const GUIDES_BY_LANGUAGE: Record<Language, RoleGuide[]> = { en: GUIDES, fr: FR_GUIDES, mfe: GUIDES }

/** The language the guide is actually shown in: one without its own guides falls back to English. */
export function guideLanguage(language: Language): Language {
  return GUIDES_BY_LANGUAGE[language] === GUIDES ? 'en' : language
}

/** The guide for a role, or null while that role's guide hasn't been written. */
export function guideFor(role: Role | undefined, language: Language = 'en'): RoleGuide | null {
  if (!role) return null
  // hasRole treats the Operations Manager as an admin, so they get the admin guide too.
  return GUIDES_BY_LANGUAGE[language].find((g) => hasRole(role, g.roles)) ?? null
}

/**
 * A translation must have the same chapters and topics as the English guide, in the same order -
 * the ids are the page anchors, and a topic missing from one language is a topic someone can't
 * find. Checked while developing; a mismatch is reported in the browser console.
 */
function shapeOf(guide: RoleGuide): string {
  return guide.chapters.map((c) => `${c.id}(${c.topics.map((t) => `${t.id}${t.path ? `@${t.path}` : ''}`).join(',')})`).join(' ')
}
if (import.meta.env.DEV) {
  for (const [language, guides] of Object.entries(GUIDES_BY_LANGUAGE)) {
    if (guides === GUIDES) continue
    GUIDES.forEach((english, i) => {
      const other = guides[i]
      if (!other || other.roles.join() !== english.roles.join() || shapeOf(other) !== shapeOf(english)) {
        console.error(`User guide: the ${language} copy of "${english.title}" does not match the English chapters and topics.`)
      }
    })
  }
}

export type { GuideBlock, GuideChapter, GuideTopic, RoleGuide } from './types'
