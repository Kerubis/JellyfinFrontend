import type { MouseEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useItemLibraryResolver } from '@/api/queries/items'
import type { EpisodeRef, MediaItem } from '@/domain/media'
import { episodePath, itemPath, seasonPath } from '@/features/home/links'

const pad = (n: number) => String(n).padStart(2, '0')
const LINK = 'rounded hover:text-accent-300 hover:underline focus-visible:outline-2 focus-visible:outline-accent-400'

/** Year (or "2019–2023" for an ended series) linking to the item's library filtered by that year. */
function YearLink({ item }: { item: MediaItem }) {
  const navigate = useNavigate()
  const resolveLibrary = useItemLibraryResolver()
  if (!item.year) return null
  const text = item.endYear && item.endYear !== item.year ? `${item.year}–${item.endYear}` : String(item.year)
  const open = async (e: MouseEvent) => {
    e.preventDefault()
    const libraryId = await resolveLibrary(item.kind === 'episode' || item.kind === 'season' ? (item.seriesId ?? item.id) : item.id).catch(() => null)
    if (libraryId) navigate(`/library/${libraryId}?year=${item.year}`)
  }
  return (
    <a href="#" onClick={(e) => void open(e)} className={LINK} title={`More from ${item.year}`}>
      {text}
    </a>
  )
}

function SeasonLink({ seriesId, id, number, long }: { seriesId?: string; id?: string; number?: number; long?: boolean }) {
  if (number === undefined) return null
  const text = long ? (number === 0 ? 'Specials' : `Season ${number}`) : `S${pad(number)}`
  return seriesId ? (
    <Link to={seasonPath(seriesId, { id, number })} className={LINK}>
      {text}
    </Link>
  ) : (
    <span>{text}</span>
  )
}

function EpisodeLink({ id, seriesId, number }: { id: string; seriesId?: string; number?: number }) {
  if (number === undefined) return null
  return (
    <Link to={episodePath(id, seriesId)} className={LINK}>
      E{pad(number)}
    </Link>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Second line by item kind (see MediaCaption). */
function Details({ item, next }: { item: MediaItem; next?: EpisodeRef }) {
  const parts: ReactNode[] = []
  if (next) {
    // Currently Watching: the episode that plays next.
    parts.push(<SeasonLink key="s" seriesId={next.seriesId} number={next.seasonNumber} />, <EpisodeLink key="e" id={next.id} seriesId={next.seriesId} number={next.episodeNumber} />)
    return <Joined parts={parts} separator=" " />
  }
  switch (item.kind) {
    case 'movie':
      parts.push(<YearLink key="y" item={item} />)
      break
    case 'series':
      parts.push(<YearLink key="y" item={item} />)
      if (item.childCount) parts.push(plural(item.childCount, 'season'))
      break
    case 'season':
      parts.push(<SeasonLink key="s" seriesId={item.seriesId} id={item.id} number={item.seasonNumber} long />)
      if (item.childCount) parts.push(plural(item.childCount, 'episode'))
      break
    case 'episode':
      parts.push(
        <SeasonLink key="s" seriesId={item.seriesId} id={item.seasonId} number={item.seasonNumber} />,
        <EpisodeLink key="e" id={item.id} seriesId={item.seriesId} number={item.episodeNumber} />,
      )
      return <Joined parts={parts} separator=" " />
  }
  return <Joined parts={parts} separator=" · " />
}

function Joined({ parts, separator }: { parts: ReactNode[]; separator: string }) {
  const visible = parts.filter((p) => p !== null && p !== undefined && p !== '')
  return (
    <>
      {visible.map((part, i) => (
        <span key={i}>
          {i > 0 && separator}
          {part}
        </span>
      ))}
    </>
  )
}

/**
 * The two lines under every media tile:
 * 1. title (series name for seasons/episodes), linking to the item
 * 2. movie: year · series: years · N seasons · season: Season N · N episodes · episode: S01 E05
 *    (Currently Watching passes `next` to show the next episode instead.)
 */
export function MediaCaption({ item, next, title }: { item: MediaItem; next?: EpisodeRef; title?: string }) {
  const name = title ?? (item.kind === 'episode' || item.kind === 'season' ? (item.seriesName ?? item.name) : item.name)
  const to = itemPath(item)
  return (
    <div className="mt-1 min-w-0 leading-tight">
      <Link to={to} className={`block truncate text-xs font-medium ${LINK}`} title={name}>
        {name}
      </Link>
      <div className="truncate text-[11px] text-neutral-400">
        <Details item={item} next={next} />
      </div>
    </div>
  )
}
