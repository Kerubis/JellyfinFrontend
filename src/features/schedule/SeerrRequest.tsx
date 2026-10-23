import { useAnimeIdIndex, useSeerrConfig, useSeerrMedia, useSeerrSearch } from '@/api/seerr'
import type { AnimeDetails } from '@/domain/schedule'
import type { AnimeTmdb } from '@/domain/seerr'
import { SeerrPanel } from '@/features/requests/SeerrPanel'

const note = 'text-xs text-neutral-500'

/**
 * Request with Seerr: finds the show's TMDB title (MAL / AniList id via the Fribb mapping, else a title search),
 * shows what Seerr already has, and requests the chosen seasons as the profile's own Seerr user.
 * Renders nothing when Seerr isn't set up for this profile.
 */
export function SeerrRequest({ details }: { details: AnimeDetails | undefined }) {
  const config = useSeerrConfig()
  const ids = useAnimeIdIndex(!!config && !!details)
  const mapped: AnimeTmdb | undefined = ids.data
    ? ((details?.malId && ids.data.mal.get(details.malId)) || (details?.anilistId && ids.data.anilist.get(details.anilistId)) || undefined)
    : undefined
  // Fall back to a title search once the mapping is known not to cover the show (or failed to load).
  const searchFor = details && (ids.isError || (ids.data && !mapped)) ? (details.english ?? details.title) : undefined
  const isMovie = details?.mediaTypes.some((t) => t.route === 'movie') ?? false
  const search = useSeerrSearch(searchFor, isMovie ? 'movie' : 'tv')
  const target = mapped ?? search.data ?? undefined
  const media = useSeerrMedia(target)

  if (!config) return null
  if (!details || ids.isPending || (searchFor && search.isPending) || (target && media.isPending)) {
    return <p className={note}>Checking Seerr…</p>
  }
  const error = search.error ?? media.error
  if (error) return <p className="text-xs text-red-400">{error.message}</p>
  if (!target || !media.data) {
    return (
      <p className={note}>
        Not found in Seerr.{' '}
        <a href={`${config.url}/search?query=${encodeURIComponent(details.english ?? details.title)}`} target="_blank" rel="noreferrer" className="text-accent-400 hover:underline">
          Search in Seerr
        </a>
      </p>
    )
  }
  return <SeerrPanel key={`${media.data.kind}-${media.data.tmdbId}`} media={media.data} mappedSeason={mapped?.season} guessed={!mapped} anime seerrUrl={config.url} />
}

