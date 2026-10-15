import { ImageType } from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api'
import { useQuery } from '@tanstack/react-query'
import type { MediaItem } from '@/domain/media'
import { apiFor } from '../client'
import { toMediaItem } from '../mappers'
import { useSignedIn } from '../session-context'

/** Looks up items by id (any type), e.g. to show names for ids stored in prefs. */
export function useItemsByIds(ids: readonly string[]) {
  const { server, account } = useSignedIn()
  const sorted = [...ids].sort()
  return useQuery({
    queryKey: ['user', account.userId, 'itemsByIds', sorted],
    enabled: sorted.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<MediaItem[]> => {
      const { data } = await getLibraryApi(apiFor(server.url, account.accessToken)).getItems({
        userId: account.userId,
        ids: sorted,
        enableImageTypes: [ImageType.Primary],
        imageTypeLimit: 1,
        enableUserData: false,
        enableTotalRecordCount: false,
      })
      return (data.Items ?? []).map((dto) => toMediaItem(server, dto))
    },
  })
}
