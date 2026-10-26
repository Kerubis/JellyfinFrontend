import { Navigate, useParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import { usePref } from '@/api/prefs-context'
import { useMovie, useSetFavorite, useSimilar } from '@/api/queries/movies'
import { useSetPlayed } from '@/api/queries/series'
import { Button } from '@/components/Button'
import { CardRow } from '@/components/cards'
import { MediaTile } from '@/components/MediaTile'
import { PlayIcon } from '@/components/PlayOverlay'
import type { MovieDetails } from '@/domain/movie'
import { formatTime, TICKS_PER_SECOND } from '@/domain/player'
import { runtimeMinutes } from '@/domain/series'
import type { AudioStream, SubtitleStream } from '@/domain/tracks'
import { episodePath, seriesPath } from '@/features/home/links'
import { MediaItemCard } from '@/features/media/MediaItemCard'
import { usePlay } from '@/features/player/player-context'
import { ServiceLinks } from '@/features/requests/ServiceLinks'
import { languageName } from '@/lib/languages'

function trackList(streams: readonly (AudioStream | SubtitleStream)[]): string {
  const names = [...new Set(streams.map((s) => languageName(s.language)))]
  return names.length > 0 ? names.join(', ') : 'none'
}

function metaLine(movie: MovieDetails): string {
  const minutes = runtimeMinutes(movie.runtimeTicks)
  const runtime = minutes ? (minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`) : ''
  const rating = movie.communityRating ? `★ ${movie.communityRating.toFixed(1)}` : ''
  const critics = movie.criticRating !== undefined ? `Critics ${movie.criticRating}%` : ''
  return [movie.year, runtime, movie.officialRating, rating, critics].filter(Boolean).join(' · ')
}

/** `/item/:id`: movie details; series / episodes redirect to their own pages. */
export function MoviePage() {
  const { itemId = '' } = useParams()
  const query = useMovie(itemId)
  if (query.isPending) return <p className="text-sm text-neutral-500">Loading…</p>
  if (query.isError) return <p className="text-sm text-red-400">{errorMessage(query.error)}</p>
  const movie = query.data
  if (movie.kind === 'series') return <Navigate to={seriesPath(movie.id)} replace />
  if (movie.kind === 'episode') return <Navigate to={episodePath(movie.id, movie.seriesId)} replace />
  return <MovieDetailsView movie={movie} />
}

function MovieDetailsView({ movie }: { movie: MovieDetails }) {
  const play = usePlay()
  const setPlayed = useSetPlayed()
  const setFavorite = useSetFavorite()
  const { cardSize } = usePref('ui').value
  const similar = useSimilar(movie.id)
  const resumeAt = !movie.played && movie.positionTicks > 0 ? movie.positionTicks / TICKS_PER_SECOND : 0
  const progress = resumeAt > 0 && movie.runtimeTicks ? movie.positionTicks / movie.runtimeTicks : undefined
  const toggleWatched = () => setPlayed.mutate({ itemId: movie.id, played: !movie.played, episodes: [] })
  const directors = movie.people.filter((p) => p.type === 'director').map((p) => p.name)
  const writers = movie.people.filter((p) => p.type === 'writer').map((p) => p.name)
  const cast = movie.people.filter((p) => p.type === 'actor').slice(0, 10)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="w-40 shrink-0 self-start sm:w-56">
          <MediaTile
            aspect="poster"
            imageUrl={movie.posterUrl}
            title={`Play ${movie.name}`}
            onPlay={() => play(movie.id)}
            progress={progress}
            watched={{ watched: movie.played, label: movie.name, onToggle: toggleWatched }}
          />
        </div>

        <div className="flex min-w-0 max-w-3xl flex-col gap-2">
          <h1 className="text-2xl leading-tight font-semibold">{movie.name}</h1>
          <p className="text-sm text-neutral-400">{metaLine(movie)}</p>
          {movie.genres.length > 0 && <p className="text-xs text-neutral-500">{movie.genres.join(', ')}</p>}
          {movie.tagline && <p className="text-sm text-neutral-300 italic">{movie.tagline}</p>}
          {movie.overview && <p className="text-sm text-neutral-300">{movie.overview}</p>}

          <div className="mt-1 flex flex-wrap gap-2">
            <Button variant="primary" className="flex items-center gap-1.5" onClick={() => play(movie.id)}>
              <PlayIcon className="size-4" />
              {resumeAt > 0 ? `Resume from ${formatTime(resumeAt)}` : 'Play'}
            </Button>
            {resumeAt > 0 && (
              <Button variant="outlined" onClick={() => play(movie.id, 'beginning')}>
                Play from start
              </Button>
            )}
            <Button variant="outlined" onClick={toggleWatched}>
              {movie.played ? 'Mark unwatched' : 'Mark watched'}
            </Button>
            <Button
              variant="outlined"
              disabled={setFavorite.isPending}
              onClick={() => setFavorite.mutate({ itemId: movie.id, favorite: !movie.isFavorite })}
            >
              {movie.isFavorite ? '★ Favorite' : '☆ Favorite'}
            </Button>
            <ServiceLinks kind="movie" tmdbId={movie.tmdbId} />
          </div>

          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {directors.length > 0 && (
              <>
                <dt className="text-neutral-500">Director</dt>
                <dd>{directors.join(', ')}</dd>
              </>
            )}
            {writers.length > 0 && (
              <>
                <dt className="text-neutral-500">Writers</dt>
                <dd>{writers.slice(0, 4).join(', ')}</dd>
              </>
            )}
            {cast.length > 0 && (
              <>
                <dt className="text-neutral-500">Cast</dt>
                <dd>{cast.map((p) => (p.role ? `${p.name} (${p.role})` : p.name)).join(', ')}</dd>
              </>
            )}
            {movie.studios.length > 0 && (
              <>
                <dt className="text-neutral-500">Studio</dt>
                <dd>{movie.studios.slice(0, 3).join(', ')}</dd>
              </>
            )}
            <dt className="text-neutral-500">Audio</dt>
            <dd>{trackList(movie.tracks.audio)}</dd>
            <dt className="text-neutral-500">Subtitles</dt>
            <dd>{trackList(movie.tracks.subtitles)}</dd>
          </dl>
        </div>
      </div>

      {similar.data && similar.data.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">More like this</h2>
          <CardRow size={cardSize} variant="poster">
            {similar.data.map((item) => (
              <MediaItemCard key={item.id} item={item} />
            ))}
          </CardRow>
        </section>
      )}
    </div>
  )
}
