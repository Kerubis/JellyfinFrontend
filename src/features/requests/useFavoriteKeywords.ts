import { usePref } from '@/api/prefs-context'
import { FAVORITE_KEYWORDS_MAX } from '@/domain/prefs'
import { sameName } from '@/domain/searchQuery'
import type { SeerrKeyword } from '@/domain/seerr'

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** The profile's starred keywords (synced pref `requests.favoriteKeywords`). */
export function useFavoriteKeywords() {
  const pref = usePref('requests')
  const list = pref.value.favoriteKeywords
  const isFavorite = (id: number) => list.some((k) => k.id === id)
  return {
    list,
    isFavorite,
    toggle: (keyword: SeerrKeyword) =>
      pref.update({
        favoriteKeywords: isFavorite(keyword.id)
          ? list.filter((k) => k.id !== keyword.id)
          : [...list, { id: keyword.id, name: keyword.name }].slice(-FAVORITE_KEYWORDS_MAX),
      }),
    /** Favorites containing the typed text (all for none): starting with it first, then by name. */
    matching: (query: string) => {
      const q = normalize(query)
      return list
        .filter((k) => normalize(k.name).includes(q))
        .sort((a, b) => Number(normalize(b.name).startsWith(q)) - Number(normalize(a.name).startsWith(q)) || a.name.localeCompare(b.name))
    },
    /** The favorite with exactly this name, if any (it wins over namesakes). */
    named: (name: string) => list.find((k) => sameName(k.name, name)),
  }
}
