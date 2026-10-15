import { useEffect } from 'react'
import { usePref } from '@/api/prefs-context'
import { useRecentlyPlayed } from '@/api/queries/home'
import { idsToUnhide } from '@/domain/currentlyWatching'

/** Series/movie ids removed from Currently Watching (synced via the `following` prefs key). */
export function useHiddenFromWatching() {
  const following = usePref('following')
  const { hidden } = following.profile
  return {
    hidden,
    hiddenIds: hidden.map((h) => h.id),
    hide: (id: string) => {
      if (!hidden.some((h) => h.id === id)) following.update({ hidden: [...hidden, { id, at: new Date().toISOString() }] })
    },
    unhide: (ids: string | readonly string[]) => {
      const remove = new Set(typeof ids === 'string' ? [ids] : ids)
      following.update({ hidden: hidden.filter((h) => !remove.has(h.id)) })
    },
  }
}

/** Unhides a series/movie once something of it is played after it was hidden (in any client). */
export function useAutoUnhide() {
  const { hidden, unhide } = useHiddenFromWatching()
  const recent = useRecentlyPlayed(hidden.length > 0)
  const toUnhide = recent.data ? idsToUnhide(hidden, recent.data) : []
  const key = toUnhide.join(',')

  useEffect(() => {
    if (key) unhide(key.split(','))
    // Only react to a changed result; `unhide` is recreated every render.
  }, [key]) // oxlint-disable-line react-hooks/exhaustive-deps
}
