import { useEffect, useRef, useState, type RefObject } from 'react'
import { useElementHeight } from '@/hooks/useElementHeight'
import { THUMB_CLASS } from './scrollRailStyles'

const MIN_THUMB = 24

type Metrics = { scrollTop: number; scrollHeight: number; viewport: number }

/** What a rail scrolls: the window, or an element with its own overflow (hide its native bar). */
export type ScrollTarget = 'window' | RefObject<HTMLElement | null>

/**
 * Custom scrollbar with the Jellyfin gradient thumb. Drag the thumb, or press the track to jump there and
 * keep dragging. `className` positions and styles the rail; with `hideWhenIdle` it disappears while there
 * is nothing to scroll.
 */
export function ScrollRail({ target, className, hideWhenIdle = false }: { target: ScrollTarget; className: string; hideWhenIdle?: boolean }) {
  const rail = useRef<HTMLDivElement>(null)
  const height = useElementHeight(rail)
  const { scrollTop, scrollHeight, viewport } = useScrollMetrics(target)
  const drag = useRef<number | undefined>(undefined)

  const scrollable = scrollHeight - viewport
  const thumbHeight = Math.min(height, Math.max(MIN_THUMB, (viewport / scrollHeight) * height))
  const travel = height - thumbHeight
  const thumbTop = scrollable > 0 ? (scrollTop / scrollable) * travel : 0

  // Scroll so the thumb's top sits at `top` px in the rail.
  const scrollToThumb = (top: number) => {
    if (travel <= 0) return
    const to = { top: (Math.min(travel, Math.max(0, top)) / travel) * scrollable, behavior: 'instant' as const }
    if (target === 'window') window.scrollTo(to)
    else target.current?.scrollTo(to)
  }

  return (
    <div
      ref={rail}
      aria-hidden
      className={`${className} ${hideWhenIdle && scrollable <= 0 ? 'invisible' : ''}`}
      onPointerDown={(e) => {
        if (scrollable <= 0) return
        const y = e.clientY - e.currentTarget.getBoundingClientRect().top
        e.currentTarget.setPointerCapture(e.pointerId)
        // Grab the thumb where it was pressed; on the track, centre the thumb under the pointer.
        drag.current = y >= thumbTop && y <= thumbTop + thumbHeight ? y - thumbTop : thumbHeight / 2
        scrollToThumb(y - drag.current)
      }}
      onPointerMove={(e) => {
        if (drag.current === undefined) return
        scrollToThumb(e.clientY - e.currentTarget.getBoundingClientRect().top - drag.current)
      }}
      onPointerUp={() => (drag.current = undefined)}
      onPointerCancel={() => (drag.current = undefined)}
    >
      {height > 0 && scrollable > 0 && <div className={`${THUMB_CLASS} pointer-events-none`} style={{ top: thumbTop, height: thumbHeight }} />}
    </div>
  )
}

/** Scroll position and sizes of the target, following scrolling, resizes and content changes. */
function useScrollMetrics(target: ScrollTarget): Metrics {
  const [metrics, setMetrics] = useState<Metrics>({ scrollTop: 0, scrollHeight: 1, viewport: 1 })
  useEffect(() => {
    const element = target === 'window' ? undefined : target.current
    if (target !== 'window' && !element) return
    let frame = 0
    const measure = () => {
      frame = 0
      const next = element
        ? { scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, viewport: element.clientHeight }
        : { scrollTop: window.scrollY, scrollHeight: document.documentElement.scrollHeight, viewport: window.innerHeight }
      setMetrics((prev) =>
        prev.scrollTop === next.scrollTop && prev.scrollHeight === next.scrollHeight && prev.viewport === next.viewport ? prev : next,
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    schedule()
    // Content size changes: the page body, or the pane plus its children (its own box has a fixed max height).
    const resize = new ResizeObserver(schedule)
    const observeAll = () => {
      resize.disconnect()
      if (!element) return resize.observe(document.body)
      resize.observe(element)
      for (const child of element.children) resize.observe(child)
    }
    observeAll()
    const children = element ? new MutationObserver(() => (observeAll(), schedule())) : undefined
    if (element) children?.observe(element, { childList: true })
    const scroller = element ?? window
    scroller.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      children?.disconnect()
      scroller.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [target])
  return metrics
}
