import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'

/**
 * Popup for a title that isn't (necessarily) in the library: poster on the left, `children` on the right.
 * Used by the schedule and the request page. Escape or a click outside closes it.
 */
export function DetailsDialog({ label, image, onClose, children }: { label: string; image?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    // Below the header bar (Layout: h-11), which stays usable and un-dimmed.
    <div className="fixed inset-x-0 top-11 bottom-0 z-40 flex overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:p-10" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
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
        <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** One label / value line in a dialog's details list (`<dl className="grid grid-cols-[auto_1fr] …">`). */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{children}</dd>
    </>
  )
}

/** Non-link chips (genres), styled like the dialogs' external link buttons. */
export function Chips({ items }: { items: readonly string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5 py-0.5">
      {items.map((item) => (
        <span key={item} className="rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200">
          {item}
        </span>
      ))}
    </span>
  )
}

/** Chips that link somewhere in the app (keywords, people, studios). */
export function LinkChips({ items }: { items: readonly { key: string | number; label: string; to: string }[] }) {
  return (
    <span className="flex flex-wrap gap-1.5 py-0.5">
      {items.map((item) => (
        <Link key={item.key} to={item.to} className="rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200 hover:bg-accent-700 hover:text-white">
          {item.label}
        </Link>
      ))}
    </span>
  )
}
