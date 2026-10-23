// Seerr (Overseerr / Jellyseerr) API v1 (`<seerr>/api-docs`). Seerr sends no CORS headers, so requests go through a
// same-origin pass-through proxy (Vite in dev, nginx in the image) that forwards to the server in `X-Seerr-Url`.
// The URL and API key are written by an admin into each profile allowed to request (synced pref `seerr`, D38);
// requests are made as the profile's own Seerr user (looked up by Jellyfin user id).

import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  buildAnimeIdIndex,
  isAnime,
  mediaStatus,
  requestStatus,
  SEERR_URL,
  type AnimeIdIndex,
  type FribbEntry,
  type SeerrConfig,
  type SeerrKind,
  type SeerrMedia,
  type SeerrRequestEntry,
  type SeerrResult,
  type SeerrSeason,
  type SeerrServer,
  type SeerrServerOptions,
  type SeerrStatus,
} from '@/domain/seerr'
import { usePref } from './prefs-context'
import { fetchProfilePrefs, writeProfilePrefs } from './prefs'
import { useSignedIn } from './session-context'

const BASE = '/seerr'
/** MAL / AniList → TMDB (and TMDB season) for ~8,500 anime; CORS-enabled. */
const FRIBB_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json'
/** Seerr returns TMDB image paths; posters load straight from TMDB's image server (Seerr's own default too). */
const TMDB_POSTER = 'https://image.tmdb.org/t/p/w342'

export class SeerrApiError extends Error {
  readonly status: number

  constructor(status: number, detail?: string) {
    super(
      status === 401 || status === 403
        ? detail && status === 403
          ? `Seerr refused: ${detail}`
          : 'Seerr rejected the API key.'
        : status === 400 && !detail
          ? 'Seerr address not accepted (use http://host:port).'
          : status === 502 || status === 504
            ? 'Seerr not reachable. Check the address.'
            : detail
              ? `Seerr: ${detail}`
              : `Seerr request failed (${status}).`,
    )
    this.status = status
  }
}

type Connection = Pick<SeerrConfig, 'url' | 'apiKey'>
/** Stand-in for disabled queries (they never run without a config). */
const NONE: Connection = { url: '', apiKey: '' }

async function call<T>(config: Connection, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'X-Seerr-Url': config.url,
        'X-Api-Key': config.apiKey,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new SeerrApiError(502)
  }
  if (!response.ok) {
    const detail = await response
      .json()
      .then((data: { message?: unknown }) => (typeof data.message === 'string' ? data.message : undefined))
      .catch(() => undefined)
    throw new SeerrApiError(response.status, detail)
  }
  return (await response.json()) as T
}

/** Client errors (bad key, not found) won't fix themselves; only retry the rest. */
const retry = (failures: number, error: Error) =>
  !(error instanceof SeerrApiError && error.status >= 400 && error.status < 500) && failures < 2

// Fields per the swagger docs plus what the server sends but doesn't document (season states); all optional.
type SeasonStateDto = { seasonNumber?: number; status?: number; status4k?: number }
type RequestDto = { status?: number; is4k?: boolean; seasons?: SeasonStateDto[]; serverId?: number | null }
type MediaInfoDto = {
  tmdbId?: number
  mediaType?: string
  status?: number
  status4k?: number
  jellyfinMediaId?: string | null
  seasons?: SeasonStateDto[]
  requests?: RequestDto[]
}
type SeasonDto = { seasonNumber?: number; name?: string; episodeCount?: number }
type NamedDto = { name?: string }
type DetailsDto = {
  id?: number
  name?: string
  title?: string
  firstAirDate?: string
  releaseDate?: string
  posterPath?: string | null
  overview?: string
  genres?: NamedDto[]
  keywords?: { id?: number }[]
  originalLanguage?: string
  runtime?: number
  episodeRunTime?: number[]
  status?: string
  networks?: NamedDto[]
  seasons?: SeasonDto[]
  mediaInfo?: MediaInfoDto
}
type SearchDto = { page?: number; totalPages?: number; results?: (DetailsDto & { mediaType?: string })[] }
type RequestListDto = { results?: (RequestDto & { id?: number; createdAt?: string; media?: MediaInfoDto })[] }
type UserDto = { id?: number; displayName?: string; username?: string; jellyfinUsername?: string }
// Seerr's trimmed server list (/service/sonarr, /service/radarr): no addresses or API keys.
type ServerDto = {
  id?: number
  name?: string
  is4k?: boolean
  isDefault?: boolean
  activeProfileId?: number
  activeDirectory?: string
  activeAnimeProfileId?: number | null
  activeAnimeDirectory?: string | null
}
type ServerDetailsDto = { profiles?: { id?: number; name?: string }[]; rootFolders?: { path?: string }[] }

/** Open requests (not declined / failed / done) of the HD or 4K variant count as requested. */
function requestedStatus(requests: RequestDto[] | undefined, is4k: boolean, season?: number): SeerrStatus {
  for (const r of requests ?? []) {
    if (!!r.is4k !== is4k) continue
    if (season !== undefined && !r.seasons?.some((s) => s.seasonNumber === season)) continue
    const status = requestStatus(r.status)
    if (status !== 'none') return status
  }
  return 'none'
}

function toResult(kind: SeerrKind, dto: DetailsDto): SeerrResult {
  const info = dto.mediaInfo
  const state = (code: number | undefined, is4k: boolean) => {
    const known = mediaStatus(code)
    return known !== 'none' ? known : requestedStatus(info?.requests, is4k)
  }
  return {
    kind,
    tmdbId: dto.id ?? 0,
    title: dto.name ?? dto.title ?? '',
    year: (dto.firstAirDate ?? dto.releaseDate)?.slice(0, 4) || undefined,
    poster: dto.posterPath ? TMDB_POSTER + dto.posterPath : undefined,
    status: state(info?.status, false),
    status4k: state(info?.status4k, true),
    jellyfinId: info?.jellyfinMediaId || undefined,
  }
}

const names = (list: NamedDto[] | undefined) => (list ?? []).flatMap((x) => (x.name ? [x.name] : []))

function toMedia(kind: SeerrKind, dto: DetailsDto): SeerrMedia {
  const info = dto.mediaInfo
  const seasons = (dto.seasons ?? []).flatMap((s): SeerrSeason[] => {
    if (!s.seasonNumber) return [] // specials (0) and broken entries
    const own = info?.seasons?.find((x) => x.seasonNumber === s.seasonNumber)
    const state = (code: number | undefined, is4k: boolean) => {
      const known = mediaStatus(code)
      return known !== 'none' ? known : requestedStatus(info?.requests, is4k, s.seasonNumber)
    }
    return [
      {
        number: s.seasonNumber,
        name: s.name || `Season ${s.seasonNumber}`,
        episodes: s.episodeCount ?? 0,
        status: state(own?.status, false),
        status4k: state(own?.status4k, true),
      },
    ]
  })
  return {
    ...toResult(kind, dto),
    overview: dto.overview || undefined,
    genres: names(dto.genres),
    runtime: dto.runtime || dto.episodeRunTime?.[0] || undefined,
    tmdbStatus: dto.status || undefined,
    networks: names(dto.networks),
    anime: isAnime(
      (dto.keywords ?? []).flatMap((k) => (k.id ? [k.id] : [])),
      names(dto.genres),
      dto.originalLanguage,
    ),
    seasons,
  }
}

/** The profile's Seerr server; undefined when it isn't set up for this profile. */
export function useSeerrConfig(): SeerrConfig | undefined {
  const config = usePref('seerr').value
  return config.apiKey && SEERR_URL.test(config.url) ? config : undefined
}

/** Checks the address and key with one small request (the key's own user). */
export async function checkSeerr(config: Connection): Promise<void> {
  await call<unknown>(config, 'auth/me')
}

/** The Fribb mapping, indexed. Loaded only when needed (≈1.2 MB gzipped) and kept for the session. */
export function useAnimeIdIndex(enabled: boolean) {
  return useQuery({
    queryKey: ['fribb', 'animeIds'],
    queryFn: async (): Promise<AnimeIdIndex> => {
      const response = await fetch(FRIBB_URL)
      if (!response.ok) throw new Error(`Anime id mapping failed to load (${response.status}).`)
      return buildAnimeIdIndex((await response.json()) as FribbEntry[])
    },
    enabled,
    staleTime: 24 * 60 * 60_000,
    gcTime: Infinity,
  })
}

/** Title, request state and seasons of one TMDB title in Seerr. */
export function useSeerrMedia(target: { kind: SeerrKind; tmdbId: number } | undefined) {
  const config = useSeerrConfig()
  return useQuery({
    queryKey: ['seerr', config?.url, 'media', target?.kind, target?.tmdbId],
    queryFn: async () => toMedia(target?.kind ?? 'tv', await call<DetailsDto>(config ?? NONE, `${target?.kind}/${target?.tmdbId}`)),
    enabled: !!config && !!target,
    staleTime: 60_000,
    retry,
  })
}

/** encodeURIComponent leaves !'()* alone, which Seerr's search rejects. */
const encodeQuery = (q: string) => encodeURIComponent(q).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/** Best title search hit (preferring `kind`), for shows the id mapping doesn't cover. Null = nothing found. */
export function useSeerrSearch(query: string | undefined, kind: SeerrKind) {
  const config = useSeerrConfig()
  return useQuery({
    queryKey: ['seerr', config?.url, 'search', query, kind],
    queryFn: async () => {
      const data = await call<SearchDto>(config ?? NONE, `search?query=${encodeQuery(query ?? '')}`)
      const hits = (data.results ?? []).filter((r) => r.id && (r.mediaType === 'tv' || r.mediaType === 'movie'))
      const hit = hits.find((r) => r.mediaType === kind) ?? hits[0]
      return hit?.id ? { kind: hit.mediaType as SeerrKind, tmdbId: hit.id } : null
    },
    enabled: !!config && !!query,
    staleTime: 10 * 60_000,
    retry,
  })
}

/** Movies and shows matching the search text (people dropped), page by page (20 per page). */
export function useSeerrSearchResults(query: string) {
  const config = useSeerrConfig()
  return useInfiniteQuery({
    queryKey: ['seerr', config?.url, 'searchResults', query],
    queryFn: async ({ pageParam }) => {
      const data = await call<SearchDto>(config ?? NONE, `search?query=${encodeQuery(query)}&page=${pageParam}`)
      return {
        results: (data.results ?? []).flatMap((r) => (r.id && (r.mediaType === 'tv' || r.mediaType === 'movie') ? [toResult(r.mediaType, r)] : [])),
        next: (data.page ?? 1) < (data.totalPages ?? 1) ? (data.page ?? 1) + 1 : undefined,
      }
    },
    initialPageParam: 1,
    getNextPageParam: (last) => last.next,
    enabled: !!config && query.length >= 2,
    staleTime: 60_000,
    retry,
  })
}

/** The profile's latest requests (newest first); their titles and posters come from useSeerrMedia per tile. */
export function useMyRequests(seerrUserId: number | undefined) {
  const config = useSeerrConfig()
  return useQuery({
    queryKey: ['seerr', config?.url, 'myRequests', seerrUserId],
    queryFn: async () => {
      const data = await call<RequestListDto>(config ?? NONE, `request?requestedBy=${seerrUserId}&take=30&sort=added`)
      return (data.results ?? []).flatMap((r): SeerrRequestEntry[] => {
        const kind = r.media?.mediaType
        if (!r.id || !r.media?.tmdbId || (kind !== 'tv' && kind !== 'movie')) return []
        // Availability first (it arrived), else where the request stands (declined / failed: shown as not requested).
        const available = mediaStatus(r.is4k ? r.media.status4k : r.media.status)
        const status = available === 'available' || available === 'partial' ? available : requestStatus(r.status)
        return [{ id: r.id, kind, tmdbId: r.media.tmdbId, status, is4k: !!r.is4k, requestedAt: r.createdAt ?? '' }]
      })
    },
    enabled: !!config && seerrUserId !== undefined,
    staleTime: 60_000,
    retry,
  })
}

/** Seerr's Sonarr (TV) or Radarr (movie) servers, HD and 4K. `connection`: another (unsaved) config, null = off. */
export function useSeerrServers(kind: SeerrKind, connection?: Connection | null) {
  const own = useSeerrConfig()
  const config = connection === undefined ? own : connection
  return useQuery({
    queryKey: ['seerr', config?.url, config?.apiKey, 'servers', kind],
    queryFn: async () =>
      (await call<ServerDto[]>(config ?? NONE, `service/${kind === 'tv' ? 'sonarr' : 'radarr'}`)).flatMap((s): SeerrServer[] =>
        s.id === undefined
          ? []
          : [
              {
                id: s.id,
                name: s.name || `Server ${s.id}`,
                is4k: !!s.is4k,
                isDefault: !!s.isDefault,
                profileId: s.activeProfileId,
                rootFolder: s.activeDirectory,
                animeProfileId: s.activeAnimeProfileId ?? undefined,
                animeRootFolder: s.activeAnimeDirectory || undefined,
              },
            ],
      ),
    enabled: !!config,
    staleTime: 10 * 60_000,
    retry,
  })
}

/** Quality profiles and root folders of one server (for the request panel). */
export function useSeerrServerOptions(kind: SeerrKind, serverId: number | undefined) {
  const config = useSeerrConfig()
  return useQuery({
    queryKey: ['seerr', config?.url, 'serverOptions', kind, serverId],
    queryFn: async (): Promise<SeerrServerOptions> => {
      const data = await call<ServerDetailsDto>(config ?? NONE, `service/${kind === 'tv' ? 'sonarr' : 'radarr'}/${serverId}`)
      return {
        profiles: (data.profiles ?? []).flatMap((p) => (p.id !== undefined && p.name ? [{ id: p.id, name: p.name }] : [])),
        rootFolders: (data.rootFolders ?? []).flatMap((f) => (f.path ? [f.path] : [])),
      }
    },
    enabled: !!config && serverId !== undefined,
    staleTime: 10 * 60_000,
    retry,
  })
}

/** The signed-in profile's Seerr user id; null when Seerr has no user for this Jellyfin user (not imported). */
export function useSeerrUser() {
  const config = useSeerrConfig()
  const { account } = useSignedIn()
  return useQuery({
    queryKey: ['seerr', config?.url, 'user', account.userId],
    queryFn: () => findSeerrUser(config ?? NONE, account.userId),
    enabled: !!config,
    staleTime: 10 * 60_000,
    retry,
  })
}

async function findSeerrUser(config: Connection, jellyfinUserId: string): Promise<{ id: number; name: string } | null> {
  try {
    const user = await call<UserDto>(config, `user/jellyfin/${jellyfinUserId}`)
    return user.id ? { id: user.id, name: user.displayName || user.jellyfinUsername || user.username || '' } : null
  } catch (error) {
    if (error instanceof SeerrApiError && error.status === 404) return null
    throw error
  }
}

export type SeerrRequestInput = {
  kind: SeerrKind
  tmdbId: number
  seasons?: number[]
  userId: number
  is4k: boolean
  serverId?: number
  profileId?: number
  rootFolder?: string
}

/**
 * Requests a movie, or seasons of a show, as the given Seerr user, to the chosen server. Resolves to whether Seerr
 * kept the server (it ignores the choice for users without "Advanced requests").
 */
export function useSeerrRequest() {
  const config = useSeerrConfig()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ kind, tmdbId, seasons, ...rest }: SeerrRequestInput) => {
      const created = await call<RequestDto>(config ?? NONE, 'request', {
        mediaType: kind,
        mediaId: tmdbId,
        ...(kind === 'tv' && { seasons }),
        ...rest,
      })
      return { serverKept: rest.serverId === undefined || created.serverId == null || created.serverId === rest.serverId }
    },
    // The title's state shows in its details, search results and the request list.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['seerr', config?.url] }),
  })
}

// --- Administration: who may request ------------------------------------------------

/** The Seerr config stored in each user's prefs (admins only). */
export function useUsersSeerrConfig(userIds: readonly string[]) {
  const { server, account } = useSignedIn()
  return useQueries({
    queries: userIds.map((userId) => ({
      queryKey: ['user', account.userId, 'seerrOf', userId],
      queryFn: async () => (await fetchProfilePrefs(server, account, userId)).seerr,
      staleTime: 60_000,
    })),
    combine: (results) => ({
      data: results.some((r) => r.isPending) ? undefined : results.map((r) => r.data),
      error: results.find((r) => r.error)?.error ?? null,
    }),
  })
}

/** Writes the config into a user's prefs (empty = no requests); the own profile's through its synced prefs. */
export function useSaveUserSeerrConfig() {
  const { server, account } = useSignedIn()
  const own = usePref('seerr')
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, config }: { userId: string; config: SeerrConfig }) => {
      if (userId === account.userId) own.update(config)
      else await writeProfilePrefs(server, account, { seerr: config }, userId)
    },
    onSuccess: (_data, { userId, config }) => queryClient.setQueryData(['user', account.userId, 'seerrOf', userId], config),
  })
}

/** Whether each Jellyfin user exists in Seerr (checked with the given, possibly unsaved config). */
export function useSeerrUserLinks(config: Connection | undefined, userIds: readonly string[]) {
  return useQueries({
    queries: userIds.map((userId) => ({
      queryKey: ['seerr', config?.url, config?.apiKey, 'user', userId],
      queryFn: () => findSeerrUser(config ?? NONE, userId),
      enabled: !!config,
      staleTime: 60_000,
      retry,
    })),
    combine: (results) => results.map((r) => r.data),
  })
}
