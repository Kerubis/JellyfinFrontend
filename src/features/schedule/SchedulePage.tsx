import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { usePref } from '@/api/prefs-context'
import { useSeriesCatalog } from '@/api/queries/home'
import { useLibraryMatcher, useScheduleGenres, useScheduleToken, useTimetable } from '@/api/schedule'
import { Button } from '@/components/Button'
import type { CardSize } from '@/domain/prefs'
import {
  addDays,
  dayKey,
  filterSchedule,
  isoWeek,
  searchSchedule,
  weekWindowStart,
  type LibrarySeries,
  type ScheduleEntry,
  type ScheduleStream,
} from '@/domain/schedule'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { AnimeDetailsDialog } from './AnimeDetailsDialog'
import { LibraryEntryCard, ScheduleEntryCard } from './ScheduleEntryCard'
import { ScheduleFiltersPanel } from './ScheduleFiltersPanel'

// Seven day columns, each exactly one media tile wide (cards.tsx POSTER_WIDTH: 5.5 / 7 / 9 / 11 / 13.5 rem) plus the column
// padding, so tiles have the same size as everywhere else; on narrower screens the week scrolls sideways.
const COLUMNS: Record<CardSize, string> = {
  xs: 'grid-cols-[repeat(7,6.25rem)]',
  sm: 'grid-cols-[repeat(7,7.75rem)]',
  md: 'grid-cols-[repeat(7,9.75rem)]',
  lg: 'grid-cols-[repeat(7,11.75rem)]',
  xl: 'grid-cols-[repeat(7,14.25rem)]',
}
const TEXT_COLUMNS = 'grid-cols-[repeat(7,minmax(10rem,1fr))]'

/** One entry per row: media tiles, or compact text cards. */
function EntryList({ images, children }: { images: boolean; children: ReactNode }) {
  return <ul className={`flex flex-col ${images ? 'gap-3' : 'gap-1'}`}>{children}</ul>
}

/** Today's local date key; switches over at midnight. */
function useTodayKey(): string {
  const [key, setKey] = useState(() => dayKey(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setKey(dayKey(new Date())), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return key
}

/** Weekly anime airing schedule from AnimeSchedule.net, today highlighted; a click opens the show's details. */
export function SchedulePage() {
  const { value: filters, update } = usePref('schedule')
  const { hour12 } = useTimeFormat()
  const { cardSize } = usePref('ui').value
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [showFilters, setShowFilters] = useState(false)
  // The selected show and the week offset live in the URL, so Back closes the details / returns to the week.
  const route = params.get('anime')
  const offset = Number(params.get('week') ?? 0) || 0
  // Only narrows what's loaded (not an API filter); in the URL so it survives opening a show and coming back.
  const query = params.get('q') ?? ''

  const enabled = useScheduleToken() !== ''
  const todayKey = useTodayKey()
  const { days, weeks } = useMemo(() => {
    const start = addDays(weekWindowStart(new Date(`${todayKey}T00:00`), filters.weekStart), offset * 7)
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
    // A window that doesn't start on Monday spans two ISO weeks.
    const first = isoWeek(start)
    const last = isoWeek(addDays(start, 6))
    return { days, weeks: first.week === last.week && first.year === last.year ? [first] : [first, last] }
  }, [todayKey, filters.weekStart, offset])
  const timetable = useTimetable(weeks)

  const all = timetable.data
  const routes = useMemo(() => [...new Set((all ?? []).map((e) => e.route))], [all])
  const genres = useScheduleGenres(routes, query.trim() !== '')
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>()
    for (const entry of filterSchedule(searchSchedule(all ?? [], query, genres), filters)) {
      const key = dayKey(new Date(entry.airsAt))
      map.set(key, [...(map.get(key) ?? []), entry])
    }
    return map
  }, [all, filters, query, genres])
  const matchLibrary = useLibraryMatcher()
  const catalog = useSeriesCatalog()
  const libraryMatches = useMemo(() => {
    const map = new Map<string, LibrarySeries>()
    for (const entry of all ?? []) {
      if (map.has(entry.route)) continue
      const hit = matchLibrary?.([entry.title, entry.romaji, entry.english, entry.native])
      if (hit) map.set(entry.route, hit)
    }
    return map
  }, [all, matchLibrary])
  const platforms = useMemo(() => {
    const seen = new Map<string, ScheduleStream>()
    for (const entry of all ?? []) for (const s of entry.streams) if (!seen.has(s.platform)) seen.set(s.platform, s)
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [all])

  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12 })
  const dateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12 })

  const setParam = (key: string, value: string | null, replace = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace },
    )
  // Opened from this page: going back closes it (and Back afterwards leaves the page); opened from a link: drop the param.
  const openedHere = (location.state as { scheduleDetails?: boolean } | null)?.scheduleDetails === true
  const closeDetails = useCallback(() => {
    if (openedHere) {
      void navigate(-1)
      return
    }
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('anime')
        return next
      },
      { replace: true },
    )
  }, [openedHere, navigate, setParams])
  // Shows in the library open their series page; the rest the details popup.
  const openEntry = (anime: string) => {
    const series = libraryMatches.get(anime)
    if (series) void navigate(`/series/${series.id}`)
    else openDetails(anime)
  }
  const openDetails = (anime: string) => {
    const next = new URLSearchParams(params)
    next.set('anime', anime)
    void navigate({ search: `?${next}` }, { state: { scheduleDetails: true } })
  }

  if (!enabled) {
    return (
      <p className="text-sm text-neutral-400">
        The schedule needs an AnimeSchedule.net API token:{' '}
        <Link to="/settings/integrations" className="text-accent-400 hover:underline">
          Settings → Integrations
        </Link>
        .
      </p>
    )
  }

  const total = [...byDay.values()].reduce((n, list) => n + list.length, 0)
  const range = `${days[0]?.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${days[6]?.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-sm font-semibold tracking-wide text-neutral-300 uppercase">Schedule</h1>
        <Button variant="ghost" onClick={() => setParam('week', String(offset - 1), true)} aria-label="Previous week">
          ‹
        </Button>
        <Button variant={offset === 0 ? 'secondary' : 'ghost'} onClick={() => setParam('week', null, true)}>
          This week
        </Button>
        <Button variant="ghost" onClick={() => setParam('week', String(offset + 1), true)} aria-label="Next week">
          ›
        </Button>
        <span className="text-xs text-neutral-400">{range}</span>
        {!timetable.isPending && <span className="text-xs text-neutral-500">{total} shown{query && ` matching “${query}”`}</span>}
        <span className="ml-auto flex items-center gap-3">
          <a href="https://animeschedule.net" target="_blank" rel="noreferrer" className="text-[11px] text-neutral-500 hover:text-neutral-300">
            Data: AnimeSchedule.net
          </a>
          <Button variant={showFilters ? 'primary' : 'secondary'} onClick={() => setShowFilters((v) => !v)}>
            Filters
          </Button>
        </span>
      </div>

      <input
        type="search"
        value={query}
        placeholder="Search titles or genres"
        aria-label="Search the schedule by title or genre"
        onChange={(e) => setParam('q', e.target.value || null, true)}
        onKeyDown={(e) => e.key === 'Escape' && query && setParam('q', null, true)}
        className="w-full self-center rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm placeholder:text-neutral-600 focus:border-accent-500 focus:outline-none sm:w-80"
      />

      {showFilters && <ScheduleFiltersPanel filters={filters} update={update} platforms={platforms} />}

      {timetable.error && <p className="text-sm text-red-400">{timetable.error.message}</p>}

      <div className="overflow-x-auto pb-1">
        {/* Centred; w-max keeps it scrollable instead of squeezed when the screen is narrower than the week. */}
        <div className={`mx-auto grid gap-3 ${filters.images ? `w-max ${COLUMNS[cardSize]}` : TEXT_COLUMNS}`}>
          {days.map((day) => {
            const key = dayKey(day)
            const isToday = key === todayKey
            const entries = byDay.get(key) ?? []
            return (
              <section
                key={key}
                aria-current={isToday ? 'date' : undefined}
                className={`flex min-w-0 flex-col gap-2 rounded-lg p-1.5 ${isToday ? 'bg-accent-600/30' : 'bg-neutral-900/40'}`}
              >
                {/* Always exactly two single lines, so every column's tiles start at the same height. */}
                <h2 className={`flex flex-col px-0.5 text-xs leading-4 font-semibold ${isToday ? 'text-accent-300' : 'text-neutral-300'}`}>
                  <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="truncate">{day.toLocaleDateString(undefined, { weekday: 'long' })}</span>
                    {isToday && <span className="ml-auto shrink-0 text-[10px] tracking-wide uppercase">Today</span>}
                  </span>
                  <span className="truncate font-normal text-neutral-500">
                    {day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {!timetable.isPending && entries.length > 0 && ` · ${entries.length}`}
                  </span>
                </h2>
                {timetable.isPending && <p className="px-0.5 text-[11px] text-neutral-500">Loading…</p>}
                {!timetable.isPending && entries.length === 0 && <p className="px-0.5 text-[11px] text-neutral-600">{query ? 'No match' : 'Nothing airs'}</p>}
                {entries.length > 0 && (
                  <EntryList images={filters.images}>
                    {entries.map((entry) => {
                      const entryKey = `${entry.route}-${entry.airType}-${entry.airsAt}`
                      const match = libraryMatches.get(entry.route)
                      const series = match && catalog.data?.get(match.id)
                      return filters.images && series ? (
                        <LibraryEntryCard key={entryKey} entry={entry} series={series} time={time(entry.airsAt)} />
                      ) : (
                        <ScheduleEntryCard
                          key={entryKey}
                          entry={entry}
                          time={time(entry.airsAt)}
                          images={filters.images}
                          inLibrary={match !== undefined}
                          onOpen={() => openEntry(entry.route)}
                        />
                      )
                    })}
                  </EntryList>
                )}
              </section>
            )
          })}
        </div>
      </div>

      {route && (
        <AnimeDetailsDialog
          route={route}
          entries={(all ?? []).filter((e) => e.route === route).sort((a, b) => a.airsAt.localeCompare(b.airsAt))}
          formatDate={dateTime}
          librarySeries={libraryMatches.get(route)}
          onClose={closeDetails}
        />
      )}
    </div>
  )
}
