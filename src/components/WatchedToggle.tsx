import { CORNER } from './corners'

type Props = {
  watched: boolean
  /** e.g. "S01E05" or "Season 2", for the accessible label. */
  label: string
  onToggle: () => void
}

/**
 * Overlay button for an image's top-right corner: a dark square with a ✓ circle (Jellyfin blue when
 * watched). Always visible once watched, otherwise only on hover/focus of the surrounding `group`.
 */
export function WatchedToggle({ watched, label, onToggle }: Props) {
  const action = watched ? 'Mark unwatched' : 'Mark watched'
  return (
    <button
      type="button"
      onClick={onToggle}
      title={action}
      aria-label={`${action}: ${label}`}
      aria-pressed={watched}
      // Flush with the image's top-right corner (matches its rounded corner), thick dark frame around the circle.
      className={`group/toggle absolute ${CORNER.tr} items-center justify-center bg-black/75 p-2 focus-visible:outline-2 focus-visible:outline-accent-400 ${
        watched ? 'flex' : 'hidden group-focus-within:flex group-hover:flex'
      }`}
    >
      <span
        className={`flex size-6 items-center justify-center rounded-full text-sm transition ${
          watched
            ? 'bg-accent-600 text-white group-hover/toggle:bg-accent-500'
            : 'bg-neutral-700 text-neutral-300 group-hover/toggle:bg-accent-600 group-hover/toggle:text-white'
        }`}
      >
        ✓
      </span>
    </button>
  )
}
