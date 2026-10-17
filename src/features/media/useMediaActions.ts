import { useWatchData } from '@/api/queries/home'
import { useSetFavorite } from '@/api/queries/movies'
import { useSetPlayed } from '@/api/queries/series'
import type { CardMenuItem } from '@/components/CardMenu'
import type { MediaTileActions } from '@/components/MediaTile'
import { episodeLabel, type MediaItem } from '@/domain/media'
import { playTarget, seasonWatch, watchIndex, type SeriesWatch } from '@/domain/watchIndex'
import { itemPath, seriesPath } from '@/features/home/links'
import { usePlay } from '@/features/player/player-context'
import { useHiddenFromWatching } from '@/hooks/useHiddenFromWatching'

export type MediaActions = MediaTileActions & {
  /** Unwatched episodes (series / season), for the count label. */
  count?: number
}

/**
 * The standard tile actions for any item, so every grid, row and search result behaves the same:
 * - series: play next episode · ✓ whole series · ⋯ open series, remove from / back to Currently Watching
 * - season: play next episode of the season · ✓ whole season · ⋯ same as the series
 * - episode: play it · ✓ that item · ⋯ same as the series
 * - movie: play it · ✓ that item · ⋯ details, play from start (when started), favorite, remove from / back to
 *   Currently Watching
 */
export function useMediaActions(item: MediaItem): MediaActions {
  const play = usePlay()
  const setPlayed = useSetPlayed()
  const setFavorite = useSetFavorite()
  const { played, unplayed, resumable } = useWatchData()
  const removed = useHiddenFromWatching()

  const index = played && unplayed ? watchIndex(played, unplayed) : undefined
  const seriesId = item.kind === 'series' ? item.id : item.seriesId

  const markSet = (watch: SeriesWatch, itemId: string, name: string) => {
    const watched = watch.unplayed.length === 0 && watch.played.length > 0
    return {
      watched,
      label: name,
      onToggle: () => setPlayed.mutate({ itemId, played: !watched, episodes: [...watch.played, ...watch.unplayed] }),
    }
  }

  /** Remove from / back to Currently Watching, for an entry that qualifies for it (§3.9). */
  const watchingEntry = (id: string, qualifies: boolean): CardMenuItem[] =>
    removed.isHidden(id)
      ? [{ label: 'Back to Currently Watching', onSelect: () => removed.unhide(id) }]
      : qualifies
        ? [{ label: 'Remove from Currently Watching', onSelect: () => removed.hide(id), danger: true }]
        : []

  const seriesMenu = (): CardMenuItem[] => {
    if (!seriesId) return []
    const watch = index?.series(seriesId)
    const started = !!watch && watch.played.length > 0 && watch.unplayed.length > 0
    const hasPosition = !!resumable?.some((item) => item.seriesId === seriesId)
    return [{ label: 'Open series', to: seriesPath(seriesId) }, ...watchingEntry(seriesId, started || hasPosition)]
  }

  switch (item.kind) {
    case 'series': {
      const watch = index?.series(item.id)
      const target = watch && playTarget(watch)
      return {
        onPlay: target ? () => play(target.id) : undefined,
        playLabel: target ? `Play ${episodeLabel(target)}` : undefined,
        watched: watch && watch.played.length + watch.unplayed.length > 0 ? markSet(watch, item.id, item.name) : undefined,
        menu: seriesMenu(),
        count: watch?.unplayed.length,
      }
    }
    case 'season': {
      const watch = seriesId && index ? seasonWatch(index.series(seriesId), item.seasonNumber) : undefined
      const target = watch && playTarget(watch)
      return {
        onPlay: target ? () => play(target.id) : undefined,
        playLabel: target ? `Play ${episodeLabel(target)}` : undefined,
        watched: watch && watch.played.length + watch.unplayed.length > 0 ? markSet(watch, item.id, `${item.seriesName ?? ''} ${item.name}`.trim()) : undefined,
        menu: seriesMenu(),
        count: watch?.unplayed.length,
      }
    }
    case 'episode': {
      const isPlayed = index ? index.playedIds.has(item.id) : !!item.played
      const ref = seriesId
        ? { id: item.id, name: item.name, seriesId, seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber, dateCreated: item.dateCreated }
        : undefined
      return {
        onPlay: () => play(item.id),
        playLabel: `Play ${episodeLabel(item)} ${item.name}`.trim(),
        watched: {
          watched: isPlayed,
          label: episodeLabel(item) || item.name,
          onToggle: () => setPlayed.mutate({ itemId: item.id, played: !isPlayed, episodes: ref ? [ref] : [] }),
        },
        menu: seriesMenu(),
      }
    }
    case 'movie':
      return {
        onPlay: () => play(item.id),
        playLabel: `Play ${item.name}`,
        watched: {
          watched: !!item.played,
          label: item.name,
          onToggle: () => setPlayed.mutate({ itemId: item.id, played: !item.played, episodes: [] }),
        },
        menu: [
          { label: 'Open details', to: itemPath(item) },
          ...(item.progress ? [{ label: 'Play from start', onSelect: () => play(item.id, 'beginning') }] : []),
          item.favorite
            ? { label: 'Remove from favorites', onSelect: () => setFavorite.mutate({ itemId: item.id, favorite: false }) }
            : { label: 'Add to favorites', onSelect: () => setFavorite.mutate({ itemId: item.id, favorite: true }) },
          ...watchingEntry(item.id, !!item.progress),
        ],
      }
    default:
      return {}
  }
}
