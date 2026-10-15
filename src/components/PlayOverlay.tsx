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

/** Blue circle with a black play icon. */
export function PlayCircle({ size = 'md' }: { size?: Size }) {
  const s = SIZES[size]
  return (
    <span className={`flex items-center justify-center rounded-full bg-accent-600/90 shadow-lg ${s.circle}`}>
      <PlayIcon className={`text-black ${s.icon}`} />
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
