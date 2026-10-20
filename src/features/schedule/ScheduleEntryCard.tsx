import { PosterCard } from '@/components/cards'
import { MediaTile } from '@/components/MediaTile'
import type { MediaItem } from '@/domain/media'
import { itemPath } from '@/features/home/links'
import { useMediaActions } from '@/features/media/useMediaActions'
import { episodeLabel, type AirType, type ScheduleEntry } from '@/domain/schedule'

const AIR_TYPE_STYLE: Record<AirType, string> = {
  raw: 'bg-neutral-700 text-neutral-200',
  sub: 'bg-accent-700 text-white',
  dub: 'bg-purple-700 text-white',
}

export function AirTypeBadge({ type }: { type: AirType }) {
  return <span className={`rounded px-1 text-[10px] leading-4 font-bold uppercase ${AIR_TYPE_STYLE[type]}`}>{type}</span>
}

type Props = {
  entry: ScheduleEntry
  time: string
  /** Poster tile like everywhere else; off: a compact text card. */
  images: boolean
  /** The show is in the Jellyfin library: Jellyfin-blue border. */
  inLibrary: boolean
  onOpen: () => void
}

function tooltip(entry: ScheduleEntry, inLibrary: boolean): string {
  const title = entry.english && entry.english !== entry.title ? `${entry.title}\n${entry.english}` : entry.title
  return inLibrary ? `${title}\nIn your library` : title
}

/** Time · episode, or the delay note. */
function Details({ entry, time }: { entry: ScheduleEntry; time: string }) {
  return (
    <>
      <span className="text-neutral-200">{time}</span> · {episodeLabel(entry)}
      {entry.status === 'delayed' && <span className="text-red-400"> · {entry.delayedText ?? 'Delayed'}</span>}
    </>
  )
}

/** One airing: the shared media tile (air type in the marker corner) with title and time · episode below. */
export function ScheduleEntryCard({ entry, time, images, inLibrary, onOpen }: Props) {
  const aired = entry.status === 'aired'
  if (!images) {
    return (
      <li className="min-w-0">
        <button
          type="button"
          onClick={onOpen}
          title={tooltip(entry, inLibrary)}
          className={`flex w-full flex-col gap-0.5 rounded bg-neutral-900 px-2 py-1 text-left ring-inset transition hover:bg-neutral-800 hover:ring-2 hover:ring-accent-400 focus-visible:ring-2 focus-visible:outline-none ${
            inLibrary ? 'ring-2 ring-accent-600' : 'ring-accent-400'
          }`}
        >
          <span className={`truncate text-xs font-medium ${aired ? 'text-neutral-400' : 'text-neutral-100'}`}>{entry.title}</span>
          <span className="flex items-center gap-1.5 truncate text-[11px] text-neutral-400">
            <AirTypeBadge type={entry.airType} />
            <span className="truncate">
              <Details entry={entry} time={time} />
            </span>
          </span>
        </button>
      </li>
    )
  }
  return (
    <li className="relative min-w-0">
      <MediaTile
        imageUrl={entry.image}
        aspect="poster"
        title={tooltip(entry, inLibrary)}
        onSelect={onOpen}
        marker={entry.airType.toUpperCase()}
        highlighted={inLibrary}
      />
      <button
        type="button"
        onClick={onOpen}
        tabIndex={-1}
        className="block w-full rounded text-left hover:text-accent-300"
      >
        <div className={`mt-1 truncate text-xs leading-tight font-medium ${aired ? 'text-neutral-400' : ''}`}>{entry.title}</div>
        <div className="truncate text-[11px] leading-tight text-neutral-400">
          <Details entry={entry} time={time} />
        </div>
      </button>
    </li>
  )
}

/**
 * A show that is in the library: the normal media tile of its series (play next episode, ✓, ⋯ menu, unwatched
 * count, link to the series page), with the Jellyfin-blue ring and the airing's time · episode below.
 */
export function LibraryEntryCard({ entry, series, time }: { entry: ScheduleEntry; series: MediaItem; time: string }) {
  const { count, ...actions } = useMediaActions(series)
  return (
    <PosterCard
      {...actions}
      to={itemPath(series)}
      title={series.name}
      tooltip={`${series.name}\n${entry.title}`}
      subtitle={<Details entry={entry} time={time} />}
      imageUrl={series.posterUrl ?? entry.image}
      count={count}
      marker={entry.airType.toUpperCase()}
      highlighted
    />
  )
}
