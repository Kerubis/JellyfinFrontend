// The home sections from PLAN.md §3.9, as pure functions so they don't depend on how data is fetched.
// Every show / movie with anything unwatched lands in exactly one section; fully watched ones in none:
// - Currently Watching: anything with a play position (an episode → its show, movies) and shows with at least
//   one watched and one unwatched episode (specials count), minus what was removed. Sorted by last watched (D33).
// - New Episodes: the started, unfinished shows that were removed from Currently Watching; newest episode first.
// - Not watched: shows without any watched episode that aren't in Currently Watching (plus unwatched movies,
//   fetched per library elsewhere).
import type { EpisodeRef, MediaItem } from './media'
import type { HiddenEntry } from './prefs'

export type SeriesEntry = {
  kind: 'series'
  seriesId: string
  /** The episode to play next. */
  next: EpisodeRef
  unplayedCount: number
  /** Newest DateCreated of any episode of the series (watched or not); tie-breaker when never played. */
  latestAddedAt: string
  /** An unwatched episode was added within the "new" window. */
  isNew: boolean
  /** Progress 0..1 when the next episode is partly watched (play = resume). */
  progress?: number
  /** When an episode of it was last played ('' = never). */
  sortKey: string
}

export type MovieEntry = {
  kind: 'movie'
  movie: MediaItem
  /** When it was last played. */
  sortKey: string
}

export type WatchingEntry = SeriesEntry | MovieEntry

/** The id stored in the hidden list for this entry (series id or movie id). */
export const entryId = (entry: WatchingEntry): string => (entry.kind === 'series' ? entry.seriesId : entry.movie.id)

const isSpecial = (e: EpisodeRef) => e.seasonNumber === 0

/** Episode order within a series. Episodes without numbers fall back to air date, then date added. */
export function compareEpisodes(a: EpisodeRef, b: EpisodeRef): number {
  const season = (a.seasonNumber ?? Infinity) - (b.seasonNumber ?? Infinity)
  if (season) return season
  const episode = (a.episodeNumber ?? Infinity) - (b.episodeNumber ?? Infinity)
  if (episode) return episode
  return (a.premiereDate ?? a.dateCreated ?? '').localeCompare(b.premiereDate ?? b.dateCreated ?? '')
}

/**
 * Next episode: the first unwatched regular episode after the furthest watched one (like Next Up,
 * but without its date cutoff). If nothing comes after it, the first unwatched regular episode;
 * specials (season 0) only when nothing else is left.
 */
export function pickNextEpisode(played: readonly EpisodeRef[], unplayed: readonly EpisodeRef[]): EpisodeRef | undefined {
  const regular = unplayed.filter((e) => !isSpecial(e)).sort(compareEpisodes)
  const furthest = played.filter((e) => !isSpecial(e)).sort(compareEpisodes).at(-1)
  const after = furthest ? regular.find((e) => compareEpisodes(e, furthest) > 0) : undefined
  return after ?? regular[0] ?? [...unplayed].sort(compareEpisodes)[0]
}

/**
 * What "play" on a season starts: the next unwatched episode of that season, or its first episode
 * when everything in it is watched.
 */
export function pickSeasonEpisode(played: readonly EpisodeRef[], unplayed: readonly EpisodeRef[]): EpisodeRef | undefined {
  if (unplayed.length > 0) return pickNextEpisode(played, unplayed)
  return [...played].sort(compareEpisodes)[0]
}

function groupBySeries(episodes: readonly EpisodeRef[]): Map<string, EpisodeRef[]> {
  const map = new Map<string, EpisodeRef[]>()
  for (const e of episodes) {
    const list = map.get(e.seriesId)
    if (list) list.push(e)
    else map.set(e.seriesId, [e])
  }
  return map
}

const maxDate = (episodes: readonly EpisodeRef[]) =>
  episodes.reduce((max, e) => (e.dateCreated && e.dateCreated > max ? e.dateCreated : max), '')

type Input = {
  played: readonly EpisodeRef[]
  unplayed: readonly EpisodeRef[]
  /** Partly watched episodes and movies (server filter IsResumable). */
  resumable: readonly MediaItem[]
  /** Most recently played episodes / movies, newest first: gives each show its last-played time. */
  recentlyPlayed: readonly MediaItem[]
  /** Show / movie ids removed from Currently Watching. */
  removed: ReadonlySet<string>
  now: number
  /** Window for the NEW badge. */
  newWithinDays: number
}

export type NotWatchedSeries = { seriesId: string; /** Newest DateCreated of its episodes. */ newestAt: string }

export type HomeSections = {
  watching: WatchingEntry[]
  newEpisodes: NewEpisodesGroup[]
  notWatched: NotWatchedSeries[]
}

const toEpisodeRef = (item: MediaItem): EpisodeRef | undefined =>
  item.seriesId
    ? { id: item.id, name: item.name, seriesId: item.seriesId, seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber, dateCreated: item.dateCreated }
    : undefined

/** Splits the watch state into the three home sections (§3.9). */
export function buildHomeSections(input: Input): HomeSections {
  const { played, unplayed, resumable, recentlyPlayed, removed, now, newWithinDays } = input
  const playedBySeries = groupBySeries(played)
  const unplayedBySeries = groupBySeries(unplayed)
  const resumeById = new Map(resumable.map((item) => [item.id, item]))
  const partialBySeries = new Map<string, MediaItem[]>()
  for (const item of resumable) {
    if (item.kind === 'episode' && item.seriesId) partialBySeries.set(item.seriesId, [...(partialBySeries.get(item.seriesId) ?? []), item])
  }
  const newSince = new Date(now - newWithinDays * 86_400_000).toISOString()
  const lastPlayed = lastPlayedBySeries([...recentlyPlayed, ...resumable])
  const sections: HomeSections = { watching: [], newEpisodes: [], notWatched: [] }

  for (const seriesId of new Set([...unplayedBySeries.keys(), ...partialBySeries.keys()])) {
    const todo = unplayedBySeries.get(seriesId) ?? []
    const done = playedBySeries.get(seriesId) ?? []
    const partial = partialBySeries.get(seriesId) ?? []
    const started = done.length > 0 && todo.length > 0
    const newestUnplayed = maxDate(todo)
    const isNew = newestUnplayed !== '' && newestUnplayed >= newSince

    if ((started || partial.length > 0) && !removed.has(seriesId)) {
      // Next episode; a show with nothing unwatched left but a rewatch in progress continues that one.
      const next = pickNextEpisode(done, todo) ?? partial.map(toEpisodeRef).find(Boolean)
      if (!next) continue
      sections.watching.push({
        kind: 'series',
        seriesId,
        next,
        unplayedCount: todo.length,
        latestAddedAt: [maxDate(done), newestUnplayed].sort().at(-1) ?? '',
        isNew,
        // Only the next episode's position counts; old abandoned partials elsewhere are ignored.
        progress: resumeById.get(next.id)?.progress,
        sortKey: lastPlayed.get(seriesId) ?? '',
      })
    } else if (started) {
      sections.newEpisodes.push({ seriesId, episodes: [...todo].sort(compareEpisodes), newestAt: newestUnplayed, isNew })
    } else if (done.length === 0 && todo.length > 0) {
      sections.notWatched.push({ seriesId, newestAt: newestUnplayed })
    }
  }

  for (const item of resumable) {
    if (item.kind === 'movie' && !removed.has(item.id)) {
      sections.watching.push({ kind: 'movie', movie: item, sortKey: item.lastPlayedAt ?? item.dateCreated ?? '' })
    }
  }

  const tieBreak = (e: WatchingEntry) => (e.kind === 'series' ? e.latestAddedAt : '')
  sections.watching.sort((a, b) => b.sortKey.localeCompare(a.sortKey) || tieBreak(b).localeCompare(tieBreak(a)))
  sections.newEpisodes.sort((a, b) => b.newestAt.localeCompare(a.newestAt))
  sections.notWatched.sort((a, b) => b.newestAt.localeCompare(a.newestAt))
  return sections
}

/** Series id → when one of its episodes was last played (newest wins). */
function lastPlayedBySeries(items: readonly MediaItem[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items) {
    if (item.kind !== 'episode' || !item.seriesId || !item.lastPlayedAt) continue
    if (item.lastPlayedAt > (map.get(item.seriesId) ?? '')) map.set(item.seriesId, item.lastPlayedAt)
  }
  return map
}

export type NewEpisodesGroup = {
  seriesId: string
  /** Unwatched episodes of this show, in episode order. */
  episodes: EpisodeRef[]
  newestAt: string
  /** An episode was added within the "new" window. */
  isNew: boolean
}

/**
 * Hidden entries to bring back because something of theirs was played after hiding it
 * (an episode of a hidden series, or the hidden movie itself).
 */
export function idsToUnhide(hidden: readonly HiddenEntry[], recentlyPlayed: readonly MediaItem[]): string[] {
  const lastPlayed = new Map<string, string>()
  for (const item of recentlyPlayed) {
    const id = item.kind === 'episode' && item.seriesId ? item.seriesId : item.id
    const at = item.lastPlayedAt ?? ''
    if (at > (lastPlayed.get(id) ?? '')) lastPlayed.set(id, at)
  }
  return hidden.filter((h) => (lastPlayed.get(h.id) ?? '') > h.at).map((h) => h.id)
}

/**
 * Removed entries that can go (PLAN.md M18 cleanup): shows with nothing unwatched and no play position left,
 * watched movies, and items that no longer exist. Only call this with fully loaded data.
 */
export function staleRemovedIds(
  hidden: readonly HiddenEntry[],
  data: { unplayed: readonly EpisodeRef[]; resumable: readonly MediaItem[]; items: readonly MediaItem[] },
): string[] {
  const items = new Map(data.items.map((item) => [item.id, item]))
  const open = new Set([...data.unplayed.map((e) => e.seriesId), ...data.resumable.flatMap((i) => (i.seriesId ? [i.seriesId] : []))])
  return hidden
    .filter(({ id }) => {
      const item = items.get(id)
      if (!item) return true
      if (item.kind === 'series') return !open.has(id)
      if (item.kind === 'movie') return !!item.played && !item.progress
      return false
    })
    .map((h) => h.id)
}
