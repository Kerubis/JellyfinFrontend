import { useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import { usePref } from '@/api/prefs-context'
import { useLibraries } from '@/api/queries/libraries'
import { useLibraryFilters, useLibraryItems, useLibraryLetters } from '@/api/queries/library'
import { CardGrid } from '@/components/cards'
import { DEFAULT_ORDER, libraryQueryParams, parseLibraryQuery, type LibraryQuery } from '@/domain/libraryQuery'
import { MediaItemCard } from '@/features/media/MediaItemCard'
import { useInView } from '@/hooks/useInView'
import { AlphaRail } from './AlphaRail'
import { useJumpToIndex } from './useJumpToIndex'
import { useVisibleRange } from './useVisibleRange'

const SORT_LABELS: Record<LibraryQuery['sort'], string> = {
  name: 'Name',
  added: 'Date added',
  year: 'Year',
  rating: 'Rating',
  played: 'Last played',
}

const SELECT =
  'rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm focus:border-accent-500 focus:outline-none'

export function LibraryPage() {
  const { libraryId } = useParams()
  const [params, setParams] = useSearchParams()
  const { cardSize } = usePref('ui').value
  const libraries = useLibraries()
  const library = libraries.data?.find((l) => l.id === libraryId)
  const query = parseLibraryQuery(params)
  const items = useLibraryItems(library, query)
  const filters = useLibraryFilters(library)
  const letters = useLibraryLetters(library, query)

  const update = (patch: Partial<LibraryQuery>) => setParams(libraryQueryParams({ ...query, ...patch }), { replace: true })

  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = items
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useInView(sentinel, loadMore, !!hasNextPage)

  const gridRef = useRef<HTMLDivElement>(null)
  const loaded = items.data?.pages.reduce((n, p) => n + p.items.length, 0) ?? 0
  const jumpTo = useJumpToIndex(gridRef, { loaded, hasNextPage, isFetchingNextPage, fetchNextPage })
  const visible = useVisibleRange(gridRef, loaded)

  if (libraries.isPending) return <p className="text-sm text-neutral-500">Loading…</p>
  if (!library) return <p className="text-sm text-neutral-500">Library not found.</p>

  const all = items.data?.pages.flatMap((p) => p.items) ?? []
  const total = items.data?.pages[0]?.total
  const showRail = query.sort === 'name' && all.length > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{library.name}</h1>
        {total !== undefined && <span className="text-xs text-neutral-500">{total}</span>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            aria-label="Sort by"
            className={SELECT}
            value={query.sort}
            onChange={(e) => {
              const sort = e.target.value as LibraryQuery['sort']
              update({ sort, order: DEFAULT_ORDER[sort] })
            }}
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={SELECT}
            title={query.order === 'asc' ? 'Ascending' : 'Descending'}
            onClick={() => update({ order: query.order === 'asc' ? 'desc' : 'asc' })}
          >
            {query.order === 'asc' ? '↑' : '↓'}
          </button>
          <select
            aria-label="Watched"
            className={SELECT}
            value={query.watched}
            onChange={(e) => update({ watched: e.target.value as LibraryQuery['watched'] })}
          >
            <option value="all">All</option>
            <option value="unwatched">Unwatched</option>
            <option value="watched">Watched</option>
          </select>
          <select aria-label="Genre" className={SELECT} value={query.genre ?? ''} onChange={(e) => update({ genre: e.target.value || undefined })}>
            <option value="">All genres</option>
            {filters.data?.genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            aria-label="Year"
            className={SELECT}
            value={query.year ?? ''}
            onChange={(e) => update({ year: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">All years</option>
            {filters.data?.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showRail && <AlphaRail index={letters.data} total={total ?? all.length} order={query.order} visible={visible} onJump={jumpTo} />}

      <div ref={gridRef}>
        {items.isPending ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : items.isError ? (
          <p className="text-sm text-red-400">{errorMessage(items.error)}</p>
        ) : all.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing matches these filters.</p>
        ) : (
          <CardGrid size={cardSize} variant="poster">
            {all.map((item) => (
              <MediaItemCard key={item.id} item={item} />
            ))}
          </CardGrid>
        )}
      </div>
      <div ref={sentinel} />
      {isFetchingNextPage && <p className="text-center text-xs text-neutral-500">Loading more…</p>}
    </div>
  )
}
