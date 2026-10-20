import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useScrollOverflow } from '@/hooks/useScrollOverflow'
import { MediaTile, type MediaTileActions } from './MediaTile'
import type { CardSize } from '@/domain/prefs'

const POSTER_MIN: Record<CardSize, string> = {
  xs: 'grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]',
  sm: 'grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]',
  md: 'grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]',
  lg: 'grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]',
  xl: 'grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))]',
}

const THUMB_MIN: Record<CardSize, string> = {
  xs: 'grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]',
  sm: 'grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]',
  md: 'grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]',
  lg: 'grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]',
  xl: 'grid-cols-[repeat(auto-fill,minmax(24rem,1fr))]',
}

const POSTER_WIDTH: Record<CardSize, string> = { xs: '*:w-[5.5rem]', sm: '*:w-28', md: '*:w-36', lg: '*:w-44', xl: '*:w-54' }
const THUMB_WIDTH: Record<CardSize, string> = { xs: '*:w-40', sm: '*:w-52', md: '*:w-64', lg: '*:w-80', xl: '*:w-96' }

type CardListProps = { size: CardSize; variant: 'poster' | 'thumb'; children: ReactNode }

/** Wrapping grid: everything visible at once (Currently Watching). */
export function CardGrid({ size, variant, children }: CardListProps) {
  return <ul className={`grid gap-x-2 gap-y-3 ${(variant === 'poster' ? POSTER_MIN : THUMB_MIN)[size]}`}>{children}</ul>
}

/** Single row that scrolls horizontally, with arrow buttons when there is more. */
export function CardRow({ size, variant, children }: CardListProps) {
  const ref = useRef<HTMLUListElement>(null)
  const { canLeft, canRight, page } = useScrollOverflow(ref)
  const width = (variant === 'poster' ? POSTER_WIDTH : THUMB_WIDTH)[size]

  return (
    <div className="relative">
      <ul
        ref={ref}
        className={`flex snap-x gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] *:shrink-0 *:snap-start ${width}`}
      >
        {children}
      </ul>
      {canLeft && <ScrollButton direction={-1} onClick={() => page(-1)} />}
      {canRight && <ScrollButton direction={1} onClick={() => page(1)} />}
    </div>
  )
}

function ScrollButton({ direction, onClick }: { direction: 1 | -1; onClick: () => void }) {
  const side = direction === 1 ? 'right-0 bg-gradient-to-l' : 'left-0 bg-gradient-to-r'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 1 ? 'Scroll right' : 'Scroll left'}
      // Covers the image area (cards' text lines are below); fades into the row.
      className={`absolute top-0 bottom-8 ${side} flex w-10 items-center justify-center from-black/70 via-black/40 to-transparent text-2xl text-neutral-200 hover:text-white focus-visible:outline-2 focus-visible:outline-accent-400`}
    >
      {direction === 1 ? '›' : '‹'}
    </button>
  )
}

type CardProps = MediaTileActions & {
  to: string
  title: string
  subtitle?: ReactNode
  imageUrl?: string
  /** Unwatched count, top-left. */
  count?: number
  /** NEW / NEXT marker, bottom-left. */
  marker?: string
  progress?: number
  /** Permanent Jellyfin-blue ring (MediaTile). */
  highlighted?: boolean
  tooltip?: string
  /** Replaces the default title/subtitle block (e.g. MediaCaption with its own links). */
  caption?: ReactNode
}

/** Card = MediaTile (image + all overlays) + title/subtitle linking to `to`. */
function Card({ variant, to, title, subtitle, tooltip, caption, ...tile }: CardProps & { variant: 'poster' | 'thumb' }) {
  return (
    <li className="relative min-w-0">
      <MediaTile {...tile} aspect={variant} title={tooltip ?? title} href={to} />
      {caption ?? (
        <Link
          to={to}
          className="block rounded hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
        >
          <div className="mt-1 truncate text-xs leading-tight font-medium">{title}</div>
          {subtitle && <div className="truncate text-[11px] leading-tight text-neutral-400">{subtitle}</div>}
        </Link>
      )}
    </li>
  )
}

export const PosterCard = (props: CardProps) => <Card variant="poster" {...props} />
export const ThumbCard = (props: CardProps) => <Card variant="thumb" {...props} />
