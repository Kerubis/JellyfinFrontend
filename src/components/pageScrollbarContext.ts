import { createContext, useContext, useEffect } from 'react'

/** Lets a page swap the generic page scrollbar for its own rail (+1 while mounted). */
export const PageScrollbarContext = createContext<(delta: 1 | -1) => void>(() => {})

/** Hides the page scrollbar while the calling component is mounted. */
export function useReplacePageScrollbar() {
  const change = useContext(PageScrollbarContext)
  useEffect(() => {
    change(1)
    return () => change(-1)
  }, [change])
}
