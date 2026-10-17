import { useEffect } from 'react'
import { usePref } from '@/api/prefs-context'
import { useRecentlyPlayed, useRemovedItemsState, useWatchData } from '@/api/queries/home'
import { idsToUnhide, staleRemovedIds } from '@/domain/currentlyWatching'

/** Shows / movies removed from Currently Watching (synced via the `watching` prefs key, §3.9). */
export function useHiddenFromWatching() {
  const watching = usePref('watching')
  const { hidden } = watching.profile
  return {
    hidden,
    hiddenIds: hidden.map((h) => h.id),
    isHidden: (id: string) => hidden.some((h) => h.id === id),
    hide: (id: string) => {
      if (!hidden.some((h) => h.id === id)) watching.update({ hidden: [...hidden, { id, at: new Date().toISOString() }] })
    },
    unhide: (ids: string | readonly string[]) => {
      const remove = new Set(typeof ids === 'string' ? [ids] : ids)
      watching.update({ hidden: hidden.filter((h) => !remove.has(h.id)) })
    },
  }
}

/**
 * Keeps the removed list current: brings an entry back once something of it is played after it was removed
 * (in any client), and drops entries with nothing unwatched left or that no longer exist (M18 cleanup).
 * The cleanup only runs once every list it depends on has loaded successfully, so a failed request never
 * wipes entries.
 */
export function useRemovedListMaintenance() {
  const { hidden, hiddenIds, unhide } = useHiddenFromWatching()
  const active = hidden.length > 0
  const recent = useRecentlyPlayed(active)
  const watch = useWatchData()
  const removed = useRemovedItemsState(hiddenIds)

  const replayed = recent.data ? idsToUnhide(hidden, recent.data) : []
  const { unplayed, resumable } = watch
  const loaded = active && !!unplayed && !!resumable && removed.isSuccess && !watch.error
  const stale = loaded ? staleRemovedIds(hidden, { unplayed, resumable, items: removed.data }) : []
  const key = [...new Set([...replayed, ...stale])].sort().join(',')

  useEffect(() => {
    if (key) unhide(key.split(','))
    // Only react to a changed result; `unhide` is recreated every render.
  }, [key]) // oxlint-disable-line react-hooks/exhaustive-deps
}
