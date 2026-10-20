import {
  BaseItemKind,
  ImageType,
  ItemFields,
  ItemFilter,
  ItemSortBy,
  LocationType,
  SortOrder,
} from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi, getUserViewApi } from '@jellyfin/sdk/lib/utils/api'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Server, SignedInAccount } from '@/domain/auth'
import { buildHomeSections, type NewEpisodesGroup, type WatchingEntry } from '@/domain/currentlyWatching'
import type { EpisodeRef, MediaItem } from '@/domain/media'
import { apiFor } from '../client'
import { toEpisodeRef, toMediaItem } from '../mappers'
import { usePref } from '../prefs-context'
import { useSignedIn } from '../session-context'

const MINUTE = 60_000
const CARD_IMAGES = { enableImageTypes: [ImageType.Primary, ImageType.Thumb, ImageType.Backdrop], imageTypeLimit: 1 }

const libraryApi = (server: Server, account: SignedInAccount) => getLibraryApi(apiFor(server.url, account.accessToken))

// --- Watch state ---------------------------------------------------------------
// Verified on the server (12.2.0): the series-level UnplayedItemCount/PlayedPercentage and the UserData
// embedded in list responses can be wrong for some items, while the server-side IsPlayed filter matches
// the item's real state. So watch state comes from two filtered episode lists, not from series counts.

async function fetchEpisodeRefs(server: Server, account: SignedInAccount, played: boolean): Promise<EpisodeRef[]> {
  const { data } = await libraryApi(server, account).getItems({
    userId: account.userId,
    includeItemTypes: [BaseItemKind.Episode],
    recursive: true,
    isPlayed: played,
    excludeLocationTypes: [LocationType.Virtual],
    fields: [ItemFields.DateCreated],
    enableImages: false,
    enableUserData: false,
    enableTotalRecordCount: false,
  })
  return (data.Items ?? []).flatMap((dto) => toEpisodeRef(dto) ?? [])
}

/** All series, for names and images. */
async function fetchSeriesCatalog(server: Server, account: SignedInAccount): Promise<Map<string, MediaItem>> {
  const { data } = await libraryApi(server, account).getItems({
    userId: account.userId,
    includeItemTypes: [BaseItemKind.Series],
    recursive: true,
    fields: [ItemFields.ChildCount],
    enableUserData: false,
    enableTotalRecordCount: false,
    ...CARD_IMAGES,
  })
  return new Map((data.Items ?? []).map((dto) => [dto.Id ?? '', toMediaItem(server, dto)]))
}

/** Query keys of the watch-state lists, shared with mutations that update them optimistically. */
export const watchKeys = (userId: string) => ({
  played: ['user', userId, 'episodes', 'played'],
  unplayed: ['user', userId, 'episodes', 'unplayed'],
  resumable: ['user', userId, 'resumable'],
  recentlyPlayed: ['user', userId, 'recentlyPlayed'],
})

export function useWatchData() {
  const { server, account } = useSignedIn()
  const user = account.userId
  const keys = watchKeys(user)
  const played = useQuery({
    queryKey: keys.played,
    queryFn: () => fetchEpisodeRefs(server, account, true),
    staleTime: 5 * MINUTE,
    refetchInterval: 15 * MINUTE,
  })
  // New episodes arrive here; refreshed periodically so an always-on screen stays current.
  const unplayed = useQuery({
    queryKey: keys.unplayed,
    queryFn: () => fetchEpisodeRefs(server, account, false),
    staleTime: MINUTE,
    refetchInterval: 5 * MINUTE,
  })
  const catalog = useSeriesCatalog()
  const resumable = useQuery({
    queryKey: keys.resumable,
    queryFn: () => fetchResumable(server, account),
    staleTime: MINUTE,
    refetchInterval: 5 * MINUTE,
  })
  return {
    played: played.data,
    unplayed: unplayed.data,
    catalog: catalog.data,
    resumable: resumable.data,
    /** "Now" for the NEW window: when the unplayed list was fetched (keeps rendering pure). */
    fetchedAt: unplayed.dataUpdatedAt,
    isPending: played.isPending || unplayed.isPending || catalog.isPending || resumable.isPending,
    error: played.error ?? unplayed.error ?? catalog.error ?? resumable.error,
  }
}

/** Every series as a media item by id (names, images, counts); shared with the schedule page. */
export function useSeriesCatalog() {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'seriesCatalog'],
    queryFn: () => fetchSeriesCatalog(server, account),
    staleTime: 10 * MINUTE,
  })
}

/** For series entries `series` holds the series' names and images. */
export type WatchingItem = { entry: WatchingEntry; series: MediaItem | undefined }

/** All three home sections from one pass over the watch state (§3.9); shared by the section hooks. */
function useHomeSections(newBadgeDays: number) {
  const data = useWatchData()
  // The Currently Watching sort key: when something of each show / movie was last watched.
  const recent = useRecentlyPlayed(true)
  const { hidden } = usePref('watching').value
  const { played, unplayed, resumable, fetchedAt } = data
  const recentlyPlayed = recent.data
  const sections = useMemo(() => {
    if (!played || !unplayed || !resumable || !recentlyPlayed) return undefined
    const removed = new Set(hidden.map((h) => h.id))
    return buildHomeSections({ played, unplayed, resumable, recentlyPlayed, removed, now: fetchedAt, newWithinDays: newBadgeDays })
  }, [played, unplayed, resumable, recentlyPlayed, hidden, fetchedAt, newBadgeDays])
  return { sections, catalog: data.catalog, isPending: data.isPending || recent.isPending, error: data.error ?? recent.error }
}

/** Currently Watching: play positions and started, unfinished shows, minus what was removed. */
export function useCurrentlyWatching(newBadgeDays: number) {
  const { sections, catalog, isPending, error } = useHomeSections(newBadgeDays)
  const items = useMemo<WatchingItem[]>(
    () => (sections?.watching ?? []).map((entry) => ({ entry, series: entry.kind === 'series' ? catalog?.get(entry.seriesId) : undefined })),
    [sections, catalog],
  )
  return { items, isPending, error }
}

export type NewEpisodeItem = { group: NewEpisodesGroup; series: MediaItem | undefined; isNew: boolean }

/**
 * New Episodes: started, unfinished shows removed from Currently Watching, one group per show, newest episode
 * first. `withinDays` keeps only episodes added in that window (a show without any drops out); undefined = all.
 */
export function useNewEpisodes(withinDays: number | undefined, newBadgeDays: number) {
  const { sections, catalog, isPending, error } = useHomeSections(newBadgeDays)
  const { fetchedAt } = useWatchData()
  const items = useMemo<NewEpisodeItem[]>(() => {
    const since = withinDays === undefined ? '' : new Date(fetchedAt - withinDays * 86_400_000).toISOString()
    return (sections?.newEpisodes ?? []).flatMap((group) => {
      const episodes = group.episodes.filter((e) => (e.dateCreated ?? '') >= since)
      return episodes.length > 0 ? [{ group: { ...group, episodes }, series: catalog?.get(group.seriesId), isNew: group.isNew }] : []
    })
  }, [sections, catalog, withinDays, fetchedAt])
  return { items, isPending, error }
}

/**
 * Not watched, for one library: shows without any watched episode (not in Currently Watching) and unwatched movies
 * (a started movie only once removed from Currently Watching), newest added first.
 */
export function useNotWatched(libraryId: string, limit: number) {
  const { server, account } = useSignedIn()
  const { sections, catalog, isPending, error } = useHomeSections(7)
  const library = useQuery({
    queryKey: ['user', account.userId, 'notWatchedLibrary', libraryId, limit],
    staleTime: 2 * MINUTE,
    refetchInterval: 10 * MINUTE,
    queryFn: async () => {
      const api = libraryApi(server, account)
      const [series, movies] = await Promise.all([
        // Which shows live in this library (ids only; names and images come from the catalog).
        api.getItems({
          userId: account.userId,
          parentId: libraryId,
          recursive: true,
          includeItemTypes: [BaseItemKind.Series],
          enableImages: false,
          enableUserData: false,
          enableTotalRecordCount: false,
        }),
        fetchItems(server, account, {
          parentId: libraryId,
          includeItemTypes: [BaseItemKind.Movie],
          isPlayed: false,
          sortBy: [ItemSortBy.DateCreated],
          sortOrder: [SortOrder.Descending],
          limit: limit > 0 ? limit : undefined,
        }),
      ])
      return { seriesIds: new Set((series.data.Items ?? []).flatMap((dto) => (dto.Id ? [dto.Id] : []))), movies }
    },
  })
  const items = useMemo(() => {
    if (!sections || !library.data) return []
    const inWatching = new Set(sections.watching.flatMap((e) => (e.kind === 'movie' ? [e.movie.id] : [])))
    const shows = sections.notWatched
      .filter((s) => library.data.seriesIds.has(s.seriesId))
      .flatMap((s) => {
        const series = catalog?.get(s.seriesId)
        return series ? [{ item: series, at: s.newestAt }] : []
      })
    const movies = library.data.movies.filter((m) => !inWatching.has(m.id)).map((m) => ({ item: m, at: m.dateCreated ?? '' }))
    const all = [...shows, ...movies].sort((a, b) => b.at.localeCompare(a.at)).map((x) => x.item)
    return limit > 0 ? all.slice(0, limit) : all
  }, [sections, library.data, catalog, limit])
  return { items, isPending: isPending || library.isPending, error: error ?? library.error }
}

/** Watch state of removed entries (exists? watched?), for cleaning up the removed list. */
export function useRemovedItemsState(ids: readonly string[]) {
  const { server, account } = useSignedIn()
  const sorted = [...ids].sort()
  return useQuery({
    queryKey: ['user', account.userId, 'removedState', sorted],
    enabled: sorted.length > 0,
    staleTime: 10 * MINUTE,
    queryFn: async () => {
      const { data } = await libraryApi(server, account).getItems({ userId: account.userId, ids: sorted, enableImages: false, enableTotalRecordCount: false })
      return (data.Items ?? []).map((dto) => toMediaItem(server, dto))
    },
  })
}

/**
 * The most recently played episodes/movies (any client): the Currently Watching sort order and un-hiding
 * what was watched again. 300 plays reach back far enough for every show still being watched; a show not
 * among them sorts as "watched long ago".
 */
export function useRecentlyPlayed(enabled: boolean) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: watchKeys(account.userId).recentlyPlayed,
    enabled,
    staleTime: MINUTE,
    refetchInterval: 5 * MINUTE,
    queryFn: () =>
      fetchItems(server, account, {
        includeItemTypes: [BaseItemKind.Episode, BaseItemKind.Movie],
        sortBy: [ItemSortBy.DatePlayed],
        sortOrder: [SortOrder.Descending],
        limit: 300,
        enableImages: false,
      }),
  })
}

// --- Simple item lists ---------------------------------------------------------

function fetchResumable(server: Server, account: SignedInAccount): Promise<MediaItem[]> {
  return fetchItems(server, account, {
    filters: [ItemFilter.IsResumable],
    includeItemTypes: [BaseItemKind.Episode, BaseItemKind.Movie],
    sortBy: [ItemSortBy.DatePlayed],
    sortOrder: [SortOrder.Descending],
  })
}

async function fetchItems(
  server: Server,
  account: SignedInAccount,
  params: Parameters<ReturnType<typeof getLibraryApi>['getItems']>[0],
): Promise<MediaItem[]> {
  const { data } = await libraryApi(server, account).getItems({
    userId: account.userId,
    recursive: true,
    fields: [ItemFields.DateCreated, ItemFields.ChildCount],
    enableTotalRecordCount: false,
    ...CARD_IMAGES,
    ...params,
  })
  return (data.Items ?? []).map((dto) => toMediaItem(server, dto))
}

const VIDEO_COLLECTIONS = new Set(['tvshows', 'movies', 'homevideos', 'musicvideos'])

/** The user's video libraries (shows, movies, home videos; mixed libraries have no collection type). */
async function videoLibraryIds(server: Server, account: SignedInAccount): Promise<string[]> {
  const { data } = await getUserViewApi(apiFor(server.url, account.accessToken)).getUserViews({ userId: account.userId })
  return (data.Items ?? [])
    .filter((v) => v.Id && (!v.CollectionType || VIDEO_COLLECTIONS.has(v.CollectionType)))
    .map((v) => v.Id ?? '')
}

async function fetchRecentlyAdded(
  server: Server,
  account: SignedInAccount,
  libraryIds: readonly string[],
  limit: number,
): Promise<MediaItem[]> {
  const api = libraryApi(server, account)
  // Verified on 12.2: /Items/Latest without parentId leaves out whole libraries (no movies at all),
  // so every video library is asked separately and the results are merged.
  const parents = libraryIds.length > 0 ? libraryIds : await videoLibraryIds(server, account)
  const lists = await Promise.all(
    parents.map(async (parentId) => {
      // Latest groups new episodes of one series into a single entry.
      const { data } = await api.getLatestMedia({
        userId: account.userId,
        parentId,
        limit,
        groupItems: true,
        fields: [ItemFields.DateCreated, ItemFields.DateLastMediaAdded, ItemFields.ChildCount],
        ...CARD_IMAGES,
      })
      return data.map((dto) => toMediaItem(server, dto))
    }),
  )
  return lists
    .flat()
    .sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''))
    .slice(0, limit)
}

export type ItemListKind = 'recentlyAdded' | 'favorites'

export function useItemList(kind: ItemListKind, limit: number, libraryIds: readonly string[] = []) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'list', kind, limit, [...libraryIds].sort()],
    staleTime: 2 * MINUTE,
    refetchInterval: kind === 'favorites' ? false : 10 * MINUTE,
    queryFn: (): Promise<MediaItem[]> => {
      switch (kind) {
        case 'recentlyAdded':
          return fetchRecentlyAdded(server, account, libraryIds, limit)
        case 'favorites':
          return fetchItems(server, account, {
            isFavorite: true,
            includeItemTypes: [BaseItemKind.Series, BaseItemKind.Movie],
            sortBy: [ItemSortBy.SortName],
            limit,
          })
      }
    },
  })
}
