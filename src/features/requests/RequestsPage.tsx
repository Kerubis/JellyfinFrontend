import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { usePref } from '@/api/prefs-context'
import { useMyRequests, useResolvedTokens, useSeerrConfig, useSeerrSearchResults, useSeerrUser, type TokenResolution } from '@/api/seerr'
import { Button } from '@/components/Button'
import { CardGrid } from '@/components/cards'
import {
  IGNORE_MESSAGE,
  parseQuery,
  planQuery,
  textOf,
  type QueryToken,
  type TokenKind,
} from '@/domain/searchQuery'
import { parseNetwork, parseSeerrRef, seerrRef, type SeerrKind, type SeerrSort } from '@/domain/seerr'
import { BrowseBar, DiscoverResults } from './DiscoverView'
import { PersonView } from './PersonView'
import { ResultSection } from './ResultSection'
import { SearchField, type FieldProblem } from './SearchField'
import { SeerrDetailsDialog } from './SeerrDetailsDialog'
import { RequestTile, SeerrTile } from './SeerrTile'
import { useFavoriteKeywords } from './useFavoriteKeywords'

const DEBOUNCE_MS = 300

type KindFilter = SeerrKind | 'all'
const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV' },
]

type Changes = Record<string, string | null>

type Token = QueryToken & { kind: TokenKind }
const isToken = (t: QueryToken): t is Token => t.kind !== 'text'

/** Each token with its id lookup (shared cache with the autocomplete). */
function useTokens(text: string, hasNetwork: boolean) {
  const all = parseQuery(text)
  const tokens = all.filter(isToken)
  const resolved = useResolvedTokens(tokens)
  const favorites = useFavoriteKeywords()
  const plan = planQuery(all, hasNetwork)
  // A starred keyword wins over namesakes.
  const resolution = new Map<QueryToken, TokenResolution>(
    tokens.map((t, i) => {
      const favorite = t.kind === 'keyword' ? favorites.named(t.name) : undefined
      return [t, favorite ? { state: 'found', id: favorite.id, name: favorite.name } : (resolved[i] ?? { state: 'pending' })]
    }),
  )
  /** Found ids of the tokens of one kind that aren't ignored. */
  const ids = (kind: TokenKind) =>
    tokens.flatMap((t) => {
      const r = resolution.get(t)
      return t.kind === kind && !plan.ignored.has(t) && r?.state === 'found' ? [r.id] : []
    })
  const pending = tokens.some((t) => !plan.ignored.has(t) && resolution.get(t)?.state === 'pending')
  const problems = new Map<number, FieldProblem>()
  for (const t of all) {
    const reason = plan.ignored.get(t)
    const r = resolution.get(t)
    if (reason) problems.set(t.start, { mark: 'ignored', message: IGNORE_MESSAGE[reason] })
    else if (r?.state === 'missing') problems.set(t.start, { mark: 'missing', message: '' })
    else if (r?.state === 'error') problems.set(t.start, { mark: 'missing', message: r.message })
  }
  return { all, plan, ids, pending, problems, text: textOf(all) }
}

/**
 * Search Seerr for movies and shows and request them (PLAN.md M20). The field takes plain words (titles) and
 * `#keyword`, `@person`, `$studio` tokens: people show their titles (shared ones for several), keywords and a studio
 * (or a network from the details popup) browse titles matching all of them. Without a search: the profile's own
 * requests. Everything lives in the URL, so Back works as everywhere else.
 */
export function RequestsPage() {
  const config = useSeerrConfig()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const query = params.get('q') ?? ''
  const kind: KindFilter = params.get('type') === 'movie' || params.get('type') === 'tv' ? (params.get('type') as SeerrKind) : 'all'
  const open = parseSeerrRef(params.get('tmdb'))
  const network = parseNetwork(params.get('network'))
  const requestPrefs = usePref('requests')
  const sort = requestPrefs.value.sort

  // Typing and toggles replace the history entry; removing the network chip adds one.
  const update = useCallback(
    (changes: Changes, replace = true) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(changes)) {
            if (value === null) next.delete(key)
            else next.set(key, value)
          }
          return next
        },
        { replace },
      ),
    [setParams],
  )
  const setParam = useCallback((key: string, value: string | null) => update({ [key]: value }), [update])

  // Typing updates the URL (and the search) after a short pause.
  const [text, setText] = useState(query)
  // The URL changed from elsewhere (Back, a "Request …" link, picking a suggestion): show its text.
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

  const commit = (value: string) => {
    window.clearTimeout(timer.current)
    setParam('q', value.trim() || null)
  }
  // The field marks what it is typing now; the results follow the URL (after the pause).
  const live = useTokens(text, network !== undefined)
  const current = useTokens(query, network !== undefined)

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

  const { mode } = current.plan
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <SearchField text={text} onText={onType} onCommit={commit} problems={live.problems} />
        <div className="flex gap-1" role="group" aria-label="Type">
          {KIND_FILTERS.map((f) => (
            <Button key={f.id} variant={kind === f.id ? 'primary' : 'ghost'} aria-pressed={kind === f.id} onClick={() => setParam('type', f.id === 'all' ? null : f.id)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {(mode === 'discover' || mode === 'people') && (
        <BrowseBar
          network={mode === 'discover' ? network : undefined}
          sort={sort}
          onRemoveNetwork={() => update({ network: null }, false)}
          onSort={(s: SeerrSort) => requestPrefs.update({ sort: s })}
        />
      )}

      {current.pending ? (
        <p className="text-xs text-neutral-500">Looking up…</p>
      ) : mode === 'people' ? (
        current.ids('person').length > 0 ? (
          <PersonView personIds={[...new Set(current.ids('person'))]} kind={kind} text={current.text} sort={sort} onOpen={openDetails} />
        ) : (
          <p className="text-sm text-neutral-500">No person found.</p>
        )
      ) : mode === 'discover' ? (
        current.ids('keyword').length > 0 || current.ids('studio').length > 0 || network !== undefined ? (
          <DiscoverResults
            browse={{ keywords: [...new Set(current.ids('keyword'))], studio: current.ids('studio')[0], network }}
            sort={sort}
            kind={kind}
            onOpen={openDetails}
          />
        ) : (
          <p className="text-sm text-neutral-500">No keyword or studio found.</p>
        )
      ) : mode === 'titles' ? (
        <SearchResults query={current.text} kind={kind} onOpen={openDetails} />
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
    <ResultSection
      title="Results"
      count={results.length}
      more={
        search.hasNextPage
          ? { label: search.isFetchingNextPage ? 'Loading…' : 'More results', disabled: search.isFetchingNextPage, onClick: () => void search.fetchNextPage() }
          : undefined
      }
    >
      {results.length === 0 && !search.hasNextPage && <p className="text-sm text-neutral-500">No titles found for “{query}”.</p>}
      <CardGrid size={cardSize} variant="poster">
        {results.map((r) => (
          <SeerrTile key={seerrRef(r)} result={r} onOpen={() => onOpen(r)} />
        ))}
      </CardGrid>
    </ResultSection>
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
    <ResultSection title="My requests" count={list.length}>
      {list.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing requested yet. Search above for a title, #keyword, @person or $studio.</p>
      ) : (
        <CardGrid size={cardSize} variant="poster">
          {list.map((r) => (
            <RequestTile key={r.id} request={r} onOpen={() => onOpen(r)} />
          ))}
        </CardGrid>
      )}
    </ResultSection>
  )
}
