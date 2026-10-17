/** Play triangle as SVG (the ▶ character renders as a colored emoji on some systems). */
export function PlayIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" fill="currentColor" />
    </svg>
  )
}

const SIZES = {
  md: { circle: 'size-18', icon: 'size-9' },
  lg: { circle: 'size-21', icon: 'size-11' },
}

type Size = keyof typeof SIZES

/**
 * While the thing that starts playback is hovered or focused, the circle lifts (bigger, brighter, blue glow)
 * and a ring pings outward from its edge. `group` = the surrounding `group` element (the whole tile/poster
 * plays), `self` = only the circle's own button, marked `group/play` (tiles where a click elsewhere does
 * something else, e.g. pick a season).
 */
const LIFT = {
  group:
    'group-hover:scale-108 group-hover:bg-accent-500 group-hover:shadow-[0_0_24px_rgb(0_164_220/0.55)] group-focus-visible:scale-108 group-focus-visible:bg-accent-500 group-focus-visible:shadow-[0_0_24px_rgb(0_164_220/0.55)]',
  self: 'group-hover/play:scale-108 group-hover/play:bg-accent-500 group-hover/play:shadow-[0_0_24px_rgb(0_164_220/0.55)] group-focus-visible/play:scale-108 group-focus-visible/play:bg-accent-500 group-focus-visible/play:shadow-[0_0_24px_rgb(0_164_220/0.55)]',
}
const PING = {
  group: 'motion-safe:group-hover:animate-play-ping motion-safe:group-focus-visible:animate-play-ping',
  self: 'motion-safe:group-hover/play:animate-play-ping motion-safe:group-focus-visible/play:animate-play-ping',
}

/** Jellyfin-blue circle with a black play icon. */
export function PlayCircle({ size = 'md', trigger = 'group' }: { size?: Size; trigger?: keyof typeof LIFT }) {
  const s = SIZES[size]
  return (
    <span
      className={`relative flex items-center justify-center rounded-full bg-accent-600/90 shadow-lg transition-[scale,background-color,box-shadow] duration-200 ${LIFT[trigger]} ${s.circle}`}
    >
      <span aria-hidden className={`pointer-events-none absolute inset-0 rounded-full border-2 border-accent-400 opacity-0 ${PING[trigger]}`} />
      <PlayIcon className={`relative text-black ${s.icon}`} />
    </span>
  )
}

/** Darkened hover overlay with a play circle; place inside a `group` element that is the play button. */
export function PlayOverlay({ size = 'md' }: { size?: Size }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
      <PlayCircle size={size} />
    </span>
  )
}
