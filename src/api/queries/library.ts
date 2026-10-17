import { BaseItemKind, ImageType, ItemFields, ItemSortBy, SortOrder } from '@jellyfin/sdk/lib/generated-client/models'
import { getFilterApi, getLibraryApi } from '@jellyfin/sdk/lib/utils/api'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { Library } from '@/domain/library'
import { letterOf, type LibraryQuery } from '@/domain/libraryQuery'
import type { MediaItem } from '@/domain/media'
import { apiFor } from '../client'
import { toMediaItem } from '../mappers'
import { useSignedIn } from '../session-context'

const PAGE_SIZE = 120
const CARD_IMAGES = { enableImageTypes: [ImageType.Primary], imageTypeLimit: 1 }

/** Which item types a library's grid shows. */
function itemTypes(library: Library): BaseItemKind[] {
  switch (library.type) {
    case 'tvshows':
      return [BaseItemKind.Series]
    case 'movies':
      return [BaseItemKind.Movie]
    case 'boxsets':
      return [BaseItemKind.BoxSet]
    default:
      return [BaseItemKind.Series, BaseItemKind.Movie]
  }
}

function sortParams(library: Library, sort: LibraryQuery['sort'], order: LibraryQuery['order']) {
  const by: Record<LibraryQuery['sort'], ItemSortBy[]> = {
    name: [ItemSortBy.SortName],
    // For shows "added" means "got a new episode", which is what matters for weekly releases.
    added: [library.type === 'tvshows' ? ItemSortBy.DateLastContentAdded : ItemSortBy.DateCreated, ItemSortBy.SortName],
    year: [ItemSortBy.ProductionYear, ItemSortBy.PremiereDate, ItemSortBy.SortName],
    rating: [ItemSortBy.CommunityRating, ItemSortBy.SortName],
    played: [ItemSortBy.DatePlayed, ItemSortBy.SortName],
  }
  return { sortBy: by[sort], sortOrder: [order === 'asc' ? SortOrder.Ascending : SortOrder.Descending] }
}

/** Filters shared by the grid and its letter index, so both see the same items in the same order. */
function itemFilters(library: Library, query: LibraryQuery) {
  return {
    parentId: library.id,
    recursive: true,
    includeItemTypes: itemTypes(library),
    ...sortParams(library, query.sort, query.order),
    isPlayed: query.watched === 'all' ? undefined : query.watched === 'watched',
    genres: query.genre ? [query.genre] : undefined,
    years: query.year ? [query.year] : undefined,
  }
}

/** Library grid content, loaded in pages as the user scrolls. */
export function useLibraryItems(library: Library | undefined, query: LibraryQuery) {
  const { server, account } = useSignedIn()
  return useInfiniteQuery({
    queryKey: ['user', account.userId, 'libraryItems', library?.id, query],
    enabled: !!library,
    staleTime: 2 * 60_000,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<{ items: MediaItem[]; total: number; next?: number }> => {
      if (!library) return { items: [], total: 0 }
      const { data } = await getLibraryApi(apiFor(server.url, account.accessToken)).getItems({
        userId: account.userId,
        ...itemFilters(library, query),
        startIndex: pageParam,
        limit: PAGE_SIZE,
        fields: [ItemFields.DateCreated, ItemFields.ChildCount],
        ...CARD_IMAGES,
      })
      const items = (data.Items ?? []).map((dto) => toMediaItem(server, dto))
      const total = data.TotalRecordCount ?? items.length
      const next = pageParam + items.length
      return { items, total, next: items.length > 0 && next < total ? next : undefined }
    },
    getNextPageParam: (last) => last.next,
  })
}

/**
 * A–Z index for a name-sorted grid: letter → position of its first item. Loads every item's sort name
 * in one request (no images or user data, ~0.5 KB per item), which is fine at library sizes in the thousands.
 */
export function useLibraryLetters(library: Library | undefined, query: LibraryQuery) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'libraryLetters', library?.id, query],
    enabled: !!library && query.sort === 'name',
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const index = new Map<string, number>()
      if (!library) return index
      const { data } = await getLibraryApi(apiFor(server.url, account.accessToken)).getItems({
        userId: account.userId,
        ...itemFilters(library, query),
        fields: [ItemFields.SortName],
        enableImages: false,
        enableUserData: false,
      })
      ;(data.Items ?? []).forEach((dto, i) => {
        const letter = letterOf(dto.SortName ?? dto.Name ?? '')
        if (!index.has(letter)) index.set(letter, i)
      })
      return index
    },
  })
}

/** Genres and years available in a library, for the filter dropdowns. */
export function useLibraryFilters(library: Library | undefined) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'libraryFilters', library?.id],
    enabled: !!library,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (!library) return { genres: [], years: [] }
      const { data } = await getFilterApi(apiFor(server.url, account.accessToken)).getQueryFiltersLegacy({
        userId: account.userId,
        parentId: library.id,
        includeItemTypes: itemTypes(library),
      })
      return {
        genres: [...(data.Genres ?? [])].sort((a, b) => a.localeCompare(b)),
        years: [...(data.Years ?? [])].sort((a, b) => b - a),
      }
    },
  })
}

/** Title search across all libraries: shows/movies and episodes separately (episodes would crowd the rest out). */
export function useSearch(term: string) {
  const { server, account } = useSignedIn()
  const trimmed = term.trim()
  const run = (types: BaseItemKind[], limit: number) => async (): Promise<MediaItem[]> => {
    const { data } = await getLibraryApi(apiFor(server.url, account.accessToken)).getItems({
      userId: account.userId,
      recursive: true,
      searchTerm: trimmed,
      includeItemTypes: types,
      limit,
      fields: [ItemFields.DateCreated, ItemFields.ChildCount],
      enableTotalRecordCount: false,
      ...CARD_IMAGES,
    })
    return (data.Items ?? []).map((dto) => toMediaItem(server, dto))
  }
  const enabled = trimmed.length >= 2
  const titles = useQuery({
    queryKey: ['user', account.userId, 'search', 'titles', trimmed],
    enabled,
    staleTime: 60_000,
    queryFn: run([BaseItemKind.Series, BaseItemKind.Movie, BaseItemKind.BoxSet], 60),
  })
  const episodes = useQuery({
    queryKey: ['user', account.userId, 'search', 'episodes', trimmed],
    enabled,
    staleTime: 60_000,
    queryFn: run([BaseItemKind.Episode], 30),
  })
  return { enabled, titles, episodes }
}
