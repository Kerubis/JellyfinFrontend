import type { MediaItem } from '@/domain/media'

export const seriesPath = (seriesId: string) => `/series/${seriesId}`

/** Series page with a season selected (by id, or by number when the id isn't known). */
export function seasonPath(seriesId: string, season: { id?: string; number?: number }): string {
  if (season.id) return `/series/${seriesId}?season=${season.id}`
  return season.number !== undefined ? `/series/${seriesId}?sn=${season.number}` : seriesPath(seriesId)
}

/** Episode view inside its series page; without the series id a redirect route resolves it. */
export const episodePath = (episodeId: string, seriesId?: string) =>
  seriesId ? `/series/${seriesId}/episode/${episodeId}` : `/episode/${episodeId}`

/** Where a card's title leads. */
export function itemPath(item: MediaItem): string {
  if (item.kind === 'series') return seriesPath(item.id)
  if (item.kind === 'episode') return episodePath(item.id, item.seriesId)
  if (item.kind === 'season' && item.seriesId) return seasonPath(item.seriesId, { id: item.id, number: item.seasonNumber })
  if (item.seriesId) return seriesPath(item.seriesId)
  return `/item/${item.id}`
}
