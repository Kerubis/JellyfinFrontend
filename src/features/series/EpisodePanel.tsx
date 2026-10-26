import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import { usePref } from '@/api/prefs-context'
import { useWatchData } from '@/api/queries/home'
import { useEpisode, useSetPlayed } from '@/api/queries/series'
import { Button } from '@/components/Button'
import { MediaTile } from '@/components/MediaTile'
import { PlayIcon } from '@/components/PlayOverlay'
import { episodeLabel } from '@/domain/media'
import { formatTime, TICKS_PER_SECOND } from '@/domain/player'
import { runtimeMinutes } from '@/domain/series'
import type { AudioStream, SubtitleStream } from '@/domain/tracks'
import { episodePath, seasonPath } from '@/features/home/links'
import { usePlay } from '@/features/player/player-context'
import { languageName } from '@/lib/languages'

const LINK = 'hover:text-accent-300 hover:underline'

function trackList(streams: readonly (AudioStream | SubtitleStream)[]): string {
  const names = streams.map((s) => [languageName(s.language), s.title].filter(Boolean).join(' – '))
  return names.length > 0 ? names.join(', ') : 'none'
}

/** Old-style `/episode/:id` links: look up the series and open the episode inside its series page. */
export function EpisodeRedirect() {
  const { episodeId = '' } = useParams()
  const query = useEpisode(episodeId)
  if (query.isPending) return <p className="text-sm text-neutral-500">Loading…</p>
  if (query.isError) return <p className="text-sm text-red-400">{errorMessage(query.error)}</p>
  const seriesId = query.data.episode.seriesId
  return seriesId ? <Navigate to={episodePath(episodeId, seriesId)} replace /> : <EpisodePanel episodeId={episodeId} />
}

/** Episode details, shown in the series page's right column instead of the episode list. */
export function EpisodePanel({ episodeId }: { episodeId: string }) {
  const query = useEpisode(episodeId)
  const { played: playedList } = useWatchData()
  const { showSpoilers } = usePref('ui').value
  const play = usePlay()
  const setPlayed = useSetPlayed()
  const [revealed, setRevealed] = useState(false)

  if (query.isPending) return <p className="text-sm text-neutral-500">Loading…</p>
  if (query.isError) return <p className="text-sm text-red-400">{errorMessage(query.error)}</p>

  const { episode, seriesName, seasonId, tracks, previousId, nextId } = query.data
  // Watched state from the server-filtered list when loaded (D15), else the item's own flag.
  const played = playedList ? playedList.some((e) => e.id === episode.id) : query.data.played
  const hideSpoilers = !played && !showSpoilers && !revealed
  const minutes = runtimeMinutes(episode.runtimeTicks)
  const aired = episode.premiereDate ? new Date(episode.premiereDate).toLocaleDateString() : undefined
  const resumeAt = !played && episode.positionTicks > 0 ? episode.positionTicks / TICKS_PER_SECOND : 0
  const progress = resumeAt > 0 && episode.runtimeTicks ? episode.positionTicks / episode.runtimeTicks : undefined
  const label = episodeLabel(episode)
  const toggleWatched = () => setPlayed.mutate({ itemId: episode.id, played: !played, episodes: [episode] })

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      {episode.seriesId && episode.seasonNumber !== undefined && (
        <Link to={seasonPath(episode.seriesId, { id: seasonId, number: episode.seasonNumber })} className={`self-start text-sm text-neutral-400 ${LINK}`}>
          ← All episodes of {episode.seasonNumber === 0 ? 'Specials' : `Season ${episode.seasonNumber}`}
        </Link>
      )}
      <MediaTile
        aspect="thumb"
        imageUrl={episode.stillUrl}
        blurred={hideSpoilers}
        title={`Play ${label} ${episode.name}`}
        onPlay={() => play(episode.id)}
        progress={progress}
        watched={{ watched: played, label: label || episode.name, onToggle: toggleWatched }}
      />

      <div className="flex min-w-0 flex-col gap-2">
        <div className="text-sm text-neutral-400">
          {[seriesName, episode.seasonNumber === 0 ? 'Specials' : episode.seasonNumber !== undefined ? `Season ${episode.seasonNumber}` : '', episode.episodeNumber !== undefined ? `Episode ${episode.episodeNumber}` : '']
            .filter(Boolean)
            .join(' · ')}
        </div>
        <h1 className="text-xl leading-tight font-semibold">{episode.name}</h1>
        <p className="text-xs text-neutral-400">
          {[aired, minutes && `${minutes} min`, played ? 'Watched' : resumeAt > 0 ? `Stopped at ${formatTime(resumeAt)}` : undefined]
            .filter(Boolean)
            .join(' · ')}
        </p>

        {episode.overview &&
          (hideSpoilers ? (
            <button type="button" onClick={() => setRevealed(true)} className="self-start text-sm text-neutral-500 hover:text-neutral-300">
              Description hidden (unwatched) · show
            </button>
          ) : (
            <p className="max-w-3xl text-sm text-neutral-300">{episode.overview}</p>
          ))}

        <div className="mt-1 flex flex-wrap gap-2">
          <Button variant="primary" className="flex items-center gap-1.5" onClick={() => play(episode.id)}>
            <PlayIcon className="size-4" />
            {resumeAt > 0 ? `Resume from ${formatTime(resumeAt)}` : 'Play'}
          </Button>
          {resumeAt > 0 && (
            <Button variant="outlined" onClick={() => play(episode.id, 'beginning')}>
              Play from start
            </Button>
          )}
          <Button variant="outlined" onClick={toggleWatched}>
            {played ? 'Mark unwatched' : 'Mark watched'}
          </Button>
        </div>

        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-neutral-500">Audio</dt>
          <dd className="text-neutral-300">{trackList(tracks.audio)}</dd>
          <dt className="text-neutral-500">Subtitles</dt>
          <dd className="text-neutral-300">{trackList(tracks.subtitles)}</dd>
        </dl>

        <div className="mt-2 flex gap-2">
          {previousId && (
            <Link to={episodePath(previousId, episode.seriesId)} className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
              ← Previous episode
            </Link>
          )}
          {nextId && (
            <Link to={episodePath(nextId, episode.seriesId)} className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
              Next episode →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
