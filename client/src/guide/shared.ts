import type { GuideTopic, RoleGuide } from './types'

/**
 * Lets one guide reuse another guide's topics by id, so text that reads the same for several roles
 * is written once. The returned function throws at start-up if an id was renamed in the source
 * guide - a missing topic must never silently vanish from a guide.
 */
export function topicsFrom(source: RoleGuide): (id: string) => GuideTopic {
  const byId = new Map(source.chapters.flatMap((c) => c.topics).map((t) => [t.id, t]))
  return (id) => {
    const topic = byId.get(id)
    if (!topic) throw new Error(`User guide: "${source.title}" has no topic "${id}"`)
    return topic
  }
}
