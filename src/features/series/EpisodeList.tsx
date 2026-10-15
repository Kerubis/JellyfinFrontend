import { useEffect, useRef, type Ref } from 'react'
import { useSetPlayed } from '@/api/queries/series'
import { MarkerLabel } from '@/components/CornerLabel'
import { PlayOverlay } from '@/components/PlayOverlay'
import { WatchedToggle } from '@/components/WatchedToggle'
import { episodeLabel } from '@/domain/media'
import { runtimeMinutes, type EpisodeDetails } from '@/domain/series'

type Props = {
  episodes: readonly EpisodeDetails[]
  playedIds: ReadonlySet<string>
  nextId?: string
  showSpoilers: boolean
  onPlay: (episodeId: string) => void
}

export function EpisodeList({ episodes, playedIds, nextId, showSpoilers, onPlay }: Props) {
  const nextRef = useRef<HTMLLIElement>(null)

  // Bring the next episode into view when a long season opens.
  useEffect(() => {
    nextRef.current?.scrollIntoView({ block: 'nearest' })
  }, [nextId, episodes])

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3">
      {episodes.map((episode) => (
        <EpisodeCard
          key={episode.id}
          ref={episode.id === nextId ? nextRef : undefined}
          episode={episode}
          played={playedIds.has(episode.id)}
          isNext={episode.id === nextId}
          showSpoilers={showSpoilers}
          onPlay={() => onPlay(episode.id)}
        />
      ))}
    </ul>
  )
}

type CardProps = {
  ref?: Ref<HTMLLIElement>
  episode: EpisodeDetails
  played: boolean
  isNext: boolean
  showSpoilers: boolean
  onPlay: () => void
}

function EpisodeCard({ ref, episode, played, isNext, showSpoilers, onPlay }: CardProps) {
  const setPlayed = useSetPlayed()
  const blurred = !played && !showSpoilers
  const minutes = runtimeMinutes(episode.runtimeTicks)
  const progress = !played && episode.runtimeTicks && episode.positionTicks > 0 ? episode.positionTicks / episode.runtimeTicks : undefined
  const aired = episode.premiereDate ? new Date(episode.premiereDate).toLocaleDateString() : undefined
  const label = episodeLabel(episode)

  return (
    <li ref={ref} className="group relative min-w-0">
      {/* The whole picture is the play button. */}
      <button
        type="button"
        onClick={onPlay}
        title={`Play ${label} ${episode.name}`.trim()}
        className={`relative block aspect-video w-full overflow-hidden rounded-t bg-neutral-800 ring-accent-400 focus-visible:outline-none focus-visible:ring-2 ${
          isNext ? 'ring-2' : ''
        }`}
      >
        {episode.stillUrl && (
          <img
            src={episode.stillUrl}
            alt=""
            loading="lazy"
            className={`size-full object-cover transition ${blurred ? 'scale-110 blur-md' : ''}`}
          />
        )}
        <PlayOverlay />
        {isNext && (
          <MarkerLabel>NEXT</MarkerLabel>
        )}
        {progress !== undefined && (
          <span className="absolute inset-x-0 bottom-0 z-10 h-1 bg-black/60">
            <span className="block h-full bg-accent-500" style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        )}
      </button>

      {/* Watched toggle: always visible once watched, otherwise on hover. */}
      <WatchedToggle
        watched={played}
        label={label || episode.name}
        onToggle={() => setPlayed.mutate({ itemId: episode.id, played: !played, episodes: [episode] })}
      />

      <div className="rounded-b bg-neutral-900 px-2 py-1">
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className="shrink-0 text-neutral-500 tabular-nums">{label}</span>
          <span className={`truncate font-medium ${played ? 'text-neutral-400' : ''}`}>{episode.name}</span>
        </div>
        <div className="text-[11px] text-neutral-500">{[aired, minutes && `${minutes} min`].filter(Boolean).join(' · ')}</div>
      </div>
    </li>
  )
}
