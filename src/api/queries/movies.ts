import { getLibraryApi, getUserDataApi } from '@jellyfin/sdk/lib/utils/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MediaKind, MediaItem } from '@/domain/media'
import type { MovieDetails, Person } from '@/domain/movie'
import { apiFor, itemImageUrl } from '../client'
import { toMediaItem } from '../mappers'
import { toMediaTracks } from '../playback'
import { useSignedIn } from '../session-context'

const KINDS: Record<string, MediaKind> = { Movie: 'movie', Series: 'series', Season: 'season', Episode: 'episode' }
const PERSON_TYPES: Record<string, Person['type']> = { Actor: 'actor', GuestStar: 'actor', Director: 'director', Writer: 'writer' }

/** Detail data for the movie page (any item works; non-movies are redirected by the page). */
export function useMovie(itemId: string) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'movie', itemId],
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<MovieDetails> => {
      const { data } = await getLibraryApi(apiFor(server.url, account.accessToken)).getItem({ itemId, userId: account.userId })
      const source = data.MediaSources?.[0]
      return {
        id: itemId,
        kind: (data.Type && KINDS[data.Type]) ?? 'other',
        seriesId: data.SeriesId ?? undefined,
        name: data.Name ?? 'Untitled',
        year: data.ProductionYear ?? undefined,
        premiereDate: data.PremiereDate ?? undefined,
        runtimeTicks: data.RunTimeTicks ?? undefined,
        officialRating: data.OfficialRating ?? undefined,
        communityRating: data.CommunityRating ?? undefined,
        criticRating: data.CriticRating ?? undefined,
        genres: data.Genres ?? [],
        tagline: data.Taglines?.[0] ?? undefined,
        overview: data.Overview ?? undefined,
        posterUrl: itemImageUrl(server.url, itemId, data.ImageTags?.Primary, { maxWidth: 400 }),
        people: (data.People ?? []).map((p) => ({ name: p.Name ?? '', role: p.Role ?? undefined, type: PERSON_TYPES[p.Type ?? ''] ?? 'other' })),
        studios: (data.Studios ?? []).flatMap((s) => (s.Name ? [s.Name] : [])),
        played: !!data.UserData?.Played,
        isFavorite: !!data.UserData?.IsFavorite,
        positionTicks: data.UserData?.PlaybackPositionTicks ?? 0,
        tracks: source ? toMediaTracks(source) : { mediaSourceId: itemId, audio: [], subtitles: [] },
      }
    },
  })
}

/** "More like this". */
export function useSimilar(itemId: string) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'similar', itemId],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<MediaItem[]> => {
      const { data } = await getLibraryApi(apiFor(server.url, account.accessToken)).getSimilarItems({
        itemId,
        userId: account.userId,
        limit: 24,
      })
      return (data.Items ?? []).map((dto) => toMediaItem(server, dto))
    },
  })
}

export function useSetFavorite() {
  const { server, account } = useSignedIn()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, favorite }: { itemId: string; favorite: boolean }) => {
      const api = getUserDataApi(apiFor(server.url, account.accessToken))
      const params = { itemId, userId: account.userId }
      await (favorite ? api.markFavoriteItem(params) : api.unmarkFavoriteItem(params))
    },
    onSettled: (_data, _error, { itemId }) => {
      void queryClient.invalidateQueries({ queryKey: ['user', account.userId, 'movie', itemId] })
      void queryClient.invalidateQueries({ queryKey: ['user', account.userId, 'list', 'favorites'] })
    },
  })
}
