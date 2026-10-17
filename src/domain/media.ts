export type MediaKind = 'series' | 'season' | 'episode' | 'movie' | 'other'

/** Anything shown as a card: series, episode, movie, ... */
export type MediaItem = {
  id: string
  kind: MediaKind
  name: string
  seriesId?: string
  seriesName?: string
  seasonNumber?: number
  episodeNumber?: number
  /** Season of an episode (for links to it). */
  seasonId?: string
  year?: number
  /** Last year of an ended series (when different from `year`). */
  endYear?: number
  /** Series: number of seasons; season: number of episodes. */
  childCount?: number
  /** 2:3 poster (for episodes: the series poster). */
  posterUrl?: string
  /** 16:9 image: the item's own still/thumb, or the series thumb as fallback. */
  thumbUrl?: string
  /** 16:9 image that never shows unwatched-episode content (series thumb/backdrop). */
  spoilerFreeThumbUrl?: string
  /** Playback progress 0..1, when partially watched. */
  progress?: number
  /** ISO timestamp of when the user last played it. */
  lastPlayedAt?: string
  /** Watched flag from the list's UserData (reliable enough for movies; series/episodes use the watch lists, D15). */
  played?: boolean
  /** Marked as favorite (list UserData). */
  favorite?: boolean
  /** ISO timestamp of when the item was added to the server. */
  dateCreated?: string
  /** When the item or (for series/seasons) its newest content was added; for "recently added" sorting. */
  addedAt?: string
}

/** Minimal episode data used for watch-state logic (Currently Watching, next episode). */
export type EpisodeRef = {
  id: string
  name: string
  seriesId: string
  seasonNumber?: number
  episodeNumber?: number
  premiereDate?: string
  dateCreated?: string
}

/** "S01E05–07" / "S01E12–S02E01" for a run of episodes (in order); single label for one. */
export function episodeRangeLabel(episodes: readonly { seasonNumber?: number; episodeNumber?: number }[]): string {
  const first = episodes[0]
  const last = episodes.at(-1)
  if (!first || !last || first === last) return first ? episodeLabel(first) : ''
  const from = episodeLabel(first)
  if (!from) return ''
  if (first.seasonNumber === last.seasonNumber && last.episodeNumber !== undefined) {
    return `${from}–${String(last.episodeNumber).padStart(2, '0')}`
  }
  const to = episodeLabel(last)
  return to ? `${from}–${to}` : from
}

/** "S01E05", "E5" or "" when the numbers are unknown. */
export function episodeLabel(item: { seasonNumber?: number; episodeNumber?: number }): string {
  const { seasonNumber: s, episodeNumber: e } = item
  if (e === undefined) return s !== undefined ? `S${String(s).padStart(2, '0')}` : ''
  const ep = `E${String(e).padStart(2, '0')}`
  return s !== undefined ? `S${String(s).padStart(2, '0')}${ep}` : ep
}

/**
 * Collapses episodes and seasons into one entry per series (keeping the order, i.e. the position of
 * its newest addition). Items without a series (movies, ...) pass through unchanged.
 */
export function groupBySeries(items: readonly MediaItem[]): MediaItem[] {
  const seen = new Set<string>()
  const result: MediaItem[] = []
  for (const item of items) {
    const seriesId = item.kind === 'series' ? item.id : item.kind === 'episode' || item.kind === 'season' ? item.seriesId : undefined
    if (!seriesId) {
      result.push(item)
      continue
    }
    if (seen.has(seriesId)) continue
    seen.add(seriesId)
    result.push(
      item.kind === 'series'
        ? item
        : { id: seriesId, kind: 'series', name: item.seriesName ?? item.name, posterUrl: item.posterUrl, addedAt: item.addedAt },
    )
  }
  return result
}
