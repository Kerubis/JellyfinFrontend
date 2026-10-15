import { ImageType, ItemFields } from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi, getShowApi, getUserDataApi } from '@jellyfin/sdk/lib/utils/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { pickNextEpisode, pickSeasonEpisode } from '@/domain/currentlyWatching'
import type { EpisodeRef } from '@/domain/media'
import type { EpisodeDetails, Season, SeriesDetails } from '@/domain/series'
import { apiFor } from '../client'
import { toEpisodeDetails, toSeason, toSeriesDetails } from '../mappers'
import { useSignedIn } from '../session-context'
import { useWatchData, watchKeys } from './home'

const MINUTE = 60_000

export function useSeriesDetails(seriesId: string) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'series', seriesId, 'details'],
    staleTime: 10 * MINUTE,
    queryFn: async (): Promise<SeriesDetails> => {
      const { data } = await getLibraryApi(apiFor(server.url, account.accessToken)).getItem({
        itemId: seriesId,
        userId: account.userId,
      })
      return toSeriesDetails(server, data)
    },
  })
}

export function useSeasons(seriesId: string) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'series', seriesId, 'seasons'],
    staleTime: 10 * MINUTE,
    queryFn: async (): Promise<Season[]> => {
      const { data } = await getShowApi(apiFor(server.url, account.accessToken)).getSeasons({
        seriesId,
        userId: account.userId,
        isMissing: false,
        enableImageTypes: [ImageType.Primary],
        imageTypeLimit: 1,
      })
      return (data.Items ?? []).map((dto) => toSeason(server, dto))
    },
  })
}

export function useSeasonEpisodes(seriesId: string, seasonId: string | undefined) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'series', seriesId, 'episodes', seasonId],
    enabled: !!seasonId,
    staleTime: 2 * MINUTE,
    queryFn: async (): Promise<EpisodeDetails[]> => {
      const { data } = await getShowApi(apiFor(server.url, account.accessToken)).getEpisodes({
        seriesId,
        seasonId,
        userId: account.userId,
        isMissing: false,
        fields: [ItemFields.Overview],
        enableImageTypes: [ImageType.Primary],
        imageTypeLimit: 1,
      })
      return (data.Items ?? []).flatMap((dto) => toEpisodeDetails(server, dto) ?? [])
    },
  })
}

export type SeasonWatchState = { played: EpisodeRef[]; unplayed: EpisodeRef[] }

function groupBySeason(done: readonly EpisodeRef[], todo: readonly EpisodeRef[]): Map<number | undefined, SeasonWatchState> {
  const map = new Map<number | undefined, SeasonWatchState>()
  const entry = (n: number | undefined) => {
    let state = map.get(n)
    if (!state) map.set(n, (state = { played: [], unplayed: [] }))
    return state
  }
  for (const e of done) entry(e.seasonNumber).played.push(e)
  for (const e of todo) entry(e.seasonNumber).unplayed.push(e)
  return map
}

/**
 * Watched state for one series, from the server-filtered played/unplayed lists (D15) instead of the
 * episode list's UserData, which can be wrong. Shared with the home page cache.
 */
export function useSeriesWatchState(seriesId: string) {
  const { played, unplayed, isPending } = useWatchData()
  return useMemo(() => {
    const done = (played ?? []).filter((e) => e.seriesId === seriesId)
    const todo = (unplayed ?? []).filter((e) => e.seriesId === seriesId)
    return {
      isPending,
      playedIds: new Set(done.map((e) => e.id)),
      playedCount: done.length,
      totalCount: done.length + todo.length,
      bySeason: groupBySeason(done, todo),
      next: todo.length > 0 ? pickNextEpisode(done, todo) : undefined,
      /** What "play" on the series starts: the next episode, or the first one when all are watched. */
      playTarget: todo.length > 0 ? pickNextEpisode(done, todo) : pickSeasonEpisode(done, []),
    }
  }, [played, unplayed, isPending, seriesId])
}

type SetPlayedInput = {
  /** Episode or season id; marking a season marks all its episodes on the server. */
  itemId: string
  played: boolean
  /** The episodes affected, to update the cached lists right away. */
  episodes: readonly EpisodeRef[]
}

const strip = (e: EpisodeRef): EpisodeRef => ({
  id: e.id,
  name: e.name,
  seriesId: e.seriesId,
  seasonNumber: e.seasonNumber,
  episodeNumber: e.episodeNumber,
  premiereDate: e.premiereDate,
  dateCreated: e.dateCreated,
})

/** Mark watched / unwatched, with an optimistic update of the watch-state lists. */
export function useSetPlayed() {
  const { server, account } = useSignedIn()
  const queryClient = useQueryClient()
  const keys = watchKeys(account.userId)

  return useMutation({
    mutationFn: async ({ itemId, played }: SetPlayedInput) => {
      const api = getUserDataApi(apiFor(server.url, account.accessToken))
      const params = { itemId, userId: account.userId }
      await (played ? api.markPlayedItem(params) : api.markUnplayedItem(params))
    },
    onMutate: async ({ played, episodes }) => {
      await Promise.all([queryClient.cancelQueries({ queryKey: keys.played }), queryClient.cancelQueries({ queryKey: keys.unplayed })])
      const before = {
        played: queryClient.getQueryData<EpisodeRef[]>(keys.played),
        unplayed: queryClient.getQueryData<EpisodeRef[]>(keys.unplayed),
      }
      const ids = new Set(episodes.map((e) => e.id))
      const moved = episodes.map(strip)
      const without = (list: EpisodeRef[] | undefined) => (list ?? []).filter((e) => !ids.has(e.id))
      queryClient.setQueryData<EpisodeRef[]>(keys.played, (list) => (played ? [...without(list), ...moved] : without(list)))
      queryClient.setQueryData<EpisodeRef[]>(keys.unplayed, (list) => (played ? without(list) : [...without(list), ...moved]))
      return before
    },
    onError: (_error, _input, before) => {
      if (!before) return
      queryClient.setQueryData(keys.played, before.played)
      queryClient.setQueryData(keys.unplayed, before.unplayed)
    },
    onSettled: (_data, _error, { episodes }) => {
      // Small lists; the big played/unplayed lists catch up on their own refresh interval.
      void queryClient.invalidateQueries({ queryKey: keys.resumable })
      void queryClient.invalidateQueries({ queryKey: keys.recentlyPlayed })
      const seriesId = episodes[0]?.seriesId
      if (seriesId) void queryClient.invalidateQueries({ queryKey: ['user', account.userId, 'series', seriesId, 'episodes'] })
    },
  })
}
