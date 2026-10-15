// The core rule from CLAUDE.md, as a pure function so it doesn't depend on how data is fetched.
//
// A series is listed if it has at least one unwatched episode AND (the user watched or started at
// least one episode OR follows it). Sorted by the newest episode's DateCreated,
// descending, so a newly added episode always moves its show to the top.
// Started movies are mixed in, sorted by when they were last played (replaces "Continue Watching").

import type { EpisodeRef, MediaItem } from './media'
import type { HiddenEntry } from './prefs'

export type SeriesEntry = {
  kind: 'series'
  seriesId: string
  /** The episode to play next. */
  next: EpisodeRef
  unplayedCount: number
  /** Newest DateCreated of any episode of the series (watched or not). The sort key. */
  latestAddedAt: string
  /** An unwatched episode was added within the "new" window. */
  isNew: boolean
  followed: boolean
  /** Progress 0..1 when the next episode is partly watched (play = resume). */
  progress?: number
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

type Input = {
  played: readonly EpisodeRef[]
  unplayed: readonly EpisodeRef[]
  /** Partly watched episodes and movies (server filter IsResumable). */
  resumable: readonly MediaItem[]
  followed: readonly string[]
  now: number
  newWithinDays: number
}

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

export function buildCurrentlyWatching(input: Input): WatchingEntry[] {
  const { played, unplayed, resumable, followed, now, newWithinDays } = input
  const playedBySeries = groupBySeries(played)
  const unplayedBySeries = groupBySeries(unplayed)
  const followedSet = new Set(followed)
  const resumeById = new Map(resumable.map((item) => [item.id, item]))
  const startedSeries = new Set(resumable.flatMap((item) => (item.kind === 'episode' && item.seriesId ? [item.seriesId] : [])))
  const newSince = new Date(now - newWithinDays * 86_400_000).toISOString()
  const entries: WatchingEntry[] = []

  for (const [seriesId, todo] of unplayedBySeries) {
    const done = playedBySeries.get(seriesId) ?? []
    const isFollowed = followedSet.has(seriesId)
    if (done.length === 0 && !isFollowed && !startedSeries.has(seriesId)) continue
    const next = pickNextEpisode(done, todo)
    if (!next) continue
    const newestUnplayed = maxDate(todo)
    const latestAddedAt = [maxDate(done), newestUnplayed].sort().at(-1) ?? ''
    entries.push({
      kind: 'series',
      seriesId,
      next,
      unplayedCount: todo.length,
      latestAddedAt,
      isNew: newestUnplayed >= newSince,
      followed: isFollowed,
      // Only the next episode's position counts; old abandoned partials elsewhere are ignored.
      progress: resumeById.get(next.id)?.progress,
      sortKey: latestAddedAt,
    })
  }

  for (const item of resumable) {
    if (item.kind !== 'movie') continue
    entries.push({ kind: 'movie', movie: item, sortKey: item.lastPlayedAt ?? item.dateCreated ?? '' })
  }

  return entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey))
}

export type NewEpisodesGroup = {
  seriesId: string
  /** New unwatched episodes of this series, in episode order. */
  episodes: EpisodeRef[]
  newestAt: string
}

/**
 * Unwatched episodes of the given series, one group per series, newest addition first.
 * With `withinDays`, only episodes added in that window; without it, all unwatched episodes.
 */
export function unplayedBySeries(
  unplayed: readonly EpisodeRef[],
  seriesIds: ReadonlySet<string>,
  now: number,
  withinDays?: number,
): NewEpisodesGroup[] {
  const since = withinDays === undefined ? '' : new Date(now - withinDays * 86_400_000).toISOString()
  const recent = unplayed.filter((e) => seriesIds.has(e.seriesId) && (e.dateCreated ?? '') >= since)
  return [...groupBySeries(recent)]
    .map(([seriesId, episodes]) => ({ seriesId, episodes: episodes.sort(compareEpisodes), newestAt: maxDate(episodes) }))
    .sort((a, b) => b.newestAt.localeCompare(a.newestAt))
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
