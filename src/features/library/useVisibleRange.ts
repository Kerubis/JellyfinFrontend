import { useEffect, useState, type RefObject } from 'react'
import { HEADER_HEIGHT } from './layout'

/** Visible part of the grid in fractional item positions (`end` exclusive): half a row scrolled past moves `start` by half a row's cards. */
export type VisibleRange = { start: number; end: number }

/** First position in `0..n` where `test` holds; `test` must be false…false, true…true over the positions. */
function firstWhere(n: number, test: (i: number) => boolean): number {
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (test(mid)) hi = mid
    else lo = mid + 1
  }
  return lo
}

/** Fractional item positions at the top (below the header) and bottom of the viewport, updated on scroll. */
export function useVisibleRange(gridRef: RefObject<HTMLElement | null>, loaded: number) {
  const [range, setRange] = useState<VisibleRange>()

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const grid = gridRef.current?.querySelector('ul')
      if (!grid || grid.children.length === 0) return setRange(undefined)
      const cards = grid.children
      const n = cards.length
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length
      const rect = (i: number) => cards[i]?.getBoundingClientRect()
      // Item position at viewport height `y`: the row there, plus how far `y` is into that row.
      // Card rows are in order, so bottoms grow with the position: binary search is enough.
      const positionAt = (y: number) => {
        const i = firstWhere(n, (j) => (rect(j)?.bottom ?? 0) > y)
        const box = rect(i)
        if (!box) return n
        const into = Math.min(1, Math.max(0, (y - box.top) / box.height))
        return Math.min(n, Math.floor(i / cols) * cols + into * cols)
      }
      const start = positionAt(HEADER_HEIGHT)
      const end = positionAt(window.innerHeight)
      setRange((prev) => {
        if (start >= end) return undefined
        return prev?.start === start && prev.end === end ? prev : { start, end }
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [gridRef, loaded])

  return range
}
