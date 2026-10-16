import { useRef } from 'react'
import { useReplacePageScrollbar } from '@/components/pageScrollbarContext'
import { RAIL_CLASS, THUMB_CLASS } from '@/components/scrollRailStyles'
import { LETTERS, type LibraryQuery } from '@/domain/libraryQuery'
import { useElementHeight } from '@/hooks/useElementHeight'
import type { VisibleRange } from './useVisibleRange'

/** Smallest row height in px, so letters with few or no items stay readable. */
const MIN_ROW = 12

/**
 * A–Z scrollbar on the right edge, replacing the page scrollbar (PageScrollbar) while shown (the grid loads in pages,
 * so the native one doesn't reflect the library anyway). Letters run in list order, each taking height in
 * proportion to its items; the thumb spans the part of the list on screen. Click a letter to jump there,
 * or drag along the rail to scrub.
 */
export function AlphaRail({
  index,
  total,
  order,
  visible,
  onJump,
}: {
  index: Map<string, number> | undefined
  total: number
  order: LibraryQuery['order']
  visible: VisibleRange | undefined
  onJump: (position: number, smooth: boolean) => void
}) {
  const letters = order === 'asc' ? LETTERS : [...LETTERS].reverse()
  const rail = useRef<HTMLDivElement>(null)
  const height = useElementHeight(rail)
  const scrub = useRef<{ letter?: string } | undefined>(undefined)

  useReplacePageScrollbar()

  const entries = index ? [...index] : []
  const counts = new Map(entries.map(([letter, start], k) => [letter, (entries[k + 1]?.[1] ?? total) - start]))
  const heights = rowHeights(
    letters.map((l) => counts.get(l) ?? 0),
    height,
  )
  // Row edges in px: tops[r] is where row r starts, tops[letters.length] the rail's end.
  const tops = heights.reduce<number[]>((acc, h) => [...acc, (acc.at(-1) ?? 0) + h], [0])

  const jumpAt = (clientY: number, smooth: boolean) => {
    const box = rail.current?.getBoundingClientRect()
    if (!box || !scrub.current) return
    const y = clientY - box.top
    const row = Math.max(0, tops.findLastIndex((top, r) => r < letters.length && top <= y))
    const letter = letters[row]
    const position = letter === undefined ? undefined : index?.get(letter)
    if (position === undefined || letter === scrub.current.letter) return
    scrub.current.letter = letter
    onJump(position, smooth)
  }

  // Thumb edge in px for a fractional item position: a letter's items are spread evenly from its own row
  // to the next letter that has items (so empty letters in between are crossed smoothly, not skipped).
  const offsetAt = (position: number) => {
    let k = 0
    while (k + 1 < entries.length && (entries[k + 1]?.[1] ?? Infinity) <= position) k++
    const entry = entries[k]
    if (!entry) return 0
    const next = entries[k + 1]
    const row = letters.indexOf(entry[0])
    const from = tops[row] ?? 0
    const to = tops[next ? letters.indexOf(next[0]) : row + 1] ?? from
    const span = (next?.[1] ?? total) - entry[1]
    return from + (span > 0 ? Math.min(1, (position - entry[1]) / span) : 0) * (to - from)
  }
  const thumb = index && visible && height > 0 ? { top: offsetAt(visible.start), bottom: offsetAt(visible.end) } : undefined

  return (
    <div
      ref={rail}
      role="navigation"
      aria-label="Jump to letter"
      className={`${RAIL_CLASS} flex cursor-pointer flex-col`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        scrub.current = {}
        jumpAt(e.clientY, true)
      }}
      onPointerMove={(e) => jumpAt(e.clientY, false)}
      onPointerUp={() => (scrub.current = undefined)}
      onPointerCancel={() => (scrub.current = undefined)}
    >
      {thumb && (
        <div
          className={`${THUMB_CLASS} pointer-events-none`}
          style={{ top: thumb.top, height: thumb.bottom - thumb.top }}
        />
      )}
      {letters.map((letter, r) => (
        <span
          key={letter}
          style={{ height: heights[r] }}
          className={`relative flex shrink-0 items-center justify-center text-[10px] leading-none font-medium ${
            index?.has(letter) ? 'text-accent-400' : 'text-accent-700/40'
          }`}
        >
          {letter}
        </span>
      ))}
    </div>
  )
}

/**
 * Splits `height` px over rows in proportion to `weights`, but never below MIN_ROW: rows whose share would be
 * smaller are held at the minimum and the rest is shared again among the others. Equal rows without weights
 * or when even the minimums don't fit.
 */
function rowHeights(weights: number[], height: number): number[] {
  const n = weights.length
  if (n * MIN_ROW >= height || weights.every((w) => w === 0)) return weights.map(() => height / n)
  const atMin = new Set<number>()
  for (;;) {
    const free = height - atMin.size * MIN_ROW
    const weight = weights.reduce((sum, w, i) => (atMin.has(i) ? sum : sum + w), 0)
    const share = (w: number) => (w / weight) * free
    const tooSmall = weights.flatMap((w, i) => (!atMin.has(i) && share(w) < MIN_ROW ? [i] : []))
    if (tooSmall.length === 0) return weights.map((w, i) => (atMin.has(i) ? MIN_ROW : share(w)))
    tooSmall.forEach((i) => atMin.add(i))
  }
}
