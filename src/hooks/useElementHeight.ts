import { useEffect, useState, type RefObject } from 'react'

/** The element's current content height in px, following resizes (0 until measured). */
export function useElementHeight(ref: RefObject<Element | null>) {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.contentRect.height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return height
}
