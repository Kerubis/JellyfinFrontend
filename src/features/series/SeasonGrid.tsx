import type { SeasonWatchState } from '@/api/queries/series'
import { MediaTile } from '@/components/MediaTile'
import { pickSeasonEpisode } from '@/domain/currentlyWatching'
import { episodeLabel } from '@/domain/media'
import type { Season } from '@/domain/series'

type Props = {
  seasons: readonly Season[]
  selectedId: string | undefined
  /** Watched/unwatched episodes per season number (from the watch-state lists). */
  bySeason: ReadonlyMap<number | undefined, SeasonWatchState>
  /** Used when a season has no poster of its own. */
  fallbackPosterUrl?: string
  onSelect: (seasonId: string) => void
  onSetPlayed: (season: Season, played: boolean) => void
  onPlay: (episodeId: string) => void
}

/** Season picker with poster previews and a watched toggle per season. */
export function SeasonGrid({ seasons, selectedId, bySeason, fallbackPosterUrl, onSelect, onSetPlayed, onPlay }: Props) {
  if (seasons.length === 0) return null
  return (
    <div role="tablist" aria-label="Seasons" className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
      {seasons.map((season) => {
        const state = bySeason.get(season.number)
        const unplayed = state?.unplayed.length ?? 0
        const watched = !!state && unplayed === 0 && state.played.length > 0
        const selected = season.id === selectedId
        const label = season.number === 0 ? 'Specials' : season.name
        const poster = season.posterUrl ?? fallbackPosterUrl
        const playTarget = state ? pickSeasonEpisode(state.played, state.unplayed) : undefined
        return (
          <div key={season.id} className="flex min-w-0 flex-col gap-1">
            {/* Clicking the poster selects the season; the centre circle plays its next episode
                (or the first one when all are watched). */}
            <MediaTile
              aspect="poster"
              imageUrl={poster}
              title={label}
              onSelect={() => onSelect(season.id)}
              tab={{ selected }}
              selected={selected}
              count={unplayed}
              onPlay={playTarget ? () => onPlay(playTarget.id) : undefined}
              playLabel={playTarget ? `Play ${episodeLabel(playTarget)} ${playTarget.name}` : undefined}
              watched={state ? { watched, label, onToggle: () => onSetPlayed(season, !watched) } : undefined}
            />
            <button
              type="button"
              onClick={() => onSelect(season.id)}
              className={`truncate text-left text-xs ${selected ? 'font-medium text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              {label}
            </button>
          </div>
        )
      })}
    </div>
  )
}
