import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useScrollOverflow } from '@/hooks/useScrollOverflow'
import { CountLabel, MarkerLabel } from './CornerLabel'
import { PlayOverlay } from './PlayOverlay'
import { CORNER } from './corners'
import type { CardSize } from '@/domain/prefs'

const POSTER_MIN: Record<CardSize, string> = {
  xs: 'grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]',
  sm: 'grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]',
  md: 'grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]',
}

const THUMB_MIN: Record<CardSize, string> = {
  xs: 'grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]',
  sm: 'grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]',
  md: 'grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]',
}

const POSTER_WIDTH: Record<CardSize, string> = { xs: '*:w-[5.5rem]', sm: '*:w-28', md: '*:w-36' }
const THUMB_WIDTH: Record<CardSize, string> = { xs: '*:w-40', sm: '*:w-52', md: '*:w-64' }

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
      className={`absolute top-0 bottom-8 ${side} flex w-10 items-center justify-center from-neutral-950 via-neutral-950/80 to-transparent text-2xl text-neutral-200 hover:text-white focus-visible:outline-2 focus-visible:outline-accent-400`}
    >
      {direction === 1 ? '›' : '‹'}
    </button>
  )
}

type CardProps = {
  to: string
  title: string
  subtitle?: ReactNode
  imageUrl?: string
  /** Unwatched count, top-left. */
  count?: number
  /** NEW / NEXT marker, bottom-left. */
  marker?: string
  progress?: number
  /** When set, the image is a play button (with hover overlay) and only the text links to `to`. */
  onPlay?: () => void
  /** Small secondary action on hover (e.g. "open series" while the card itself plays). */
  secondary?: { to: string; label: string }
  /** Small "remove" button top-right on hover. */
  onRemove?: { label: string; onClick: () => void }
  tooltip?: string
}

function CardImage({ url, aspect, children }: { url?: string; aspect: string; children?: ReactNode }) {
  return (
    <div className={`relative ${aspect} overflow-hidden rounded bg-neutral-800`}>
      {url && <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}
      {children}
    </div>
  )
}

function Overlays({ count, marker, progress }: Pick<CardProps, 'count' | 'marker' | 'progress'>) {
  return (
    <>
      {count !== undefined && count > 0 && <CountLabel count={count} />}
      {marker && <MarkerLabel>{marker}</MarkerLabel>}
      {progress !== undefined && (
        // Above the bottom-left marker so the progress stays readable.
        <span className="absolute inset-x-0 bottom-0 z-10 h-1 bg-black/60">
          <span className="block h-full bg-accent-500" style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      )}
    </>
  )
}

function Card({ variant, ...props }: CardProps & { variant: 'poster' | 'thumb' }) {
  const { to, title, subtitle, imageUrl, onPlay, secondary, onRemove, tooltip } = props
  const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400'
  const image = (
    <CardImage url={imageUrl} aspect={variant === 'poster' ? 'aspect-[2/3]' : 'aspect-video'}>
      <Overlays {...props} />
      {onPlay && <PlayOverlay />}
      <span className="absolute inset-0 rounded ring-accent-400 transition group-hover:ring-2" />
    </CardImage>
  )
  const text = (
    <>
      <div className="mt-1 truncate text-xs leading-tight font-medium">{title}</div>
      {subtitle && <div className="truncate text-[11px] leading-tight text-neutral-400">{subtitle}</div>}
    </>
  )
  return (
    <li className="group relative min-w-0">
      {onPlay ? (
        <>
          <button type="button" onClick={onPlay} title={tooltip ?? title} className={`block w-full rounded ${focus}`}>
            {image}
          </button>
          <Link to={to} className={`block rounded hover:text-accent-300 ${focus}`}>
            {text}
          </Link>
        </>
      ) : (
        <Link to={to} title={tooltip ?? title} className={`block rounded ${focus}`}>
          {image}
          {text}
        </Link>
      )}
      {secondary && (
        <Link
          to={secondary.to}
          title={secondary.label}
          aria-label={secondary.label}
          className="absolute right-1 bottom-9 hidden size-6 items-center justify-center rounded-full bg-black/80 text-xs text-neutral-100 group-focus-within:flex group-hover:flex hover:bg-accent-600"
        >
          ⋯
        </Link>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove.onClick}
          title={onRemove.label}
          aria-label={onRemove.label}
          className={`group/remove absolute ${CORNER.tr} hidden items-center justify-center bg-black/75 p-2 group-focus-within:flex group-hover:flex`}
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-neutral-700 text-sm text-neutral-200 transition group-hover/remove:bg-red-600 group-hover/remove:text-white">
            ×
          </span>
        </button>
      )}
    </li>
  )
}

export const PosterCard = (props: CardProps) => <Card variant="poster" {...props} />
export const ThumbCard = (props: CardProps) => <Card variant="thumb" {...props} />
