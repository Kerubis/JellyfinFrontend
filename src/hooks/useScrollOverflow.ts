import { useCallback, useEffect, useState, type RefObject } from 'react'

/** Tracks whether a horizontally scrollable element has more content to the left/right. */
export function useScrollOverflow(ref: RefObject<HTMLElement | null>) {
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [ref])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    // Re-measure when the row resizes or its content changes (images, more items).
    const resize = new ResizeObserver(measure)
    resize.observe(el)
    const mutation = new MutationObserver(measure)
    mutation.observe(el, { childList: true })
    return () => {
      el.removeEventListener('scroll', measure)
      resize.disconnect()
      mutation.disconnect()
    }
  }, [ref, measure])

  /** Scrolls by most of a visible width, so one item stays as context. */
  const page = useCallback(
    (direction: 1 | -1) => {
      const el = ref.current
      el?.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
    },
    [ref],
  )

  return { canLeft, canRight, page }
}
