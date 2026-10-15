import { useEffect, useRef, type Ref } from 'react'
import { Link } from 'react-router'
import { useSetPlayed } from '@/api/queries/series'
import { MediaTile } from '@/components/MediaTile'
import { episodeLabel } from '@/domain/media'
import { runtimeMinutes, type EpisodeDetails } from '@/domain/series'
import { episodePath } from '@/features/home/links'

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
    <li ref={ref} className="relative min-w-0">
      <MediaTile
        aspect="thumb"
        roundedTop
        imageUrl={episode.stillUrl}
        blurred={blurred}
        title={`Play ${label} ${episode.name}`.trim()}
        onPlay={onPlay}
        marker={isNext ? 'NEXT' : undefined}
        selected={isNext}
        progress={progress}
        watched={{
          watched: played,
          label: label || episode.name,
          onToggle: () => setPlayed.mutate({ itemId: episode.id, played: !played, episodes: [episode] }),
        }}
      />

      {/* The banner opens the episode page. */}
      <Link
        to={episodePath(episode.id, episode.seriesId)}
        className="group/banner block rounded-b bg-neutral-900 px-2 py-1 transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-accent-400"
      >
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className="shrink-0 text-neutral-500 tabular-nums">{label}</span>
          <span className={`truncate font-medium group-hover/banner:text-accent-300 ${played ? 'text-neutral-400' : ''}`}>{episode.name}</span>
        </div>
        <div className="text-[11px] text-neutral-500">{[aired, minutes && `${minutes} min`].filter(Boolean).join(' · ')}</div>
      </Link>
    </li>
  )
}
