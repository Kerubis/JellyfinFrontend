import { useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import { usePref } from '@/api/prefs-context'
import { useEpisode, useSeasonEpisodes, useSeasons, useSeriesDetails, useSeriesWatchState, useSetPlayed } from '@/api/queries/series'
import { ScrollRail } from '@/components/ScrollRail'
import { RAIL_LOOK } from '@/components/scrollRailStyles'
import { sortSeasons } from '@/domain/series'
import { seasonPath } from '@/features/home/links'
import { usePlay } from '@/features/player/player-context'
import { EpisodeList } from './EpisodeList'
import { EpisodePanel } from './EpisodePanel'
import { SeasonGrid } from './SeasonGrid'
import { SeriesHeader } from './SeriesHeader'

export function SeriesPage() {
  const { seriesId = '', episodeId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  // Episode view: the right column shows that episode instead of the episode list.
  const openEpisode = useEpisode(episodeId ?? '', !!episodeId)
  const { showSpoilers } = usePref('ui').value
  const details = useSeriesDetails(seriesId)
  const seasons = useSeasons(seriesId)
  const watch = useSeriesWatchState(seriesId)
  const setPlayed = useSetPlayed()
  const play = usePlay()
  const pane = useRef<HTMLElement>(null)

  const sorted = sortSeasons(seasons.data ?? [])
  // Selected season lives in the URL (back/forward keeps it); default: the season of the next episode.
  const episodeSeason = openEpisode.data?.episode
  const selected =
    (episodeId && episodeSeason ? sorted.find((s) => s.number === episodeSeason.seasonNumber) : undefined) ??
    sorted.find((s) => s.id === params.get('season')) ??
    sorted.find((s) => params.get('sn') !== null && s.number === Number(params.get('sn'))) ??
    sorted.find((s) => s.number === watch.next?.seasonNumber) ??
    sorted[0]
  const episodes = useSeasonEpisodes(seriesId, selected?.id)
  const seasonEpisodes = episodes.data ?? []

  if (details.isPending) return <p className="text-sm text-neutral-500">Loading…</p>
  if (details.isError) return <p className="text-sm text-red-400">{errorMessage(details.error)}</p>

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[clamp(24rem,32vw,44rem)_1fr] lg:items-start">
      {/* Left: series info + seasons; stays in view while the episode list scrolls. */}
      <div className="relative lg:sticky lg:top-14">
        <aside
          ref={pane}
          className="flex flex-col gap-4 [scrollbar-width:none] lg:max-h-[calc(100svh-4rem)] lg:overflow-y-auto lg:pr-7"
        >
          <SeriesHeader
            series={details.data}
            playedCount={watch.playedCount}
            totalCount={watch.totalCount}
            next={watch.next}
            playTarget={watch.playTarget}
            onPlay={(id) => play(id)}
          />
          <SeasonGrid
            seasons={sorted}
            selectedId={selected?.id}
            bySeason={watch.bySeason}
            fallbackPosterUrl={details.data.posterUrl}
            onSelect={(id) => (episodeId ? navigate(seasonPath(seriesId, { id })) : setParams({ season: id }, { replace: true }))}
            onSetPlayed={(season, played) => {
              const state = watch.bySeason.get(season.number)
              const episodes = [...(state?.played ?? []), ...(state?.unplayed ?? [])]
              setPlayed.mutate({ itemId: season.id, played, episodes })
            }}
            onPlay={(id) => play(id)}
          />
        </aside>
        <ScrollRail target={pane} hideWhenIdle className={`absolute top-0 right-0 bottom-0 rounded ${RAIL_LOOK}`} />
      </div>

      {episodeId ? (
        <section className="min-w-0">
          <EpisodePanel episodeId={episodeId} />
        </section>
      ) : (
        <section className="flex min-w-0 flex-col gap-2">
          {selected && (
            <h2 className="text-sm font-semibold text-neutral-300">
              {selected.number === 0 ? 'Specials' : selected.name}
              <span className="ml-2 text-xs font-normal text-neutral-500">{seasonEpisodes.length} episodes</span>
            </h2>
          )}

          {episodes.isPending && selected ? (
            <p className="text-sm text-neutral-500">Loading episodes…</p>
          ) : episodes.isError ? (
            <p className="text-sm text-red-400">{errorMessage(episodes.error)}</p>
          ) : (
            <EpisodeList episodes={seasonEpisodes} playedIds={watch.playedIds} nextId={watch.next?.id} showSpoilers={showSpoilers} onPlay={(id) => play(id)} />
          )}
        </section>
      )}
    </div>
  )
}
