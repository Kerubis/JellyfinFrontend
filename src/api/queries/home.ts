import {
  BaseItemKind,
  ImageType,
  ItemFields,
  ItemFilter,
  ItemSortBy,
  LocationType,
  SortOrder,
} from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Server, SignedInAccount } from '@/domain/auth'
import { buildCurrentlyWatching, entryId, unplayedBySeries, type NewEpisodesGroup, type WatchingEntry } from '@/domain/currentlyWatching'
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
  const catalog = useQuery({
    queryKey: ['user', user, 'seriesCatalog'],
    queryFn: () => fetchSeriesCatalog(server, account),
    staleTime: 10 * MINUTE,
  })
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

/** For series entries `series` holds the series' names and images. */
export type WatchingItem = { entry: WatchingEntry; series: MediaItem | undefined }

/** Started/followed, unfinished series and started movies, before the hidden list is applied. */
function useWatchingCandidates(newWithinDays: number) {
  const data = useWatchData()
  const { followed } = usePref('following').value
  const { played, unplayed, resumable, catalog, fetchedAt } = data
  const items = useMemo<WatchingItem[]>(() => {
    if (!played || !unplayed || !resumable) return []
    return buildCurrentlyWatching({ played, unplayed, resumable, followed, now: fetchedAt, newWithinDays }).map(
      (entry) => ({ entry, series: entry.kind === 'series' ? catalog?.get(entry.seriesId) : undefined }),
    )
  }, [played, unplayed, resumable, catalog, followed, newWithinDays, fetchedAt])
  return { items, isPending: data.isPending, error: data.error }
}

/** Currently Watching: the candidates minus what the user hid from it (`following.hidden`). */
export function useCurrentlyWatching(newWithinDays: number) {
  const candidates = useWatchingCandidates(newWithinDays)
  const { hidden } = usePref('following').value
  const items = useMemo(() => {
    const hiddenSet = new Set(hidden.map((h) => h.id))
    return candidates.items.filter(({ entry }) => !hiddenSet.has(entryId(entry)))
  }, [candidates.items, hidden])
  return { ...candidates, items }
}

export type NewEpisodeItem = { group: NewEpisodesGroup; series: MediaItem | undefined; isNew: boolean }

/**
 * Unwatched episodes of started or followed, unfinished series (incl. ones hidden from Currently Watching), one
 * group per series. `withinDays` limits it to recently added episodes; undefined shows all.
 */
export function useNewEpisodes(withinDays: number | undefined, newBadgeDays: number) {
  // Hidden shows stay here: hiding only removes them from Currently Watching.
  const watching = useWatchingCandidates(newBadgeDays)
  const { unplayed, catalog, fetchedAt } = useWatchData()
  const items = useMemo<NewEpisodeItem[]>(() => {
    if (!unplayed) return []
    const newSeries = new Set<string>()
    const seriesIds = new Set<string>()
    for (const { entry } of watching.items) {
      if (entry.kind !== 'series') continue
      seriesIds.add(entry.seriesId)
      if (entry.isNew) newSeries.add(entry.seriesId)
    }
    return unplayedBySeries(unplayed, seriesIds, fetchedAt, withinDays).map((group) => ({
      group,
      series: catalog?.get(group.seriesId),
      isNew: newSeries.has(group.seriesId),
    }))
  }, [unplayed, catalog, watching.items, withinDays, fetchedAt])
  return { items, isPending: watching.isPending, error: watching.error }
}

export function useFollowedSeries() {
  const { catalog, isPending, error } = useWatchData()
  const { followed } = usePref('following').value
  const items = useMemo(
    () => followed.flatMap((id) => catalog?.get(id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    [catalog, followed],
  )
  return { items, isPending, error }
}

/** The most recently played episodes/movies (any client), for un-hiding what was watched again. */
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
        limit: 50,
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
    fields: [ItemFields.DateCreated],
    enableTotalRecordCount: false,
    ...CARD_IMAGES,
    ...params,
  })
  return (data.Items ?? []).map((dto) => toMediaItem(server, dto))
}

async function fetchRecentlyAdded(
  server: Server,
  account: SignedInAccount,
  libraryIds: readonly string[],
  limit: number,
): Promise<MediaItem[]> {
  const api = libraryApi(server, account)
  const parents = libraryIds.length > 0 ? libraryIds : [undefined]
  const lists = await Promise.all(
    parents.map(async (parentId) => {
      // Latest groups new episodes of one series into a single entry.
      const { data } = await api.getLatestMedia({
        userId: account.userId,
        parentId,
        limit,
        groupItems: true,
        fields: [ItemFields.DateCreated],
        ...CARD_IMAGES,
      })
      return data.map((dto) => toMediaItem(server, dto))
    }),
  )
  return lists
    .flat()
    .sort((a, b) => (b.dateCreated ?? '').localeCompare(a.dateCreated ?? ''))
    .slice(0, limit)
}

export type ItemListKind = 'continueWatching' | 'recentlyAdded' | 'favorites' | 'unwatchedMovies'

export function useItemList(kind: ItemListKind, limit: number, libraryIds: readonly string[] = []) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'list', kind, limit, [...libraryIds].sort()],
    staleTime: 2 * MINUTE,
    refetchInterval: kind === 'favorites' ? false : 10 * MINUTE,
    queryFn: (): Promise<MediaItem[]> => {
      switch (kind) {
        case 'continueWatching':
          return fetchResumable(server, account).then((items) => items.slice(0, limit))
        case 'recentlyAdded':
          return fetchRecentlyAdded(server, account, libraryIds, limit)
        case 'favorites':
          return fetchItems(server, account, {
            isFavorite: true,
            includeItemTypes: [BaseItemKind.Series, BaseItemKind.Movie],
            sortBy: [ItemSortBy.SortName],
            limit,
          })
        case 'unwatchedMovies':
          return fetchItems(server, account, {
            includeItemTypes: [BaseItemKind.Movie],
            isPlayed: false,
            sortBy: [ItemSortBy.DateCreated],
            sortOrder: [SortOrder.Descending],
            limit,
          })
      }
    },
  })
}
