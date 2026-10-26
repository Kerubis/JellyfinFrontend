import { usePref } from '@/api/prefs-context'
import { useSeerrDiscover, useSeerrName } from '@/api/seerr'
import { Button } from '@/components/Button'
import { CardGrid } from '@/components/cards'
import { browseKinds, seerrRef, SORT_LABEL, type SeerrBrowse, type SeerrKind, type SeerrSort } from '@/domain/seerr'
import { ResultSection } from './ResultSection'
import { SeerrTile } from './SeerrTile'

type Open = (target: { kind: SeerrKind; tmdbId: number }) => void

const KIND_HEADING: Record<SeerrKind, string> = { tv: 'TV', movie: 'Movies' }

function NetworkChip({ id, onRemove }: { id: number; onRemove: () => void }) {
  const label = `Network: ${useSeerrName('network', id).data ?? '…'}`
  return (
    <span className="flex items-center gap-1 rounded bg-accent-700/40 py-0.5 pr-0.5 pl-2 text-xs text-accent-100 ring-1 ring-accent-600/60 ring-inset">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="rounded px-1 text-accent-200 hover:bg-accent-600 hover:text-white">
        ✕
      </button>
    </span>
  )
}

/** The network filter (set from the details popup; keywords and studios live in the search field) and the sort. */
export function BrowseBar({
  network,
  sort,
  onRemoveNetwork,
  onSort,
}: {
  network: number | undefined
  sort: SeerrSort
  onRemoveNetwork: () => void
  onSort: (sort: SeerrSort) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {network !== undefined && <NetworkChip id={network} onRemove={onRemoveNetwork} />}
      <div className="ml-auto flex gap-1" role="group" aria-label="Sort">
        {(Object.keys(SORT_LABEL) as SeerrSort[]).map((s) => (
          <Button key={s} variant={sort === s ? 'secondary' : 'ghost'} aria-pressed={sort === s} className="px-2 py-0.5 text-xs" onClick={() => onSort(s)}>
            {SORT_LABEL[s]}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** Titles matching all filters: a section per kind (TV, movies), each paged. */
export function DiscoverResults({ browse, sort, kind, onOpen }: { browse: SeerrBrowse; sort: SeerrSort; kind: SeerrKind | 'all'; onOpen: Open }) {
  const possible = browseKinds(browse)
  const kinds = kind === 'all' ? possible : possible.filter((k) => k === kind)
  if (kinds.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        {browse.studio !== undefined ? 'Studios only filter movies.' : 'Networks only filter TV.'} Switch the type, or remove the filter.
      </p>
    )
  }
  return kinds.map((k) => <DiscoverSection key={k} kind={k} browse={browse} sort={sort} onOpen={onOpen} />)
}

function DiscoverSection({ kind, browse, sort, onOpen }: { kind: SeerrKind; browse: SeerrBrowse; sort: SeerrSort; onOpen: Open }) {
  const { cardSize } = usePref('ui').value
  const discover = useSeerrDiscover(kind, browse, sort)
  if (discover.isPending) return <p className="text-xs text-neutral-500">Loading {KIND_HEADING[kind].toLowerCase()}…</p>
  if (discover.error) return <p className="text-xs text-red-400">{discover.error.message}</p>
  const results = discover.data.pages.flatMap((p) => p.results)
  return (
    <ResultSection
      title={KIND_HEADING[kind]}
      count={discover.data.pages[0]?.total}
      more={
        discover.hasNextPage
          ? { label: discover.isFetchingNextPage ? 'Loading…' : 'More', disabled: discover.isFetchingNextPage, onClick: () => void discover.fetchNextPage() }
          : undefined
      }
    >
      {results.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing matches all filters.</p>
      ) : (
        <CardGrid size={cardSize} variant="poster">
          {results.map((r) => (
            <SeerrTile key={seerrRef(r)} result={r} onOpen={() => onOpen(r)} />
          ))}
        </CardGrid>
      )}
    </ResultSection>
  )
}
