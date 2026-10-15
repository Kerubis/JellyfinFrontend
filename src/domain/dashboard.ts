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
  }
}

export const SECTION_INFO: Record<SectionType, { title: string; defaultLimit: number }> = {
  currentlyWatching: { title: 'Currently Watching', defaultLimit: 0 },
  newEpisodes: { title: 'New Episodes', defaultLimit: 40 },
  continueWatching: { title: 'Continue Watching', defaultLimit: 30 },
  recentlyAdded: { title: 'Recently Added', defaultLimit: 40 },
  following: { title: 'Following', defaultLimit: 0 },
  favorites: { title: 'Favorites', defaultLimit: 60 },
  unwatchedMovies: { title: 'Unwatched Movies', defaultLimit: 40 },
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
      },
    })
  }
  return sections
}
