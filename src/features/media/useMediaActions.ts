import { usePref } from '@/api/prefs-context'
import { useWatchData } from '@/api/queries/home'
import { useSetPlayed } from '@/api/queries/series'
import type { CardMenuItem } from '@/components/CardMenu'
import type { MediaTileActions } from '@/components/MediaTile'
import { episodeLabel, type MediaItem } from '@/domain/media'
import { playTarget, seasonWatch, watchIndex, type SeriesWatch } from '@/domain/watchIndex'
import { seriesPath } from '@/features/home/links'
import { usePlay } from '@/features/player/player-context'
import { useFollowing } from '@/hooks/useFollowing'
import { useHiddenFromWatching } from '@/hooks/useHiddenFromWatching'

export type MediaActions = MediaTileActions & {
  /** Unwatched episodes (series / season), for the count label. */
  count?: number
}

/**
 * The standard tile actions for any item, so every grid, row and search result behaves the same:
 * - series: play next episode · ✓ whole series · ⋯ open series, Currently Watching, follow
 * - season: play next episode of the season · ✓ whole season · ⋯ open series
 * - episode / movie: play it · ✓ that item · ⋯ open series (episodes)
 */
export function useMediaActions(item: MediaItem): MediaActions {
  const play = usePlay()
  const setPlayed = useSetPlayed()
  const { played, unplayed } = useWatchData()
  const following = useFollowing()
  const { hide } = useHiddenFromWatching()
  const followed = usePref('following').value

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

  const seriesMenu = (): CardMenuItem[] => {
    if (!seriesId) return []
    const watch = index?.series(seriesId)
    const hidden = followed.hidden.some((h) => h.id === seriesId)
    const inProgress = !!watch && watch.unplayed.length > 0 && (watch.played.length > 0 || followed.followed.includes(seriesId)) && !hidden
    const isFollowed = following.isFollowed(seriesId)
    return [
      { label: 'Open series', to: seriesPath(seriesId) },
      inProgress
        ? { label: 'Remove from Currently Watching', onSelect: () => hide(seriesId), danger: true }
        : { label: 'Add to Currently Watching', onSelect: () => following.addToCurrentlyWatching(seriesId) },
      { label: isFollowed ? 'Unfollow' : 'Follow', onSelect: () => following.setFollowed(seriesId, !isFollowed) },
    ]
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
      }
    default:
      return {}
  }
}
