import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CORNER } from './corners'

export type CardMenuItem = { label: string; to: string } | { label: string; onSelect: () => void; danger?: boolean }

/** "⋯" button in the image's bottom-right corner that opens a small action menu. */
export function CardMenu({ items }: { items: readonly CardMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const item = 'block w-full rounded px-3 py-1.5 text-left text-sm whitespace-nowrap hover:bg-white/10'
  return (
    <div ref={root} className={`absolute ${CORNER.br} z-20 ${open ? '' : 'hidden group-focus-within:block group-hover:block'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="More"
        aria-label="More actions"
        aria-expanded={open}
        className={`group/menu flex items-center justify-center ${CORNER.br} bg-black/75 p-2 focus-visible:outline-2 focus-visible:outline-accent-400`}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-neutral-700 text-sm leading-none text-neutral-100 transition group-hover/menu:bg-accent-600 group-hover/menu:text-white">
          ⋯
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 bottom-full mb-1 min-w-48 rounded border border-white/10 bg-neutral-900/95 p-1 shadow-xl">
          {items.map((entry) =>
            'to' in entry ? (
              <Link key={entry.label} to={entry.to} role="menuitem" className={item} onClick={() => setOpen(false)}>
                {entry.label}
              </Link>
            ) : (
              <button
                key={entry.label}
                type="button"
                role="menuitem"
                className={`${item} ${entry.danger ? 'text-red-300' : ''}`}
                onClick={() => {
                  setOpen(false)
                  entry.onSelect()
                }}
              >
                {entry.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
