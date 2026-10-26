import type { MediaKind } from './media'
import type { MediaTracks } from './tracks'

export type Person = { name: string; role?: string; type: 'actor' | 'director' | 'writer' | 'other' }

export type MovieDetails = {
  id: string
  /** Detail pages for other kinds redirect to their own page. */
  kind: MediaKind
  seriesId?: string
  name: string
  year?: number
  premiereDate?: string
  runtimeTicks?: number
  officialRating?: string
  communityRating?: number
  /** Rotten-Tomatoes-style 0–100. */
  criticRating?: number
  genres: string[]
  tagline?: string
  overview?: string
  posterUrl?: string
  people: Person[]
  studios: string[]
  /** From the item endpoint's UserData (reliable, D15). */
  played: boolean
  isFavorite: boolean
  positionTicks: number
  tracks: MediaTracks
  /** For Seerr lookups. */
  tmdbId?: number
}
