// AnimeSchedule.net API v3 (https://animeschedule.net/api/v3/documentation). The API sends no CORS headers, so
// requests go through a same-origin pass-through proxy (Vite in dev, nginx in the image). The app token is the
// profile's own (synced pref `animeSchedule`, Settings → Integrations). Rate limit: 120 requests per minute.

import { BaseItemKind, ItemFields } from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  buildLibraryIndex,
  findInLibrary,
  type AirType,
  type AiringStatus,
  type AnimeDetails,
  type Category,
  type LibrarySeries,
  type ScheduleEntry,
  type ScheduleStream,
} from '@/domain/schedule'
import { apiFor } from './client'
import { usePref } from './prefs-context'
import { useSignedIn } from './session-context'

const BASE = '/animeschedule'
const IMAGE_BASE = 'https://img.animeschedule.net/production/assets/public/img/'

export class ScheduleApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(
      status === 401 || status === 403
        ? 'AnimeSchedule rejected the token (check ANIMESCHEDULE_TOKEN).'
        : status === 429
          ? 'AnimeSchedule rate limit reached, try again in a minute.'
          : `AnimeSchedule request failed (${status}).`,
    )
    this.status = status
  }
}

async function get<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new ScheduleApiError(response.status)
  return (await response.json()) as T
}

/** Client errors (bad token, unknown show) won't fix themselves; only retry the rest. */
const retry = (failures: number, error: Error) =>
  !(error instanceof ScheduleApiError && error.status >= 400 && error.status < 500) && failures < 2

// Field types per the docs; everything is optional because null fields are often left out.
type StreamDto = { platform?: string; name?: string; url?: string }
type CategoryDto = { name?: string; route?: string }

type TimetableDto = {
  title?: string
  route?: string
  romaji?: string
  english?: string
  native?: string
  delayedText?: string
  episodeDate?: string
  episodeNumber?: number
  subtractedEpisodeNumber?: number
  episodes?: number
  lengthMin?: number
  donghua?: boolean
  airType?: string
  mediaTypes?: CategoryDto[]
  imageVersionRoute?: string
  // Documented as `{ platform, url, name }`; accept a list or a platform → url map too.
  streams?: StreamDto | StreamDto[] | Record<string, string>
  airingStatus?: string
}

type AnimeDto = {
  title?: string
  route?: string
  names?: { english?: string; native?: string; synonyms?: string[] }
  description?: string
  imageVersionRoute?: string
  status?: string
  season?: { title?: string }
  episodes?: number
  lengthMin?: number
  premier?: string
  subPremier?: string
  dubPremier?: string
  genres?: CategoryDto[]
  studios?: CategoryDto[]
  sources?: CategoryDto[]
  mediaTypes?: CategoryDto[]
  websites?: {
    official?: string
    mal?: string
    aniList?: string
    kitsu?: string
    animePlanet?: string
    anidb?: string
    streams?: StreamDto[]
  }
}

/** The API's "no date" value. */
const NULL_DATE = '0001-01-01T00:00:00Z'
const date = (value: string | undefined) => (value && !value.startsWith('0001-') && value !== NULL_DATE ? value : undefined)

const image = (route: string | undefined) => (route ? IMAGE_BASE + route : undefined)

function toStreams(value: TimetableDto['streams']): ScheduleStream[] {
  if (!value) return []
  const list = Array.isArray(value)
    ? value
    : 'url' in value || 'platform' in value
      ? [value as StreamDto]
      : Object.entries(value as Record<string, string>).map(([platform, url]) => ({ platform, url, name: platform }))
  return list.flatMap((s) => (s.platform && s.url ? [{ platform: s.platform, url: absolute(s.url), name: s.name || s.platform }] : []))
}

const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url.replace(/^\/+/, '')}`)

const toCategories = (list: CategoryDto[] | undefined): Category[] =>
  (list ?? []).flatMap((c) => (c.name && c.route ? [{ name: c.name, route: c.route }] : []))

const AIRING: Record<string, AiringStatus> = { airing: 'airing', aired: 'aired', unaired: 'unaired', 'delayed-air': 'delayed' }

function toEntry(dto: TimetableDto): ScheduleEntry | null {
  const airsAt = date(dto.episodeDate)
  const airType = (['raw', 'sub', 'dub'] as const).find((t) => t === dto.airType)
  if (!dto.route || !dto.title || !airsAt || !airType) return null
  const episode = dto.episodeNumber ?? 0
  const from = dto.subtractedEpisodeNumber
  return {
    route: dto.route,
    title: dto.title,
    romaji: dto.romaji || undefined,
    english: dto.english || undefined,
    native: dto.native || undefined,
    airType,
    airsAt,
    episode,
    episodeFrom: from && from < episode ? from : undefined,
    episodes: dto.episodes ?? 0,
    lengthMin: dto.lengthMin ?? 0,
    donghua: dto.donghua === true,
    mediaTypes: toCategories(dto.mediaTypes).map((c) => c.route),
    streams: toStreams(dto.streams),
    status: AIRING[dto.airingStatus ?? ''] ?? 'unaired',
    delayedText: dto.delayedText || undefined,
    image: image(dto.imageVersionRoute),
  }
}

/** HTML description → plain text with line breaks (never rendered as HTML). */
function htmlToText(html: string | undefined): string | undefined {
  if (!html) return undefined
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n'), 'text/html')
  const text = doc.body.textContent?.replace(/\n{3,}/g, '\n\n').trim()
  return text || undefined
}

/** Website fields may be full URLs or bare ids. */
function link(value: string | undefined, idUrl: (id: string) => string): string | undefined {
  if (!value) return undefined
  if (/^\d+$/.test(value)) return idUrl(value)
  return absolute(value)
}

function toDetails(dto: AnimeDto, route: string): AnimeDetails {
  const w = dto.websites ?? {}
  const links = [
    { label: 'AnimeSchedule', url: `https://animeschedule.net/anime/${route}` },
    { label: 'Official site', url: link(w.official, (id) => id) },
    { label: 'MyAnimeList', url: link(w.mal, (id) => `https://myanimelist.net/anime/${id}`) },
    { label: 'AniList', url: link(w.aniList, (id) => `https://anilist.co/anime/${id}`) },
    { label: 'AniDB', url: link(w.anidb, (id) => `https://anidb.net/anime/${id}`) },
    { label: 'Kitsu', url: link(w.kitsu, (id) => `https://kitsu.app/anime/${id}`) },
    { label: 'Anime-Planet', url: link(w.animePlanet, (id) => id) },
  ].flatMap((l) => (l.url ? [{ label: l.label, url: l.url }] : []))
  return {
    route,
    title: dto.title ?? route,
    english: dto.names?.english || undefined,
    native: dto.names?.native || undefined,
    synonyms: dto.names?.synonyms ?? [],
    description: htmlToText(dto.description),
    image: image(dto.imageVersionRoute),
    status: dto.status || undefined,
    season: dto.season?.title || undefined,
    episodes: dto.episodes ?? 0,
    lengthMin: dto.lengthMin ?? 0,
    premier: date(dto.premier),
    subPremier: date(dto.subPremier),
    dubPremier: date(dto.dubPremier),
    genres: toCategories(dto.genres),
    studios: toCategories(dto.studios),
    sources: toCategories(dto.sources),
    mediaTypes: toCategories(dto.mediaTypes),
    streams: toStreams(w.streams),
    links,
    malId: idOf(w.mal),
    anilistId: idOf(w.aniList),
  }
}

/** The numeric id in a website field ("12345" or "myanimelist.net/anime/12345/…"). */
function idOf(value: string | undefined): number | undefined {
  const id = value && (/^\d+$/.test(value) ? value : /\/anime\/(\d+)/.exec(value)?.[1])
  return id ? Number(id) : undefined
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

async function fetchTimetable(token: string, year: number, week: number, airType: AirType | 'all'): Promise<ScheduleEntry[]> {
  const params = new URLSearchParams({ year: String(year), week: String(week), tz: timeZone() })
  const data = await get<TimetableDto[] | null>(token, `/timetables/${airType}?${params}`)
  return (data ?? []).flatMap((dto) => toEntry(dto) ?? [])
}

/**
 * All air types of the given ISO weeks, merged (a 7-day window that doesn't start on Monday spans two).
 * Filtering happens client-side, so the "hide raw when subbed" rules see every air type.
 */
export function useTimetable(weeks: readonly { year: number; week: number }[]) {
  const token = useScheduleToken()
  return useQueries({
    queries: weeks.map(({ year, week }) => ({
      queryKey: ['animeschedule', token, 'timetable', year, week],
      queryFn: () => fetchTimetable(token, year, week, 'all'),
      staleTime: 30 * 60_000,
      enabled: token !== '',
      retry,
    })),
    // Memoized by TanStack Query: a new result only when one of the queries changes.
    combine: (results) => {
      const isPending = results.some((r) => r.isPending)
      return {
        data: isPending ? undefined : results.flatMap((r) => r.data ?? []),
        error: results.find((r) => r.error)?.error ?? null,
        isPending,
      }
    },
  })
}

export function useAnimeDetails(route: string | null) {
  const token = useScheduleToken()
  return useQuery({ ...animeDetailsQuery(token, route ?? ''), enabled: token !== '' && route !== null })
}

const animeDetailsQuery = (token: string, route: string) => ({
  queryKey: ['animeschedule', token, 'anime', route],
  queryFn: async () => toDetails(await get<AnimeDto>(token, `/anime/${encodeURIComponent(route)}`), route),
  staleTime: 6 * 60 * 60_000,
  retry,
})

type AnimeListDto = { totalAmount?: number; anime?: AnimeDto[] }

/** Genre names of every currently airing show, by route (the list endpoint, 18 shows per page, ~10 pages). */
async function fetchAiringGenres(token: string): Promise<Map<string, string[]>> {
  const page = (n: number) => get<AnimeListDto>(token, `/anime?airing-statuses=ongoing&page=${n}`)
  const first = await page(1)
  const size = first.anime?.length || 1
  // Capped well below the rate limit (120 / min) in case the API ever reports something odd.
  const pages = Math.min(20, Math.ceil((first.totalAmount ?? 0) / size))
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => page(i + 2)))
  const genres = new Map<string, string[]>()
  for (const dto of [first, ...rest].flatMap((p) => p.anime ?? [])) {
    if (dto.route) genres.set(dto.route, toCategories(dto.genres).map((g) => g.name))
  }
  return genres
}

/**
 * Genre names of the given shows, by route, for the schedule search: the airing list, plus single lookups (shared
 * with the details popup) for shows that aren't airing anymore or yet (premieres, finales, other weeks). Only loads
 * while `enabled`; shows whose genres haven't loaded yet are simply missing.
 */
export function useScheduleGenres(routes: readonly string[], enabled: boolean): ReadonlyMap<string, readonly string[]> {
  const token = useScheduleToken()
  const airing = useQuery({
    queryKey: ['animeschedule', token, 'airingGenres'],
    queryFn: () => fetchAiringGenres(token),
    enabled: enabled && token !== '',
    staleTime: 6 * 60 * 60_000,
    retry,
  })
  const missing = airing.data ? routes.filter((r) => !airing.data.has(r)) : []
  const single = useQueries({
    queries: missing.map((route) => ({ ...animeDetailsQuery(token, route), enabled: enabled && token !== '' })),
    combine: (results) => results.map((r) => r.data),
  })
  return useMemo(() => {
    const genres = new Map(airing.data)
    for (const details of single) if (details) genres.set(details.route, details.genres.map((g) => g.name))
    return genres
  }, [airing.data, single])
}

/** The profile's AnimeSchedule app token; empty = schedule not set up. */
export function useScheduleToken(): string {
  return usePref('animeSchedule').value.token
}

/** Checks a token with one small request (this week's dub timetable). */
export async function checkScheduleToken(token: string): Promise<void> {
  await get<unknown>(token, `/timetables/dub?tz=${encodeURIComponent(timeZone())}`)
}

/**
 * Finds a show's series in the Jellyfin library by title (see findInLibrary). Undefined while the library list
 * loads. Pass every title the show has.
 */
export function useLibraryMatcher(): ((titles: readonly (string | undefined)[]) => LibrarySeries | undefined) | undefined {
  const { server, account } = useSignedIn()
  const series = useQuery({
    queryKey: ['user', account.userId, 'seriesTitles'],
    queryFn: async () => {
      const { data } = await getLibraryApi(apiFor(server.url, account.accessToken)).getItems({
        userId: account.userId,
        includeItemTypes: [BaseItemKind.Series],
        recursive: true,
        fields: [ItemFields.OriginalTitle],
        enableImages: false,
        enableUserData: false,
        enableTotalRecordCount: false,
      })
      return (data.Items ?? []).flatMap((dto): LibrarySeries[] =>
        dto.Id && dto.Name ? [{ id: dto.Id, name: dto.Name, originalTitle: dto.OriginalTitle ?? undefined }] : [],
      )
    },
    staleTime: 10 * 60_000,
  })
  return useMemo(() => {
    if (!series.data) return undefined
    const index = buildLibraryIndex(series.data)
    return (titles) => findInLibrary(index, titles)
  }, [series.data])
}
