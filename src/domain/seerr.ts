// Seerr (Overseerr / Jellyseerr) requests from the airing schedule (PLAN.md M19, D38). Our own shapes; the API DTOs
// are mapped in src/api/seerr.ts.

import { formatToken } from './searchQuery'

/**
 * Server address, API key and routing rules, written by an admin into each profile allowed to request. Empty key
 * = off.
 */
export type SeerrConfig = { url: string; apiKey: string; routing: SeerrRouting }

/** `http(s)://host[:port]`, no path: what the proxies accept as a target (vite.config.ts, docker/nginx.conf). */
export const SEERR_URL = /^https?:\/\/[A-Za-z0-9.:[\]-]+$/

/** Trims and drops trailing slashes, so "http://host:5055/" and "http://host:5055" are the same server. */
export const normalizeSeerrUrl = (url: string) => url.trim().replace(/\/+$/, '')

export type SeerrKind = 'tv' | 'movie'

// --- Destination servers (D39) ---------------------------------------------------------------------------------
// Seerr sends a request to its default (4K) Sonarr / Radarr unless the request names a server; it recognises anime
// but only switches to that server's anime profile and folder, never to another server. So the app picks the server
// itself: an admin maps anime / other × TV / movies × HD / 4K to a server, and the request panel starts from that.

export type SeerrRouteKey = `${SeerrKind}-${'anime' | 'other'}-${'hd' | '4k'}`

/** Server id per route; missing or SEERR_DEFAULT uses Seerr's default server. */
export type SeerrRouting = Partial<Record<SeerrRouteKey, number>>

/** Stored when the admin picks "Seerr default" on purpose (so a name-based suggestion doesn't come back). */
export const SEERR_DEFAULT = -1

export const routeKey = (kind: SeerrKind, anime: boolean, is4k: boolean): SeerrRouteKey =>
  `${kind}-${anime ? 'anime' : 'other'}-${is4k ? '4k' : 'hd'}`

export const ROUTE_KEYS: readonly SeerrRouteKey[] = (['tv', 'movie'] as const).flatMap((kind) =>
  [true, false].flatMap((anime) => [false, true].map((is4k) => routeKey(kind, anime, is4k))),
)

export function normalizeRouting(value: unknown): SeerrRouting {
  if (typeof value !== 'object' || value === null) return {}
  const out: SeerrRouting = {}
  for (const key of ROUTE_KEYS) {
    const id = (value as Record<string, unknown>)[key]
    if (typeof id === 'number' && Number.isInteger(id) && id >= SEERR_DEFAULT) out[key] = id
  }
  return out
}

/** A Sonarr / Radarr server as Seerr describes it (no addresses or keys). */
export type SeerrServer = {
  id: number
  name: string
  is4k: boolean
  isDefault: boolean
  profileId?: number
  rootFolder?: string
  /** Sonarr only: what Seerr uses for anime on this server. */
  animeProfileId?: number
  animeRootFolder?: string
}

export type SeerrServerOptions = { profiles: { id: number; name: string }[]; rootFolders: string[] }

/** For anime: a server whose name says so ("sonarr-anime"), as a suggestion where the admin set no route. */
const animeServer = (servers: readonly SeerrServer[], is4k: boolean) => servers.find((s) => s.is4k === is4k && /anime/i.test(s.name))

/**
 * The server a request starts with: the admin's route, else (anime, no route saved) a server named "…anime…", else
 * Seerr's default for HD / 4K, else the first one. SEERR_DEFAULT skips the suggestion.
 */
export function routedServer(servers: readonly SeerrServer[], routing: SeerrRouting, key: SeerrRouteKey, is4k: boolean): SeerrServer | undefined {
  const own = servers.filter((s) => s.is4k === is4k)
  const route = routing[key]
  const suggested = route === undefined && key.includes('-anime-') ? animeServer(own, is4k) : undefined
  return own.find((s) => s.id === route) ?? suggested ?? own.find((s) => s.isDefault) ?? own[0]
}

/** A server's profile and root folder for this title (its anime ones for anime, when it has them). */
export const serverDefaults = (server: SeerrServer, anime: boolean) => ({
  profileId: (anime && server.animeProfileId) || server.profileId,
  rootFolder: (anime && server.animeRootFolder) || server.rootFolder,
})

/**
 * The routing to save: the admin's choices, plus a suggestion for anime routes nobody chose yet (a server whose
 * name says anime, e.g. "sonarr-anime"). In ROUTE_KEYS order, so it compares equal to the stored one.
 */
export function withSuggestions(routing: SeerrRouting, servers: Record<SeerrKind, readonly SeerrServer[]>): SeerrRouting {
  const out: SeerrRouting = {}
  for (const key of ROUTE_KEYS) {
    const [kind, audience, quality] = key.split('-') as [SeerrKind, string, string]
    const suggested = audience === 'anime' ? animeServer(servers[kind], quality === '4k')?.id : undefined
    const id = routing[key] ?? suggested
    if (id !== undefined) out[key] = id
  }
  return out
}

/** TMDB keyword "anime", the signal Seerr itself uses. */
export const ANIME_KEYWORD_ID = 210024

/** Anime by TMDB keyword, else Japanese animation (TMDB has no anime genre; "Animation" alone covers Pixar too). */
export const isAnime = (keywordIds: readonly number[], genres: readonly string[], originalLanguage: string | undefined) =>
  keywordIds.includes(ANIME_KEYWORD_ID) || (genres.includes('Animation') && originalLanguage === 'ja')

/**
 * What Seerr knows about a title or one of its seasons: in the library (fully / partly), requested and being
 * downloaded, requested and waiting for approval, or nothing yet.
 */
export type SeerrStatus = 'available' | 'partial' | 'processing' | 'pending' | 'none'

/** Seerr tracks HD and 4K separately: a show can be available in HD and not requested in 4K. */
export type SeerrSeason = { number: number; name: string; episodes: number; status: SeerrStatus; status4k: SeerrStatus }

/** A search hit / tile: enough to show and identify the title. */
export type SeerrResult = {
  kind: SeerrKind
  tmdbId: number
  title: string
  year?: string
  poster?: string
  status: SeerrStatus
  status4k: SeerrStatus
  /** The item in the Jellyfin library, when Seerr knows it's there. */
  jellyfinId?: string
}

/** Full details for the popup. */
export type SeerrMedia = SeerrResult & {
  overview?: string
  genres: string[]
  /** Minutes (movie runtime, or a typical episode). */
  runtime?: number
  /** TMDB status, e.g. "Returning Series", "Released". */
  tmdbStatus?: string
  /** TV: where it airs (browsable); movies: none. */
  networks: SeerrCompany[]
  /** Production companies; only movies can be browsed by studio. */
  studios: SeerrCompany[]
  keywords: SeerrKeyword[]
  /** Who made it and the main cast, grouped ("Directed by", "Cast", …). */
  credits: SeerrCreditGroup[]
  /** By TMDB keyword / Japanese animation (isAnime); picks the anime route. */
  anime: boolean
  /** TV only, without specials (season 0). */
  seasons: SeerrSeason[]
  /** Where Sonarr / Radarr manage the title (HD and 4K), as Seerr links them. */
  services: SeerrService[]
}

/** `serverId`: Seerr's id of the Sonarr / Radarr server (see SeerrServer). */
export type SeerrService = { serverId?: number; is4k: boolean; url: string }

// --- Browsing by keyword, studio, network or person ------------------------------------------------------------

export type SeerrKeyword = { id: number; name: string }
/** A studio (production company) or TV network. */
export type SeerrCompany = { id: number; name: string }
export type SeerrPersonRef = { id: number; name: string }
export type SeerrCreditGroup = { label: string; people: SeerrPersonRef[] }

/** A person search hit. */
export type SeerrPerson = SeerrPersonRef & { photo?: string; knownFor?: string }

/** A keyword, person or studio found by name (autocomplete and resolving `#`, `@`, `$` tokens). */
export type SeerrMatch = { id: number; name: string; photo?: string; detail?: string; popularity?: number }

/** A title in a person's credits; `roles`: their jobs or characters in it. `date`: first release / air date. */
export type SeerrCredit = SeerrResult & { roles: string[]; popularity: number; date?: string; rating?: number; votes?: number }

export type SeerrPersonDetails = SeerrPerson & { department?: string; crew: SeerrCredit[]; cast: SeerrCredit[] }

/**
 * Discover filters, all of which must match: keywords, plus a studio (movies only) or network (TV only). Seerr
 * can't filter TV by studio or movies by network.
 */
export type SeerrBrowse = { keywords: number[]; studio?: number; network?: number }

export type SeerrSort = 'popular' | 'newest' | 'rated'

export const SORT_LABEL: Record<SeerrSort, string> = { popular: 'Popular', newest: 'Newest', rated: 'Top rated' }

/** "Top rated" without enough votes is noise (one 10/10 vote). */
export const RATED_MIN_VOTES = 50

/** A person's credits in the chosen order (discover sorts on the server). Top rated: well-voted titles first. */
export function sortCredits(credits: readonly SeerrCredit[], sort: SeerrSort): SeerrCredit[] {
  const rated = (c: SeerrCredit) => ((c.votes ?? 0) >= RATED_MIN_VOTES ? 1 : 0)
  const compare: Record<SeerrSort, (a: SeerrCredit, b: SeerrCredit) => number> = {
    popular: (a, b) => b.popularity - a.popularity,
    // ISO dates compare as text; undated titles last.
    newest: (a, b) => (b.date ?? '').localeCompare(a.date ?? ''),
    rated: (a, b) => rated(b) - rated(a) || (b.rating ?? 0) - (a.rating ?? 0),
  }
  return [...credits].sort(compare[sort])
}

/** The network filter in the request page's URL (set from the details popup; TMDB has no network search). */
export const parseNetwork = (value: string | null) => (value && /^\d+$/.test(value) ? Number(value) : undefined)

export const parseSort = (value: string | null): SeerrSort => (value === 'newest' || value === 'rated' ? value : 'popular')

/** The kinds a filter set can return. */
export const browseKinds = (b: SeerrBrowse): SeerrKind[] => (b.studio !== undefined ? ['movie'] : b.network !== undefined ? ['tv'] : ['tv', 'movie'])

/** Request-page links that start a fresh search (from the details popup). */
export const browseLink = {
  keyword: (name: string) => `/requests?q=${encodeURIComponent(formatToken('keyword', name))}`,
  studio: (name: string) => `/requests?q=${encodeURIComponent(formatToken('studio', name))}`,
  person: (name: string) => `/requests?q=${encodeURIComponent(formatToken('person', name))}`,
  network: (networkId: number) => `/requests?network=${networkId}`,
}

/** One of the profile's own requests. */
export type SeerrRequestEntry = { id: number; kind: SeerrKind; tmdbId: number; status: SeerrStatus; is4k: boolean; requestedAt: string }

/** URL value for an open title ("tv-1429"), and back. */
export const seerrRef = (m: { kind: SeerrKind; tmdbId: number }) => `${m.kind}-${m.tmdbId}`

export function parseSeerrRef(value: string | null): { kind: SeerrKind; tmdbId: number } | undefined {
  const match = value ? /^(tv|movie)-(\d+)$/.exec(value) : null
  return match ? { kind: match[1] as SeerrKind, tmdbId: Number(match[2]) } : undefined
}

/** Where a title in the library opens: its series or movie page. */
export const libraryPath = (m: SeerrResult) =>
  m.jellyfinId ? (m.kind === 'tv' ? `/series/${m.jellyfinId}` : `/item/${m.jellyfinId}`) : undefined

/** A TMDB title (and season) for an anime, from the Fribb anime-lists mapping. */
export type AnimeTmdb = { kind: SeerrKind; tmdbId: number; season?: number }

export type AnimeIdIndex = { mal: Map<number, AnimeTmdb>; anilist: Map<number, AnimeTmdb> }

/** One entry of Fribb's anime-list-mini.json (only the fields used here). */
export type FribbEntry = {
  mal_id?: number
  anilist_id?: number
  themoviedb_id?: { tv?: number; movie?: number[] }
  season?: { tmdb?: number }
}

/** Indexes the entries that have a TMDB id by MAL and AniList id. */
export function buildAnimeIdIndex(entries: readonly FribbEntry[]): AnimeIdIndex {
  const index: AnimeIdIndex = { mal: new Map(), anilist: new Map() }
  for (const e of entries) {
    const tv = e.themoviedb_id?.tv
    const movie = e.themoviedb_id?.movie?.[0]
    const target: AnimeTmdb | undefined = tv
      ? { kind: 'tv', tmdbId: tv, season: e.season?.tmdb }
      : movie
        ? { kind: 'movie', tmdbId: movie }
        : undefined
    if (!target) continue
    if (e.mal_id) index.mal.set(e.mal_id, target)
    if (e.anilist_id) index.anilist.set(e.anilist_id, target)
  }
  return index
}

/** Seerr's MediaStatus: 2 pending, 3 processing, 4 partially available, 5 available (1 unknown, 6 deleted). */
export function mediaStatus(code: number | undefined): SeerrStatus {
  switch (code) {
    case 2:
      return 'pending'
    case 3:
      return 'processing'
    case 4:
      return 'partial'
    case 5:
      return 'available'
    default:
      return 'none'
  }
}

/** Seerr's MediaRequestStatus of an open request: 1 waiting for approval, 2 approved (3 declined, 4 failed, 5 done). */
export function requestStatus(code: number | undefined): SeerrStatus {
  return code === 1 ? 'pending' : code === 2 ? 'processing' : 'none'
}

/** Whether a title or season can still be requested. */
export const canRequest = (status: SeerrStatus) => status === 'none' || status === 'partial'

/** Short form for the tile's marker corner; nothing when not requested. */
export const STATUS_MARKER: Record<SeerrStatus, string | undefined> = {
  available: 'In library',
  partial: 'Partly',
  processing: 'Requested',
  pending: 'Pending',
  none: undefined,
}

export const STATUS_LABEL: Record<SeerrStatus, string> = {
  available: 'Available',
  partial: 'Partly available',
  processing: 'Requested',
  pending: 'Waiting for approval',
  none: 'Not requested',
}

/**
 * Seasons preselected for a request: the mapped one (none if it's already requested), or the newest requestable
 * season when there's no mapping or TMDB numbers the seasons differently (an airing show is usually in its latest).
 */
export function defaultSeasons(seasons: readonly SeerrSeason[], mapped: number | undefined): number[] {
  const own = seasons.find((s) => s.number === mapped)
  const pick = own ? (canRequest(own.status) ? own : undefined) : seasons.filter((s) => canRequest(s.status)).at(-1)
  return pick ? [pick.number] : []
}
