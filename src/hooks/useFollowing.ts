import { usePref } from '@/api/prefs-context'

/** Follow state and the combined "Add to Currently Watching" action (synced via `following` prefs). */
export function useFollowing() {
  const following = usePref('following')
  const { followed, hidden } = following.profile
  return {
    isFollowed: (id: string) => followed.includes(id),
    isHidden: (id: string) => hidden.some((h) => h.id === id),
    setFollowed: (id: string, on: boolean) =>
      following.update({ followed: on ? [...followed.filter((f) => f !== id), id] : followed.filter((f) => f !== id) }),
    /** Unhides and follows in one write, so the series shows even without watch history. */
    addToCurrentlyWatching: (id: string) =>
      following.update({
        followed: followed.includes(id) ? followed : [...followed, id],
        hidden: hidden.filter((h) => h.id !== id),
      }),
  }
}
