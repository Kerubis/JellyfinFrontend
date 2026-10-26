import { Link } from 'react-router'
import { useSeerrMedia } from '@/api/seerr'
import { MediaTile } from '@/components/MediaTile'
import { libraryPath, STATUS_MARKER, type SeerrRequestEntry, type SeerrResult } from '@/domain/seerr'

const KIND_LABEL = { movie: 'Movie', tv: 'TV' } as const

/**
 * A movie or show from Seerr: poster with its Seerr state in the marker corner. Titles in the library get the
 * Jellyfin-blue ring and open their own page (like the schedule); the rest open the request popup.
 */
export function SeerrTile({ result, detail, onOpen }: { result: SeerrResult; /** e.g. a person's roles in it. */ detail?: string; onOpen: () => void }) {
  const path = libraryPath(result)
  const label = `${result.title}${result.year ? ` (${result.year})` : ''}${detail ? `\n${detail}` : ''}${path ? '\nIn your library' : ''}`
  const caption = (
    <>
      <div className="mt-1 truncate text-xs leading-tight font-medium">{result.title}</div>
      <div className="truncate text-[11px] leading-tight text-neutral-400">
        {KIND_LABEL[result.kind]}
        {result.year && ` · ${result.year}`}
        {detail && ` · ${detail}`}
      </div>
    </>
  )
  return (
    <li className="relative min-w-0">
      <MediaTile
        imageUrl={result.poster}
        aspect="poster"
        title={label}
        href={path}
        onSelect={path ? undefined : onOpen}
        marker={STATUS_MARKER[result.status]}
        highlighted={!!path}
      />
      {path ? (
        <Link to={path} tabIndex={-1} className="block rounded hover:text-accent-300">
          {caption}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} tabIndex={-1} className="block w-full rounded text-left hover:text-accent-300">
          {caption}
        </button>
      )}
    </li>
  )
}

/** One of the profile's requests: the title's details are loaded per tile, the state comes from the request. */
export function RequestTile({ request, onOpen }: { request: SeerrRequestEntry; onOpen: () => void }) {
  const media = useSeerrMedia(request)
  if (!media.data) {
    return (
      <li className="min-w-0">
        <div className="aspect-[2/3] animate-pulse rounded bg-neutral-800" />
      </li>
    )
  }
  return <SeerrTile result={{ ...media.data, status: request.status }} onOpen={onOpen} />
}
