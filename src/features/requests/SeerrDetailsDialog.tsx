import { Link } from 'react-router'
import { useSeerrConfig, useSeerrMedia } from '@/api/seerr'
import { Chips, DetailRow as Row, DetailsDialog } from '@/components/DetailsDialog'
import { libraryPath, type SeerrKind } from '@/domain/seerr'
import { SeerrPanel } from './SeerrPanel'

/** Details of a movie or show from Seerr, with its request state per season. */
export function SeerrDetailsDialog({ target, onClose }: { target: { kind: SeerrKind; tmdbId: number }; onClose: () => void }) {
  const config = useSeerrConfig()
  const media = useSeerrMedia(target)
  const m = media.data
  const path = m && libraryPath(m)

  return (
    <DetailsDialog label={m?.title ?? 'Details'} image={m?.poster} onClose={onClose}>
      {media.isPending && <p className="text-xs text-neutral-500">Loading…</p>}
      {media.error && <p className="text-xs text-red-400">{media.error.message}</p>}
      {m && (
        <>
          <div className="pr-6">
            <h2 className="text-xl leading-tight font-semibold">{m.title}</h2>
            <p className="text-sm text-neutral-400">
              {m.kind === 'movie' ? 'Movie' : 'TV'}
              {m.year && ` · ${m.year}`}
            </p>
          </div>

          {path && (
            <Link
              to={path}
              className="self-start rounded border-2 border-accent-600 px-3 py-1 text-sm font-medium text-accent-300 hover:bg-accent-600/20"
            >
              In your library: open {m.kind === 'movie' ? 'movie' : 'series'}
            </Link>
          )}
          {config && <SeerrPanel key={`${m.kind}-${m.tmdbId}`} media={m} seerrUrl={config.url} />}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
            {m.tmdbStatus && <Row label="Status">{m.tmdbStatus}</Row>}
            {m.kind === 'tv' && m.seasons.length > 0 && (
              <Row label="Seasons">
                {m.seasons.length} · {m.seasons.reduce((n, s) => n + s.episodes, 0)} episodes
              </Row>
            )}
            {m.runtime && <Row label={m.kind === 'movie' ? 'Runtime' : 'Episode length'}>{m.runtime} min</Row>}
            {m.networks.length > 0 && <Row label="Network">{m.networks.join(', ')}</Row>}
            {m.genres.length > 0 && (
              <Row label="Genres">
                <Chips items={m.genres} />
              </Row>
            )}
          </dl>
          {m.overview && <p className="text-sm text-neutral-300">{m.overview}</p>}
        </>
      )}
    </DetailsDialog>
  )
}
