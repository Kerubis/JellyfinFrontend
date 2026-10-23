import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { usePref } from '@/api/prefs-context'
import { useMyRequests, useSeerrConfig, useSeerrSearchResults, useSeerrUser } from '@/api/seerr'
import { Button } from '@/components/Button'
import { CardGrid } from '@/components/cards'
import { parseSeerrRef, seerrRef, type SeerrKind } from '@/domain/seerr'
import { SeerrDetailsDialog } from './SeerrDetailsDialog'
import { RequestTile, SeerrTile } from './SeerrTile'

const DEBOUNCE_MS = 300

type KindFilter = SeerrKind | 'all'
const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV' },
]

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">{children}</h2>
}

/**
 * Search Seerr for movies and shows and request them (PLAN.md M20). Without a search: the profile's own requests.
 * Search text, type filter and the open title live in the URL, so Back works as everywhere else.
 */
export function RequestsPage() {
  const config = useSeerrConfig()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const query = params.get('q') ?? ''
  const kind: KindFilter = params.get('type') === 'movie' || params.get('type') === 'tv' ? (params.get('type') as SeerrKind) : 'all'
  const open = parseSeerrRef(params.get('tmdb'))

  const setParam = useCallback(
    (key: string, value: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value === null) next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  // Typing updates the URL (and the search) after a short pause.
  const [text, setText] = useState(query)
  // The URL changed from elsewhere (Back, a "Request …" link): show its text.
  const [shownQuery, setShownQuery] = useState(query)
  if (shownQuery !== query) {
    setShownQuery(query)
    if (text.trim() !== query) setText(query)
  }
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const onType = (value: string) => {
    setText(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setParam('q', value.trim() || null), DEBOUNCE_MS)
  }

  // Opened from this page: going back closes it; opened from a link: drop the param.
  const openedHere = (location.state as { requestDetails?: boolean } | null)?.requestDetails === true
  const closeDetails = useCallback(() => {
    if (openedHere) void navigate(-1)
    else setParam('tmdb', null)
  }, [openedHere, navigate, setParam])
  const openDetails = (target: { kind: SeerrKind; tmdbId: number }) => {
    const next = new URLSearchParams(params)
    next.set('tmdb', seerrRef(target))
    void navigate({ search: `?${next}` }, { state: { requestDetails: true } })
  }

  if (!config) {
    return <p className="text-sm text-neutral-400">Requests need Seerr. An admin can set it up for this profile in Settings → Seerr.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <input
          type="search"
          value={text}
          autoFocus
          placeholder="Search movies and shows to request"
          aria-label="Search movies and shows to request"
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              window.clearTimeout(timer.current)
              setParam('q', text.trim() || null)
            }
          }}
          className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm placeholder:text-neutral-600 focus:border-accent-500 focus:outline-none sm:w-96"
        />
        <div className="flex gap-1" role="group" aria-label="Type">
          {KIND_FILTERS.map((f) => (
            <Button key={f.id} variant={kind === f.id ? 'primary' : 'ghost'} aria-pressed={kind === f.id} onClick={() => setParam('type', f.id === 'all' ? null : f.id)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {query.length >= 2 ? (
        <SearchResults query={query} kind={kind} onOpen={openDetails} />
      ) : (
        <MyRequests kind={kind} onOpen={openDetails} />
      )}

      {open && <SeerrDetailsDialog target={open} onClose={closeDetails} />}
    </div>
  )
}

type Open = (target: { kind: SeerrKind; tmdbId: number }) => void

function SearchResults({ query, kind, onOpen }: { query: string; kind: KindFilter; onOpen: Open }) {
  const { cardSize } = usePref('ui').value
  const search = useSeerrSearchResults(query)
  if (search.isPending) return <p className="text-xs text-neutral-500">Searching…</p>
  if (search.error) return <p className="text-xs text-red-400">{search.error.message}</p>
  const all = search.data.pages.flatMap((p) => p.results)
  const results = kind === 'all' ? all : all.filter((r) => r.kind === kind)
  return (
    <section className="flex flex-col gap-2">
      <Heading>
        Results <span className="text-xs font-normal text-neutral-500">{results.length}</span>
      </Heading>
      {results.length === 0 && !search.hasNextPage && <p className="text-sm text-neutral-500">Nothing found for “{query}”.</p>}
      <CardGrid size={cardSize} variant="poster">
        {results.map((r) => (
          <SeerrTile key={seerrRef(r)} result={r} onOpen={() => onOpen(r)} />
        ))}
      </CardGrid>
      {search.hasNextPage && (
        <Button className="self-center" disabled={search.isFetchingNextPage} onClick={() => void search.fetchNextPage()}>
          {search.isFetchingNextPage ? 'Loading…' : 'More results'}
        </Button>
      )}
    </section>
  )
}

function MyRequests({ kind, onOpen }: { kind: KindFilter; onOpen: Open }) {
  const { cardSize } = usePref('ui').value
  const user = useSeerrUser()
  const requests = useMyRequests(user.data?.id)
  if (user.data === null) {
    return <p className="text-sm text-amber-300">Your profile isn't a Seerr user yet; an admin can import it in Seerr → Users.</p>
  }
  const error = user.error ?? requests.error
  if (error) return <p className="text-xs text-red-400">{error.message}</p>
  if (!requests.data) return <p className="text-xs text-neutral-500">Loading your requests…</p>
  const list = kind === 'all' ? requests.data : requests.data.filter((r) => r.kind === kind)
  return (
    <section className="flex flex-col gap-2">
      <Heading>
        My requests <span className="text-xs font-normal text-neutral-500">{list.length}</span>
      </Heading>
      {list.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing requested yet. Search above for a movie or show.</p>
      ) : (
        <CardGrid size={cardSize} variant="poster">
          {list.map((r) => (
            <RequestTile key={r.id} request={r} onOpen={() => onOpen(r)} />
          ))}
        </CardGrid>
      )}
    </section>
  )
}
