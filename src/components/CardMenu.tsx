import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { CORNER } from './corners'

export type CardMenuItem = { label: string; to: string } | { label: string; onSelect: () => void; danger?: boolean }

/**
 * "⋯" button in the image's bottom-right corner that opens a small action menu. The menu is rendered into
 * <body> with fixed positioning (scrolling rows would clip it otherwise) and placed next to the tile, never
 * over it: see placeMenu.
 */
export function CardMenu({ items }: { items: readonly CardMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  // Tile and menu boxes once placed, for the shared outline (replaced on every opening, before paint).
  const [outline, setOutline] = useState<{ tile: DOMRect; menu: DOMRect }>()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false)
        return
      }
      const target = e.target as Node
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false)
    }
    // A fixed menu would drift away from its tile while scrolling: close it instead.
    const dismiss = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [open])

  // Placed once it's in the DOM and measurable, before the browser paints it (stable, so it runs once per opening).
  const placeRef = useCallback((element: HTMLDivElement | null) => {
    menu.current = element
    const tile = root.current?.parentElement
    if (!element || !tile) return
    const tileBox = tile.getBoundingClientRect()
    placeMenu(element, tileBox)
    setOutline({ tile: tileBox, menu: element.getBoundingClientRect() })
  }, [])

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
      {open &&
        createPortal(
          <div
            ref={placeRef}
            role="menu"
            className="invisible fixed z-50 min-w-48 rounded bg-neutral-900/95 p-1 shadow-xl"
          >
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
          </div>,
        document.body,
      )}
      {open && outline && createPortal(<JointOutline tile={outline.tile} menu={outline.menu} />, document.body)}
    </div>
  )
}

// Tile and menu touch, so their outline reads as one shape.
const GAP = 0
const MARGIN = 8

/**
 * Position next to the tile, fully on screen and never covering it:
 * - room to the right → right of the tile, the menu's bottom-left corner at the tile's bottom-right corner;
 * - otherwise room below → below, the menu's top-right corner at the tile's bottom-right corner;
 * - otherwise → left of the tile, the menu's bottom-right corner at the tile's bottom-left corner.
 * Side placements shift as far as needed to stay on screen.
 */
function placeMenu(menu: HTMLElement, tile: DOMRect) {
  const { width, height } = menu.getBoundingClientRect()
  const viewW = document.documentElement.clientWidth
  const viewH = window.innerHeight
  const clampTop = (top: number) => Math.max(MARGIN, Math.min(top, viewH - height - MARGIN))
  const clampLeft = (left: number) => Math.max(MARGIN, Math.min(left, viewW - width - MARGIN))

  let left: number
  let top: number
  if (tile.right + GAP + width <= viewW - MARGIN) {
    left = tile.right + GAP
    top = clampTop(tile.bottom - height)
  } else if (tile.bottom + GAP + height <= viewH - MARGIN) {
    left = tile.right - width
    top = tile.bottom + GAP
  } else {
    left = tile.left - GAP - width
    top = clampTop(tile.bottom - height)
  }
  menu.style.left = `${clampLeft(left)}px`
  menu.style.top = `${top}px`
  menu.style.visibility = 'visible'
}

const OUTLINE_WIDTH = 2
const RADIUS = 4

/**
 * Jellyfin-violet outline around tile and menu as one shape: both boxes are stroked at double width, then a
 * mask removes everything inside either box, so only the outer edge stays (none where they touch).
 */
function JointOutline({ tile, menu }: { tile: DOMRect; menu: DOMRect }) {
  const mask = useId()
  const boxes = [tile, menu].map((b) => ({ x: b.left, y: b.top, width: b.width, height: b.height, rx: RADIUS }))
  return (
    <svg aria-hidden className="pointer-events-none fixed inset-0 z-50 size-full">
      <defs>
        <mask id={mask}>
          <rect width="100%" height="100%" fill="white" />
          {boxes.map((b, i) => (
            <rect key={i} {...b} fill="black" />
          ))}
        </mask>
      </defs>
      <g mask={`url(#${mask})`} fill="none" stroke="#AA5CC3" strokeWidth={OUTLINE_WIDTH * 2}>
        {boxes.map((b, i) => (
          <rect key={i} {...b} />
        ))}
      </g>
    </svg>
  )
}
