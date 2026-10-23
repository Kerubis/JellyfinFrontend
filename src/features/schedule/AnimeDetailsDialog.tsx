import { Link } from 'react-router'
import { useAnimeDetails } from '@/api/schedule'
import { Chips, DetailRow as Row, DetailsDialog } from '@/components/DetailsDialog'
import { episodeLabel, type LibrarySeries, type ScheduleEntry } from '@/domain/schedule'
import { AirTypeBadge } from './ScheduleEntryCard'
import { SeerrRequest } from './SeerrRequest'

const external = 'rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200 hover:bg-neutral-600'

/** Details of one show from the schedule, with its Seerr request state. */
export function AnimeDetailsDialog({
  route,
  entries,
  formatDate,
  librarySeries,
  onClose,
}: {
  route: string
  /** This show's airings in the loaded weeks. */
  entries: ScheduleEntry[]
  formatDate: (iso: string) => string
  /** The matching series in the Jellyfin library (by title), if any. */
  librarySeries?: LibrarySeries
  onClose: () => void
}) {
  const details = useAnimeDetails(route)
  const first = entries[0]
  const d = details.data

  const title = d?.title ?? first?.title ?? route
  const english = d?.english ?? first?.english
  const image = d?.image ?? first?.image

  return (
    <DetailsDialog label={title} image={image} onClose={onClose}>
      <div className="pr-6">
        <h2 className="text-xl leading-tight font-semibold">{title}</h2>
        {english && english !== title && <p className="text-sm text-neutral-400">{english}</p>}
        {d?.native && <p className="text-xs text-neutral-500">{d.native}</p>}
      </div>

      {librarySeries && (
        <Link
          to={`/series/${librarySeries.id}`}
          className="self-start rounded border-2 border-accent-600 px-3 py-1 text-sm font-medium text-accent-300 hover:bg-accent-600/20"
          title={librarySeries.name}
        >
          In your library: open series
        </Link>
      )}
      <SeerrRequest details={d} />

      {entries.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs">
          {entries.map((e) => (
            <li key={`${e.airType}-${e.airsAt}`} className="flex items-center gap-2">
              <AirTypeBadge type={e.airType} />
              <span className="text-neutral-200">{formatDate(e.airsAt)}</span>
              <span className="text-neutral-400">{episodeLabel(e)}</span>
              {e.status === 'delayed' && <span className="text-red-400">{e.delayedText ?? 'Delayed'}</span>}
            </li>
          ))}
        </ul>
      )}

      {details.isPending && <p className="text-xs text-neutral-500">Loading details…</p>}
      {details.error && <p className="text-xs text-red-400">{details.error.message}</p>}
      {d && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
            {d.season && <Row label="Season">{d.season}</Row>}
            {d.status && <Row label="Status">{d.status}</Row>}
            {d.mediaTypes.length > 0 && <Row label="Type">{d.mediaTypes.map((t) => t.name).join(', ')}</Row>}
            {(d.episodes > 0 || d.lengthMin > 0) && (
              <Row label="Episodes">
                {d.episodes > 0 ? d.episodes : '?'}
                {d.lengthMin > 0 && ` × ${d.lengthMin} min`}
              </Row>
            )}
            {d.premier && <Row label="Premiere">{formatDate(d.premier)}</Row>}
            {d.subPremier && <Row label="Sub premiere">{formatDate(d.subPremier)}</Row>}
            {d.dubPremier && <Row label="Dub premiere">{formatDate(d.dubPremier)}</Row>}
            {d.studios.length > 0 && <Row label="Studios">{d.studios.map((s) => s.name).join(', ')}</Row>}
            {d.sources.length > 0 && <Row label="Source">{d.sources.map((s) => s.name).join(', ')}</Row>}
            {d.genres.length > 0 && (
              <Row label="Genres">
                <Chips items={d.genres.map((g) => g.name)} />
              </Row>
            )}
          </dl>
          {d.description && <p className="text-sm whitespace-pre-line text-neutral-300">{d.description}</p>}
          {d.streams.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-neutral-500">Watch on</span>
              {d.streams.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className={external}>
                  {s.name}
                </a>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {d.links.map((l) => (
              <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className={external}>
                {l.label}
              </a>
            ))}
          </div>
        </>
      )}
    </DetailsDialog>
  )
}
