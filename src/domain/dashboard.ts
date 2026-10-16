// The home page is an ordered list of sections stored in profile prefs (PLAN.md §3.6).

export type SectionType =
  | 'currentlyWatching'
  | 'newEpisodes'
  | 'continueWatching'
  | 'recentlyAdded'
  | 'following'
  | 'favorites'
  | 'unwatchedMovies'

export type DashboardSection = {
  id: string
  type: SectionType
  /** Custom label; the type's default title otherwise. */
  title?: string
  visible: boolean
  options: {
    /** Limit to these libraries (recentlyAdded). */
    libraryIds?: string[]
    /** Max items loaded into the section; 0 = all. */
    limit?: number
    /** Window for "new": currentlyWatching badge; newEpisodes only lists episodes added in it (unset = all). */
    days?: number
    /** Don't show the section at all while it has nothing to show. */
    hideWhenEmpty?: boolean
  }
}

export type SectionOption = 'limit' | 'days' | 'libraries'

export const SECTION_INFO: Record<SectionType, { title: string; defaultLimit: number; description: string; options: SectionOption[] }> = {
  currentlyWatching: {
    title: 'Currently Watching',
    defaultLimit: 0,
    description: 'Started or followed shows with unwatched episodes, newest episode first; started movies',
    options: ['limit', 'days'],
  },
  newEpisodes: {
    title: 'New Episodes',
    defaultLimit: 40,
    description: 'Unwatched episodes of the shows you are watching, one card per show',
    options: ['limit', 'days'],
  },
  continueWatching: { title: 'Continue Watching', defaultLimit: 30, description: 'Partly watched episodes and movies', options: ['limit'] },
  recentlyAdded: { title: 'Recently Added', defaultLimit: 40, description: 'Newest additions, optionally from selected libraries', options: ['limit', 'libraries'] },
  following: { title: 'Following', defaultLimit: 0, description: 'Shows you follow', options: ['limit'] },
  favorites: { title: 'Favorites', defaultLimit: 60, description: 'Your Jellyfin favorites (shows and movies)', options: ['limit'] },
  unwatchedMovies: { title: 'Unwatched Movies', defaultLimit: 40, description: 'Movies you have not seen, newest first', options: ['limit'] },
}

export const SECTION_TYPES = Object.keys(SECTION_INFO) as SectionType[]

/** A new section of a type with a unique id. */
export function createSection(type: SectionType, existing: readonly DashboardSection[]): DashboardSection {
  const base = type.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
  let id = base
  for (let n = 2; existing.some((s) => s.id === id); n++) id = `${base}-${n}`
  return { id, type, visible: true, options: {} }
}

/** Moves the section at `index` by `delta` positions (clamped). */
export function moveSection(sections: readonly DashboardSection[], index: number, delta: number): DashboardSection[] {
  const target = Math.min(sections.length - 1, Math.max(0, index + delta))
  const next = [...sections]
  const [moved] = next.splice(index, 1)
  if (moved) next.splice(target, 0, moved)
  return next
}

export const DEFAULT_NEW_DAYS = 7

export const DEFAULT_SECTIONS: DashboardSection[] = [
  { id: 'currently-watching', type: 'currentlyWatching', visible: true, options: {} },
  { id: 'new-episodes', type: 'newEpisodes', visible: true, options: {} },
  { id: 'recently-added', type: 'recentlyAdded', visible: true, options: {} },
]

export function sectionTitle(section: DashboardSection): string {
  return section.title || SECTION_INFO[section.type].title
}

/** 0 = no limit. */
export function sectionLimit(section: DashboardSection): number {
  return section.options.limit ?? SECTION_INFO[section.type].defaultLimit
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Drops malformed or unknown sections (e.g. written by a newer version) instead of crashing. */
export function normalizeSections(value: unknown): DashboardSection[] {
  if (!Array.isArray(value)) return DEFAULT_SECTIONS
  const seen = new Set<string>()
  const sections: DashboardSection[] = []
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || seen.has(raw.id)) continue
    if (typeof raw.type !== 'string' || !(raw.type in SECTION_INFO)) continue
    const options = isRecord(raw.options) ? raw.options : {}
    seen.add(raw.id)
    sections.push({
      id: raw.id,
      type: raw.type as SectionType,
      title: typeof raw.title === 'string' ? raw.title : undefined,
      visible: raw.visible !== false,
      options: {
        libraryIds: Array.isArray(options.libraryIds)
          ? options.libraryIds.filter((id): id is string => typeof id === 'string')
          : undefined,
        limit: typeof options.limit === 'number' ? options.limit : undefined,
        days: typeof options.days === 'number' ? options.days : undefined,
        hideWhenEmpty: options.hideWhenEmpty === true ? true : undefined,
      },
    })
  }
  return sections
}
