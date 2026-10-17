import { Link } from 'react-router'
import { CardMenu, type CardMenuItem } from './CardMenu'
import { CountLabel, MarkerLabel } from './CornerLabel'
import { PlayCircle, PlayOverlay } from './PlayOverlay'
import { WatchedToggle } from './WatchedToggle'

/** What a tile can do; produced by `useMediaActions` (or a section-specific variant). */
export type MediaTileActions = {
  /** Play: the whole image (or only the centre circle when `onSelect` is set). */
  onPlay?: () => void
  /** Tooltip / label for play, e.g. "Play S01E05". */
  playLabel?: string
  /** ✓ in the top-right corner. */
  watched?: { watched: boolean; label: string; onToggle: () => void }
  /** "⋯" menu in the bottom-right corner. */
  menu?: readonly CardMenuItem[]
}

type Props = MediaTileActions & {
  imageUrl?: string
  aspect: 'poster' | 'thumb'
  /** Tooltip of the main click target. */
  title: string
  /** Main click selects instead of playing (season posters); play becomes the centre circle. */
  onSelect?: () => void
  /** Link target when the image neither plays nor selects. */
  href?: string
  /** Unwatched count, top-left. */
  count?: number
  /** NEW / NEXT, bottom-left. */
  marker?: string
  /** 0..1, bar along the bottom. */
  progress?: number
  /** Permanent ring (selected season, next episode). */
  selected?: boolean
  /** Spoiler protection: blur the image. */
  blurred?: boolean
  /** Only the top corners rounded (image sits on a banner). */
  roundedTop?: boolean
  /** ARIA for selectable tiles (season tabs). */
  tab?: { selected: boolean }
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400'

/**
 * The image part of every card, still and poster, with all overlays in fixed places (D21):
 * count top-left, NEW/NEXT bottom-left, ✓ top-right, ⋯ bottom-right, play in the middle, progress at
 * the bottom. Change the overlay design here and it changes everywhere.
 */
export function MediaTile(props: Props) {
  const { imageUrl, aspect, title, onPlay, playLabel, onSelect, href, watched, menu } = props
  const { count, marker, progress, selected, blurred, roundedTop, tab } = props
  const round = roundedTop ? 'rounded-t' : 'rounded'

  const image = (
    <div className={`relative ${aspect === 'poster' ? 'aspect-[2/3]' : 'aspect-video'} w-full overflow-hidden ${round} bg-neutral-800`}>
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className={`size-full object-cover transition ${blurred ? 'scale-110 blur-md' : ''}`}
        />
      )}
      {count !== undefined && count > 0 && <CountLabel count={count} />}
      {marker && <MarkerLabel>{marker}</MarkerLabel>}
      {progress !== undefined && (
        // Above the bottom-left marker so the progress stays readable.
        <span className="absolute inset-x-0 bottom-0 z-10 h-1 bg-black/60">
          <span className="block h-full bg-accent-500" style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      )}
      {onPlay && !onSelect && <PlayOverlay />}
      {/* Hover / selected ring; hidden while the ⋯ menu is open (it draws its own outline around tile + menu). */}
      <span
        className={`pointer-events-none absolute inset-0 ${round} ring-accent-400 ring-inset transition group-has-[[aria-expanded=true]]:hidden ${selected ? 'ring-2' : 'group-hover:ring-2'}`}
      />
    </div>
  )

  const main = onSelect ? (
    <button type="button" onClick={onSelect} title={title} role={tab ? 'tab' : undefined} aria-selected={tab?.selected} className={`block w-full ${round} ${FOCUS}`}>
      {image}
    </button>
  ) : onPlay ? (
    <button type="button" onClick={onPlay} title={playLabel ?? title} className={`block w-full ${round} ${FOCUS}`}>
      {image}
    </button>
  ) : href ? (
    <Link to={href} title={title} tabIndex={-1} className={`block ${round}`}>
      {image}
    </Link>
  ) : (
    image
  )

  return (
    <div className="group relative">
      {main}
      {onPlay && onSelect && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={onPlay}
            title={playLabel ?? 'Play'}
            aria-label={playLabel ?? 'Play'}
            className="group/play pointer-events-auto rounded-full opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:outline-none"
          >
            <PlayCircle trigger="self" />
          </button>
        </div>
      )}
      {watched && <WatchedToggle watched={watched.watched} label={watched.label} onToggle={watched.onToggle} />}
      {menu && menu.length > 0 && <CardMenu items={menu} />}
    </div>
  )
}
