export type Series = {
  id: string
  name: string
  year?: number
  posterUrl?: string
  unplayedCount: number
  isFavorite: boolean
}

export type Episode = {
  id: string
  name: string
  seriesId?: string
  seriesName?: string
  seasonNumber?: number
  episodeNumber?: number
  /** ISO timestamp of when the episode was added to the server. */
  dateCreated?: string
  played: boolean
  positionTicks: number
  runtimeTicks?: number
  thumbUrl?: string
}
