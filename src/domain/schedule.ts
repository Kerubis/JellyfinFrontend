// Weekly anime airing schedule from AnimeSchedule.net (PLAN.md M19). Our own shapes; the API DTOs are mapped in
// src/api/schedule.ts.

export type AirType = 'raw' | 'sub' | 'dub'

export const AIR_TYPES: readonly AirType[] = ['raw', 'sub', 'dub']

export type AiringStatus = 'airing' | 'aired' | 'unaired' | 'delayed'

export type ScheduleStream = { platform: string; name: string; url: string }

/** One episode airing (raw, sub or dub) in the timetable. */
export type ScheduleEntry = {
  /** AnimeSchedule slug; identifies the show across air types. */
  route: string
  title: string
  romaji?: string
  english?: string
  native?: string
  airType: AirType
  /** ISO timestamp (UTC). */
  airsAt: string
  episode: number
  /** First episode when several air at once ("3–5"). */
  episodeFrom?: number
  /** 0 = unknown. */
  episodes: number
  lengthMin: number
  donghua: boolean
  /** Media type slugs, e.g. "tv", "ona". */
  mediaTypes: string[]
  streams: ScheduleStream[]
  status: AiringStatus
  delayedText?: string
  image?: string
}

export type Category = { name: string; route: string }

/** Full show details (opened from a timetable entry). */
export type AnimeDetails = {
  route: string
  title: string
  english?: string
  native?: string
  synonyms: string[]
  /** Plain text (the API sends HTML). */
  description?: string
  image?: string
  status?: string
  season?: string
  episodes: number
  lengthMin: number
  premier?: string
  subPremier?: string
  dubPremier?: string
  genres: Category[]
  studios: Category[]
  sources: Category[]
  mediaTypes: Category[]
  streams: ScheduleStream[]
  links: { label: string; url: string }[]
  /** For the TMDB mapping (Seerr requests). */
  malId?: number
  anilistId?: number
}

export type WeekStart = 'monday' | 'sunday' | 'saturday' | 'rotating'
export type ScheduleSort = 'time' | 'alphabetical' | 'unaired'

/** Episode ranges are capped here; the top value means "this or more". */
export const EPISODE_RANGE_MAX = 60

export type ScheduleFilters = {
  airTypes: AirType[]
  /** Hide a raw entry when the show also has a sub / dub entry this week. */
  hideRawWhen: ('sub' | 'dub')[]
  hideSubWhen: ('dub' | 'raw')[]
  hideDubWhen: ('sub' | 'raw')[]
  images: boolean
  donghua: boolean
  sortBy: ScheduleSort
  weekStart: WeekStart
  /** Streaming platform filter: show only the selected platforms, or everything except them. */
  platformMode: 'include' | 'exclude'
  platforms: string[]
  /** Media type slugs to show; empty = all. */
  mediaTypes: string[]
  totalEpisodes: [number, number]
  airedEpisode: [number, number]
}

export const MEDIA_TYPES: readonly Category[] = [
  { name: 'TV', route: 'tv' },
  { name: 'TV Short', route: 'tv-short' },
  { name: 'ONA', route: 'ona' },
  { name: 'ONA (Chinese)', route: 'ona-chinese' },
  { name: 'OVA', route: 'ova' },
  { name: 'Special', route: 'special' },
  { name: 'Movie', route: 'movie' },
]

/** "Ep 5 / 12", "Ep 1–10 / 10" (several at once), "Ep 5" (total unknown). */
export function episodeLabel(entry: ScheduleEntry): string {
  const episode = entry.episodeFrom ? `${entry.episodeFrom}–${entry.episode}` : String(entry.episode)
  return entry.episodes > 0 ? `Ep ${episode} / ${entry.episodes}` : `Ep ${episode}`
}

const inRange = (value: number, [min, max]: [number, number]) => value >= min && (max >= EPISODE_RANGE_MAX || value <= max)

/**
 * Entries whose title (any language) or one of whose genres (by route) contains the search text; case, spaces and
 * punctuation don't matter.
 */
export function searchSchedule(
  entries: readonly ScheduleEntry[],
  query: string,
  genres: ReadonlyMap<string, readonly string[]>,
): readonly ScheduleEntry[] {
  const key = titleKey(query)
  if (!key) return entries
  const matches = (text: string | undefined) => !!text && titleKey(text).includes(key)
  return entries.filter((e) => [e.title, e.romaji, e.english, e.native].some(matches) || genres.get(e.route)?.some(matches))
}

/** The entries to show, sorted within each day by the chosen order. */
export function filterSchedule(entries: readonly ScheduleEntry[], filters: ScheduleFilters): ScheduleEntry[] {
  // Which air types each show has in the loaded weeks (for the "hide … when …" rules).
  const has = new Map<string, Set<AirType>>()
  for (const entry of entries) {
    const types = has.get(entry.route) ?? new Set<AirType>()
    types.add(entry.airType)
    has.set(entry.route, types)
  }
  const hiddenBy: Record<AirType, readonly AirType[]> = {
    raw: filters.hideRawWhen,
    sub: filters.hideSubWhen,
    dub: filters.hideDubWhen,
  }
  const platforms = new Set(filters.platforms)

  const shown = entries.filter((entry) => {
    if (!filters.airTypes.includes(entry.airType)) return false
    const types = has.get(entry.route)
    if (hiddenBy[entry.airType].some((other) => types?.has(other))) return false
    if (!filters.donghua && entry.donghua) return false
    if (filters.mediaTypes.length > 0 && !entry.mediaTypes.some((type) => filters.mediaTypes.includes(type))) return false
    if (platforms.size > 0) {
      const onSelected = entry.streams.some((stream) => platforms.has(stream.platform))
      if (filters.platformMode === 'include' ? !onSelected : onSelected) return false
    }
    // Unknown totals (0) always pass.
    if (entry.episodes > 0 && !inRange(entry.episodes, filters.totalEpisodes)) return false
    return inRange(entry.episode, filters.airedEpisode)
  })
  return shown.sort(comparator(filters.sortBy))
}

function comparator(sort: ScheduleSort): (a: ScheduleEntry, b: ScheduleEntry) => number {
  const byTime = (a: ScheduleEntry, b: ScheduleEntry) => a.airsAt.localeCompare(b.airsAt) || a.title.localeCompare(b.title)
  if (sort === 'alphabetical') return (a, b) => a.title.localeCompare(b.title)
  if (sort === 'unaired') return (a, b) => Number(a.status !== 'unaired') - Number(b.status !== 'unaired') || byTime(a, b)
  return byTime
}

/** Local midnight of `date`. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

const WEEKDAY: Record<Exclude<WeekStart, 'rotating'>, number> = { sunday: 0, monday: 1, saturday: 6 }

/** First day of the 7-day window that contains `day` (rotating: the window starts on `day` itself). */
export function weekWindowStart(day: Date, weekStart: WeekStart): Date {
  const start = startOfDay(day)
  if (weekStart === 'rotating') return start
  return addDays(start, -((start.getDay() - WEEKDAY[weekStart] + 7) % 7))
}

/** ISO 8601 week (Monday first) of a local date, as AnimeSchedule's `year` / `week` parameters. */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // The ISO week belongs to the year of its Thursday.
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const year = d.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(year, 0, 4))
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return { year, week }
}

/** Local date key "YYYY-MM-DD", for grouping entries by day. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// --- Library matching ----------------------------------------------------------------------------------------
// AnimeSchedule shows carry no TMDB/TVDB ids (Jellyfin's only ids), so shows are matched by title: the Japanese
// title against Jellyfin's OriginalTitle (TMDB fills it in Japanese) catches most, English / romaji against the
// name the rest. A later season is its own AnimeSchedule show ("… 3rd Season", "… II"), so season suffixes are
// dropped, and a title that starts with the other's (6+ characters) still counts. Checked on 2026-10-20 against
// the real library: 12 of the week's 150 shows matched, no false hits.

export type LibrarySeries = { id: string; name: string; originalTitle?: string }

export type LibraryIndex = { exact: Map<string, LibrarySeries>; keys: [string, LibrarySeries][] }

const SEASON_SUFFIX =
  /(?:\s*(?:\d+(?:st|nd|rd|th)\s+season|season\s*\d+|part\s*\d+|cour\s*\d+|第\s*\d+\s*期|\d+期|\s\d+|\s(?:ii|iii|iv|v|vi)))+\s*$/i

/** Lower case, no punctuation or spaces ("Kusuriya no Hitorigoto!" → "kusuriyanohitorigoto"). */
function titleKey(title: string): string {
  return title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function titleKeys(titles: readonly (string | undefined)[]): string[] {
  const keys = new Set<string>()
  for (const title of titles) {
    if (!title) continue
    const normalized = title.normalize('NFKC')
    keys.add(titleKey(normalized))
    keys.add(titleKey(normalized.replace(SEASON_SUFFIX, '')))
  }
  keys.delete('')
  return [...keys]
}

export function buildLibraryIndex(series: readonly LibrarySeries[]): LibraryIndex {
  const exact = new Map<string, LibrarySeries>()
  const keys: [string, LibrarySeries][] = []
  for (const s of series) {
    for (const key of titleKeys([s.name, s.originalTitle])) {
      if (!exact.has(key)) exact.set(key, s)
      keys.push([key, s])
    }
  }
  return { exact, keys }
}

const PREFIX_MIN = 6

/** The library series for a show's titles (romaji, English, Japanese), if there is one. */
export function findInLibrary(index: LibraryIndex, titles: readonly (string | undefined)[]): LibrarySeries | undefined {
  const keys = titleKeys(titles)
  for (const key of keys) {
    const hit = index.exact.get(key)
    if (hit) return hit
  }
  for (const key of keys) {
    for (const [other, series] of index.keys) {
      if (Math.min(key.length, other.length) >= PREFIX_MIN && (key.startsWith(other) || other.startsWith(key))) return series
    }
  }
  return undefined
}
