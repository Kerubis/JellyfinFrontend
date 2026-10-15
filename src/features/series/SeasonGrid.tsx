import type { SeasonWatchState } from '@/api/queries/series'
import { CountLabel } from '@/components/CornerLabel'
import { PlayCircle } from '@/components/PlayOverlay'
import { WatchedToggle } from '@/components/WatchedToggle'
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
  if (seasons.length <= 1) return null
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
          <div key={season.id} className="group relative min-w-0">
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(season.id)}
              className="flex w-full flex-col gap-1 text-left focus-visible:outline-none"
            >
              <span
                className={`relative aspect-[2/3] w-full overflow-hidden rounded bg-neutral-800 ring-accent-400 transition group-focus-visible:ring-2 ${
                  selected ? 'ring-2' : ''
                }`}
              >
                {poster && <img src={poster} alt="" loading="lazy" className="size-full object-cover" />}
                {unplayed > 0 && <CountLabel count={unplayed} />}
              </span>
              <span className={`truncate text-xs ${selected ? 'font-medium text-white' : 'text-neutral-400'}`}>{label}</span>
            </button>

            {/* Play: next unwatched episode of this season, or its first episode when all are watched.
                Clicking the poster outside the circle still selects the season. */}
            {playTarget && (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-[2/3] items-center justify-center">
                <button
                  type="button"
                  onClick={() => onPlay(playTarget.id)}
                  title={`Play ${episodeLabel(playTarget)} ${playTarget.name}`}
                  aria-label={`Play ${label}, ${episodeLabel(playTarget)}`}
                  className="pointer-events-auto rounded-full opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:outline-none"
                >
                  <PlayCircle />
                </button>
              </div>
            )}

            {/* Watched toggle: always visible once the season is watched, otherwise on hover. */}
            {state && (
              <WatchedToggle watched={watched} label={label} onToggle={() => onSetPlayed(season, !watched)} />
            )}
          </div>
        )
      })}
    </div>
  )
}
