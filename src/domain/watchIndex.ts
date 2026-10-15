import { pickNextEpisode, pickSeasonEpisode } from './currentlyWatching'
import type { EpisodeRef } from './media'

export type SeriesWatch = { played: EpisodeRef[]; unplayed: EpisodeRef[] }

export type WatchIndex = {
  series: (seriesId: string) => SeriesWatch
  playedIds: ReadonlySet<string>
}

const EMPTY: SeriesWatch = { played: [], unplayed: [] }
const cache = new WeakMap<readonly EpisodeRef[], WeakMap<readonly EpisodeRef[], WatchIndex>>()

/** Per-series lookup over the played/unplayed lists, built once per pair of lists (shared by all cards). */
export function watchIndex(played: readonly EpisodeRef[], unplayed: readonly EpisodeRef[]): WatchIndex {
  let byUnplayed = cache.get(played)
  if (!byUnplayed) cache.set(played, (byUnplayed = new WeakMap()))
  const cached = byUnplayed.get(unplayed)
  if (cached) return cached

  const map = new Map<string, SeriesWatch>()
  const entry = (id: string) => {
    let e = map.get(id)
    if (!e) map.set(id, (e = { played: [], unplayed: [] }))
    return e
  }
  for (const e of played) entry(e.seriesId).played.push(e)
  for (const e of unplayed) entry(e.seriesId).unplayed.push(e)
  const index: WatchIndex = { series: (id) => map.get(id) ?? EMPTY, playedIds: new Set(played.map((e) => e.id)) }
  byUnplayed.set(unplayed, index)
  return index
}

/** Episodes of one season of a series. */
export function seasonWatch(series: SeriesWatch, seasonNumber: number | undefined): SeriesWatch {
  return {
    played: series.played.filter((e) => e.seasonNumber === seasonNumber),
    unplayed: series.unplayed.filter((e) => e.seasonNumber === seasonNumber),
  }
}

/** What "play" starts for a set of episodes: next unwatched, or the first one when all are watched. */
export function playTarget(watch: SeriesWatch): EpisodeRef | undefined {
  return watch.unplayed.length > 0 ? pickNextEpisode(watch.played, watch.unplayed) : pickSeasonEpisode(watch.played, [])
}
