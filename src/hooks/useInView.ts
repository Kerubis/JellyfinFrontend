import { useEffect, type RefObject } from 'react'

/** Calls `onVisible` whenever the element scrolls into view (e.g. a "load more" sentinel). */
export function useInView(ref: RefObject<Element | null>, onVisible: () => void, enabled = true) {
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onVisible()
    }, { rootMargin: '600px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, onVisible, enabled])
}
