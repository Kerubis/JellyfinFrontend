import { useState } from 'react'
import { useCurrentlyWatching } from '@/api/queries/home'
import { Button } from '@/components/Button'
import { PlayIcon, PlayOverlay } from '@/components/PlayOverlay'
import { DEFAULT_NEW_DAYS } from '@/domain/dashboard'
import { episodeLabel, type EpisodeRef } from '@/domain/media'
import type { SeriesDetails } from '@/domain/series'
import { useHiddenFromWatching } from '@/hooks/useHiddenFromWatching'

type Props = {
  series: SeriesDetails
  playedCount: number
  totalCount: number
  next?: EpisodeRef
  /** Next episode, or the first one when everything is watched. */
  playTarget?: EpisodeRef
  onPlay: (episodeId: string) => void
}

function metaLine(series: SeriesDetails): string {
  const years = series.year ? (series.endYear && series.endYear !== series.year ? `${series.year}–${series.endYear}` : String(series.year)) : ''
  const status = series.status === 'continuing' ? 'Airing' : series.status === 'ended' ? 'Ended' : ''
  const rating = series.communityRating ? `★ ${series.communityRating.toFixed(1)}` : ''
  return [years, status, series.officialRating, rating, series.genres.slice(0, 3).join(', ')].filter(Boolean).join(' · ')
}

export function SeriesHeader({ series, playedCount, totalCount, next, playTarget, onPlay }: Props) {
  const [expanded, setExpanded] = useState(false)
  const removed = useHiddenFromWatching()
  const watching = useCurrentlyWatching(DEFAULT_NEW_DAYS)
  const inCurrentlyWatching = watching.items.some(({ entry }) => entry.kind === 'series' && entry.seriesId === series.id)
  const playLabel = playTarget ? `${next ? 'Play' : 'Play again'} ${episodeLabel(playTarget)}` : 'Play'

  return (
    <header className="flex gap-3">
      {/* The poster is the play button for the next episode. */}
      <button
        type="button"
        onClick={() => playTarget && onPlay(playTarget.id)}
        disabled={!playTarget}
        title={playLabel}
        className="group relative aspect-[2/3] w-2/5 max-w-60 min-w-28 shrink-0 self-start overflow-hidden rounded bg-neutral-800 focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:outline-none"
      >
        {series.posterUrl && <img src={series.posterUrl} alt="" className="size-full object-cover" />}
        <PlayOverlay size="lg" />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/75 px-2 py-1 text-xs font-medium text-white">
          <PlayIcon className="size-3.5" />
          {playLabel}
        </span>
      </button>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-xl leading-tight font-semibold">{series.name}</h1>
        <p className="text-xs text-neutral-400">{metaLine(series)}</p>
        <p className="text-xs text-neutral-300">
          {playedCount} / {totalCount} watched
          {next && <span className="text-neutral-500"> · next {episodeLabel(next)}</span>}
        </p>
        {series.overview && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className={`text-left text-xs text-neutral-300 ${expanded ? '' : 'line-clamp-4'}`}
            title={expanded ? 'Show less' : 'Show more'}
          >
            {series.overview}
          </button>
        )}
        {/* Shows enter Currently Watching by being watched (§3.9); here they can only be removed or brought back. */}
        {(inCurrentlyWatching || removed.isHidden(series.id)) && (
          <div className="mt-1 flex flex-wrap gap-2">
            {inCurrentlyWatching ? (
              <Button onClick={() => removed.hide(series.id)}>Remove from Currently Watching</Button>
            ) : (
              <Button onClick={() => removed.unhide(series.id)} title="It sits in New Episodes while removed">
                Back to Currently Watching
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
