import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { HEADER_HEIGHT } from './layout'

type Paging = { loaded: number; hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown }

/** Scrolls the grid to an item position, loading further pages first when it isn't there yet. */
export function useJumpToIndex(gridRef: RefObject<HTMLElement | null>, paging: Paging) {
  const target = useRef<{ position: number; smooth: boolean } | undefined>(undefined)
  const { loaded, hasNextPage, isFetchingNextPage, fetchNextPage } = paging

  const step = useCallback(() => {
    const jump = target.current
    if (!jump) return
    if (loaded <= jump.position) {
      if (!hasNextPage) target.current = undefined
      else if (!isFetchingNextPage) void fetchNextPage()
      return
    }
    target.current = undefined
    const card = gridRef.current?.querySelector('ul')?.children[jump.position]
    if (!card) return
    window.scrollTo({
      top: card.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT - 8,
      behavior: jump.smooth ? 'smooth' : 'instant',
    })
  }, [loaded, hasNextPage, isFetchingNextPage, fetchNextPage, gridRef])

  // Continue a pending jump whenever another page has arrived.
  useEffect(step, [step])

  return useCallback(
    (position: number, smooth: boolean) => {
      target.current = { position, smooth }
      step()
    },
    [step],
  )
}
