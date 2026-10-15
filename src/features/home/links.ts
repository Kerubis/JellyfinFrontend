import type { MediaItem } from '@/domain/media'

export const seriesPath = (seriesId: string) => `/series/${seriesId}`

/** Where a card for this item leads (until the player exists, everything opens a page). */
export function itemPath(item: MediaItem): string {
  if (item.kind === 'series') return seriesPath(item.id)
  if (item.seriesId) return seriesPath(item.seriesId)
  return `/item/${item.id}`
}
