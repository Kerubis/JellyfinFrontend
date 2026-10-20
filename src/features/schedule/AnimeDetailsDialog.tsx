import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { useAnimeDetails } from '@/api/schedule'
import { Button } from '@/components/Button'
import { episodeLabel, type LibrarySeries, type ScheduleEntry } from '@/domain/schedule'
import { AirTypeBadge } from './ScheduleEntryCard'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{children}</dd>
    </>
  )
}

const external = 'rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200 hover:bg-neutral-600'

/** Details of one show from the schedule, with the (for now placeholder) Seerr request. */
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
  const [requested, setRequested] = useState(false)
  const first = entries[0]
  const d = details.data

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const title = d?.title ?? first?.title ?? route
  const english = d?.english ?? first?.english
  const image = d?.image ?? first?.image

  return createPortal(
    // Below the header bar (Layout: h-11), which stays usable and un-dimmed.
    <div className="fixed inset-x-0 top-11 bottom-0 z-40 flex overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:p-10" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // m-auto centres it, and still scrolls from the top when it is taller than the window. Lighter panel, a
        // visible border and a Jellyfin-blue glow set it apart from the darkened, blurred page.
        className="relative m-auto flex w-full max-w-5xl gap-5 rounded-lg border border-neutral-600 bg-neutral-800 p-5 shadow-[0_0_40px_rgba(0,164,220,0.25)] max-sm:gap-3 max-sm:p-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute top-2 right-3 text-lg text-neutral-400 hover:text-white" aria-label="Close">
          ✕
        </button>
        {/* The series page header's full poster size (w-60); phones get its minimum. */}
        <div className="aspect-[2/3] w-60 shrink-0 self-start overflow-hidden rounded bg-neutral-700 max-sm:w-28">
          {image && <img src={image} alt="" className="size-full object-cover" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="pr-6">
            <h2 className="text-xl leading-tight font-semibold">{title}</h2>
            {english && english !== title && <p className="text-sm text-neutral-400">{english}</p>}
            {d?.native && <p className="text-xs text-neutral-500">{d.native}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {librarySeries && (
              <Link
                to={`/series/${librarySeries.id}`}
                className="rounded border-2 border-accent-600 px-3 py-1 text-sm font-medium text-accent-300 hover:bg-accent-600/20"
                title={librarySeries.name}
              >
                In your library: open series
              </Link>
            )}
            <Button variant="primary" onClick={() => setRequested(true)}>
              Request with Seerr
            </Button>
            {requested && <span className="text-xs text-neutral-400">Seerr isn't connected yet, so nothing was requested.</span>}
          </div>

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
                {d.genres.length > 0 && <Row label="Genres">{d.genres.map((g) => g.name).join(', ')}</Row>}
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
        </div>
      </div>
    </div>,
    document.body,
  )
}
