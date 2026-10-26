import type { EpisodeRef } from './media'

export type SeriesDetails = {
  id: string
  name: string
  year?: number
  endYear?: number
  status?: 'continuing' | 'ended'
  overview?: string
  posterUrl?: string
  genres: string[]
  communityRating?: number
  officialRating?: string
  /** For Seerr lookups. */
  tmdbId?: number
}

export type Season = {
  id: string
  name: string
  number?: number
  posterUrl?: string
}

export type EpisodeDetails = EpisodeRef & {
  overview?: string
  runtimeTicks?: number
  stillUrl?: string
  positionTicks: number
}

const TICKS_PER_MINUTE = 600_000_000

export function runtimeMinutes(ticks: number | undefined): number | undefined {
  return ticks ? Math.round(ticks / TICKS_PER_MINUTE) : undefined
}

/** Regular seasons in order, specials (season 0) last. */
export function sortSeasons(seasons: readonly Season[]): Season[] {
  const key = (s: Season) => (s.number === 0 ? Infinity : (s.number ?? Infinity - 1))
  return [...seasons].sort((a, b) => key(a) - key(b))
}
