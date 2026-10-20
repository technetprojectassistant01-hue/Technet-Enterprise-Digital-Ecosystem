import type { Role } from '../lib/api'

/**
 * The in-app User Guide (2026-10-19): a step-by-step manual per role, in English and (from
 * 2026-10-20) French - see ./fr; Kreol shows English until it is written. Every statement must describe how the app behaves today - when a feature is added
 * or changed, update the guide in the same piece of work (the user's standing rule).
 */

export type GuideBlock =
  /** A plain paragraph. */
  | { kind: 'p'; text: string }
  /** Numbered steps, in order. */
  | { kind: 'steps'; items: string[] }
  /** A bulleted list. */
  | { kind: 'list'; items: string[] }
  /** A helpful hint. */
  | { kind: 'tip'; text: string }
  /** A limitation or something to be careful about. */
  | { kind: 'note'; text: string }

export interface GuideTopic {
  /** Stable id, used as the page anchor (#id). */
  id: string
  title: string
  /** The screen this topic describes, offered as an "Open this page" link. */
  path?: string
  blocks: GuideBlock[]
}

export interface GuideChapter {
  id: string
  title: string
  intro?: string
  topics: GuideTopic[]
}

export interface RoleGuide {
  /** Shown as the guide's title, e.g. "Administrator guide". */
  title: string
  intro: string
  /** The roles this guide is written for. */
  roles: readonly Role[]
  /** "YYYY-MM-DD" the guide was last checked against the app. */
  updated: string
  chapters: GuideChapter[]
}
