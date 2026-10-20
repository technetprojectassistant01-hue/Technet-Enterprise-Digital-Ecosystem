import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle, ArrowRight, BookOpen, ChevronDown, Lightbulb, Search } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { EmptyState } from './dashboard/ui'
import { guideFor, guideLanguage, type GuideBlock, type GuideChapter } from './guide'
import { GUIDE_LABELS } from './guide/labels'
import { useLanguage } from './i18n'

/**
 * The User Guide (/dashboard/guide): a step-by-step manual for the signed-in person's role. The
 * text lives in client/src/guide/ - English and French (2026-10-20), following the language picked in
 * Settings; Kreol shows English, labels included, until its guides are written. Static, so it opens
 * offline once the app is cached.
 */

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case 'p':
      return <p>{block.text}</p>
    case 'steps':
      return (
        <ol className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-cyan-accent">
          {block.items.map((item) => (
            <li key={item} className="pl-1">
              {item}
            </li>
          ))}
        </ol>
      )
    case 'list':
      return (
        <ul className="list-disc space-y-1.5 pl-5 marker:text-ink-500">
          {block.items.map((item) => (
            <li key={item} className="pl-1">
              {item}
            </li>
          ))}
        </ul>
      )
    case 'tip':
      return (
        <div className="flex gap-2.5 rounded-lg border border-cyan-accent/30 bg-cyan-accent/5 px-3.5 py-3 text-ink-200">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cyan-accent" />
          <p>{block.text}</p>
        </div>
      )
    case 'note':
      return (
        <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3.5 py-3 text-ink-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>{block.text}</p>
        </div>
      )
  }
}

/** Lower case without accents, so "conge" finds "congé" - phones make accents slow to type. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** All the text in a block, for search. */
function blockText(block: GuideBlock): string {
  return 'items' in block ? block.items.join(' ') : block.text
}

function Contents({ chapters, onPick }: { chapters: GuideChapter[]; onPick?: () => void }) {
  return (
    <nav className="space-y-4 text-sm">
      {chapters.map((chapter) => (
        <div key={chapter.id}>
          <a href={`#${chapter.id}`} onClick={onPick} className="font-semibold text-ink-100 hover:text-cyan-accent">
            {chapter.title}
          </a>
          <ul className="mt-1.5 space-y-1 border-l border-ink-800 pl-3">
            {chapter.topics.map((topic) => (
              <li key={topic.id}>
                <a href={`#${topic.id}`} onClick={onPick} className="text-ink-400 hover:text-ink-100">
                  {topic.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function UserGuidePage() {
  const { user } = useAuth()
  const { hash } = useLocation()
  const { language } = useLanguage()
  const shown = guideLanguage(language)
  const guide = guideFor(user?.role, shown)
  const l = GUIDE_LABELS[shown]
  const [query, setQuery] = useState('')
  const [contentsOpen, setContentsOpen] = useState(false)

  // Links to a topic (#id) - the router doesn't scroll to hashes by itself.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])

  const chapters = useMemo(() => {
    if (!guide) return []
    const words = fold(query).split(/\s+/).filter(Boolean)
    if (!words.length) return guide.chapters
    return guide.chapters
      .map((chapter) => ({
        ...chapter,
        topics: chapter.topics.filter((topic) => {
          const text = fold(`${chapter.title} ${topic.title} ${topic.blocks.map(blockText).join(' ')}`)
          return words.every((word) => text.includes(word))
        }),
      }))
      .filter((chapter) => chapter.topics.length > 0)
  }, [guide, query])

  if (!guide) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold text-ink-100">{l.pageTitle}</h1>
        <EmptyState icon={BookOpen} message={l.noGuide} />
        <p className="mt-4 text-center text-sm">
          <Link to="/dashboard/help" className="font-semibold text-cyan-accent hover:underline">
            {l.openHelp}
          </Link>
        </p>
      </div>
    )
  }

  const [y, m, d] = guide.updated.split('-').map(Number)
  const updated = new Date(y, m - 1, d).toLocaleDateString(l.locale, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="mx-auto flex max-w-6xl gap-10">
      {/* Contents beside the text on wide screens. */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-2">
          <p className="mb-3 text-[11px] font-semibold tracking-widest text-ink-400">{l.contents.toUpperCase()}</p>
          <Contents chapters={chapters} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-ink-100">{guide.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">{guide.intro}</p>
        <p className="mt-2 text-xs text-ink-500">{l.lastChecked(updated)}</p>

        <div className="mt-6 flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 focus-within:border-cyan-accent">
          <Search className="h-4 w-4 shrink-0 text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={l.searchPlaceholder}
            aria-label={l.searchAria}
            className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
          />
        </div>

        {/* Contents as a fold-out on phones and tablets. */}
        <div className="mt-4 rounded-xl border border-ink-800 bg-ink-900 lg:hidden">
          <button
            type="button"
            onClick={() => setContentsOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink-100"
            aria-expanded={contentsOpen}
          >
            {l.contents}
            <ChevronDown className={`h-4 w-4 text-ink-400 transition ${contentsOpen ? 'rotate-180' : ''}`} />
          </button>
          {contentsOpen && (
            <div className="border-t border-ink-800 px-4 py-4">
              <Contents chapters={chapters} onPick={() => setContentsOpen(false)} />
            </div>
          )}
        </div>

        <div className="mt-8 space-y-12">
          {chapters.map((chapter) => (
            <section key={chapter.id} id={chapter.id} className="scroll-mt-6">
              <h2 className="text-lg font-bold text-ink-100">{chapter.title}</h2>
              {chapter.intro && <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{chapter.intro}</p>}
              <div className="mt-4 space-y-4">
                {chapter.topics.map((topic) => (
                  <article
                    key={topic.id}
                    id={topic.id}
                    className="scroll-mt-6 rounded-xl border border-ink-800 bg-ink-900 p-4 shadow-sm shadow-black/20 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-ink-100">{topic.title}</h3>
                      {topic.path && (
                        <Link
                          to={topic.path}
                          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-accent hover:underline"
                        >
                          {l.openPage}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                    <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-300">
                      {topic.blocks.map((block, i) => (
                        <Block key={i} block={block} />
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          {chapters.length === 0 && (
            <p className="rounded-xl border border-ink-800 bg-ink-900 p-6 text-center text-sm text-ink-300">
              {l.noMatch(query)}
              <Link to="/dashboard/help" className="font-semibold text-cyan-accent hover:underline">
                {l.noMatchHelp}
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserGuidePage
