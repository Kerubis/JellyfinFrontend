import { usePref } from '@/api/prefs-context'
import {
  useCurrentlyWatching,
  useFollowedSeries,
  useItemList,
  useNewEpisodes,
  useWatchData,
  type ItemListKind,
  type NewEpisodeItem,
} from '@/api/queries/home'
import { useSetPlayed } from '@/api/queries/series'
import { CardGrid, CardRow, PosterCard } from '@/components/cards'
import type { SeriesEntry } from '@/domain/currentlyWatching'
import { DEFAULT_NEW_DAYS, sectionLimit, sectionTitle, type DashboardSection } from '@/domain/dashboard'
import { episodeLabel, episodeRangeLabel, groupBySeries, type MediaItem } from '@/domain/media'
import { MediaCaption } from '@/features/media/MediaCaption'
import { MediaItemCard } from '@/features/media/MediaItemCard'
import { useMediaActions } from '@/features/media/useMediaActions'
import { usePlay } from '@/features/player/player-context'
import { useAutoUnhide, useHiddenFromWatching } from '@/hooks/useHiddenFromWatching'
import { itemPath, seriesPath } from './links'
import { Section } from './Section'

type SectionProps = { section: DashboardSection }

const capped = <T,>(items: readonly T[], limit: number): readonly T[] => (limit > 0 ? items.slice(0, limit) : items)

/** Series item for the standard actions when only the id (and maybe the catalog entry) is known. */
function seriesItem(seriesId: string, series: MediaItem | undefined): MediaItem {
  return series ?? { id: seriesId, kind: 'series', name: 'Series' }
}

function SeriesWatchingCard({ entry, series, showSpoilers }: { entry: SeriesEntry; series?: MediaItem; showSpoilers: boolean }) {
  // Standard series menu (open, Currently Watching, follow); play and ✓ act on the next episode.
  const { menu } = useMediaActions(seriesItem(entry.seriesId, series))
  const play = usePlay()
  const setPlayed = useSetPlayed()
  const label = episodeLabel(entry.next) || 'next episode'
  const item = seriesItem(entry.seriesId, series)
  return (
    <PosterCard
      caption={<MediaCaption item={item} next={entry.next} />}
      onPlay={() => play(entry.next.id)}
      playLabel={`Play ${label}`}
      watched={{ watched: false, label, onToggle: () => setPlayed.mutate({ itemId: entry.next.id, played: true, episodes: [entry.next] }) }}
      menu={menu}
      to={seriesPath(entry.seriesId)}
      title={series?.name ?? entry.next.name}
      tooltip={showSpoilers ? `${series?.name ?? ''}: ${entry.next.name}` : series?.name}
      imageUrl={series?.posterUrl}
      count={entry.unplayedCount}
      marker={entry.isNew ? 'NEW' : undefined}
      progress={entry.progress}
    />
  )
}

function MovieWatchingCard({ movie }: { movie: MediaItem }) {
  const { menu = [], ...actions } = useMediaActions(movie)
  const { hide } = useHiddenFromWatching()
  return (
    <PosterCard
      {...actions}
      menu={[...menu, { label: 'Remove from Currently Watching', onSelect: () => hide(movie.id), danger: true }]}
      caption={<MediaCaption item={movie} />}
      to={itemPath(movie)}
      title={movie.name}
      imageUrl={movie.posterUrl}
      progress={movie.progress}
    />
  )
}

function CurrentlyWatchingSection({ section }: SectionProps) {
  const { cardSize, showSpoilers } = usePref('ui').value
  const watching = useCurrentlyWatching(section.options.days ?? DEFAULT_NEW_DAYS)
  useAutoUnhide()
  const { isPending, error } = watching
  const items = capped(watching.items, sectionLimit(section))
  return (
    <Section
      title={sectionTitle(section)}
      hideWhenEmpty={section.options.hideWhenEmpty}
      items={items}
      isPending={isPending}
      error={error}
      emptyText="Nothing in progress. Start a series or movie (or follow a series) and it shows up here."
      render={(visible) => (
        <CardGrid size={cardSize} variant="poster">
          {visible.map(({ entry, series }) =>
            entry.kind === 'movie' ? (
              <MovieWatchingCard key={entry.movie.id} movie={entry.movie} />
            ) : (
              <SeriesWatchingCard key={entry.seriesId} entry={entry} series={series} showSpoilers={showSpoilers} />
            ),
          )}
        </CardGrid>
      )}
    />
  )
}

function NewEpisodesCard({ group, series, isNew, showSpoilers }: NewEpisodeItem & { showSpoilers: boolean }) {
  // Standard series menu; play starts the first new episode, ✓ marks the new episodes watched.
  const { menu } = useMediaActions(seriesItem(group.seriesId, series))
  const play = usePlay()
  const setPlayed = useSetPlayed()
  const first = group.episodes[0]
  const range = episodeRangeLabel(group.episodes)
  return (
    <PosterCard
      onPlay={first ? () => play(first.id) : undefined}
      playLabel={first ? `Play ${episodeLabel(first)}` : undefined}
      watched={{
        watched: false,
        label: range || 'new episodes',
        onToggle: () => group.episodes.forEach((e) => setPlayed.mutate({ itemId: e.id, played: true, episodes: [e] })),
      }}
      menu={menu}
      caption={<MediaCaption item={seriesItem(group.seriesId, series)} />}
      to={seriesPath(group.seriesId)}
      title={series?.name ?? ''}
      tooltip={showSpoilers ? [series?.name, ...group.episodes.map((e) => `${episodeLabel(e)} ${e.name}`)].join('\n') : series?.name}
      imageUrl={series?.posterUrl}
      count={group.episodes.length}
      marker={isNew ? 'NEW' : undefined}
    />
  )
}

function NewEpisodesSection({ section }: SectionProps) {
  const { cardSize, showSpoilers } = usePref('ui').value
  // No `days` option = every unwatched episode of started shows; the NEW badge keeps the default window.
  const newEpisodes = useNewEpisodes(section.options.days, DEFAULT_NEW_DAYS)
  const { isPending, error } = newEpisodes
  const items = capped(newEpisodes.items, sectionLimit(section))
  return (
    <Section
      title={sectionTitle(section)}
      hideWhenEmpty={section.options.hideWhenEmpty}
      items={items}
      isPending={isPending}
      error={error}
      emptyText="No unwatched episodes for the shows you're watching."
      render={(visible) => (
        <CardRow size={cardSize} variant="poster">
          {visible.map(({ group, series, isNew }) => (
            <NewEpisodesCard key={group.seriesId} group={group} series={series} isNew={isNew} showSpoilers={showSpoilers} />
          ))}
        </CardRow>
      )}
    />
  )
}

function FollowingSection({ section }: SectionProps) {
  const { cardSize } = usePref('ui').value
  const followed = useFollowedSeries()
  const { isPending, error } = followed
  const items = capped(followed.items, sectionLimit(section))
  return (
    <Section
      title={sectionTitle(section)}
      hideWhenEmpty={section.options.hideWhenEmpty}
      items={items}
      isPending={isPending}
      error={error}
      emptyText="You're not following any series yet."
      render={(visible) => (
        <CardRow size={cardSize} variant="poster">
          {visible.map((item) => (
            <MediaItemCard key={item.id} item={item} />
          ))}
        </CardRow>
      )}
    />
  )
}

const LIST_EMPTY: Record<ItemListKind, string> = {
  continueWatching: 'Nothing started.',
  recentlyAdded: 'Nothing added recently.',
  favorites: 'No favorites yet.',
  unwatchedMovies: 'No unwatched movies.',
}

function ItemListSection({ section, kind }: SectionProps & { kind: ItemListKind }) {
  const { cardSize } = usePref('ui').value
  const limit = sectionLimit(section) || 100
  const grouped = kind === 'recentlyAdded'
  // Grouping by show shrinks the list, so fetch more and cut back afterwards.
  const list = useItemList(kind, grouped ? limit * 2 : limit, section.options.libraryIds)
  const { catalog } = useWatchData()
  // Recently Added: one card per show (series data from the catalog for year / seasons / poster).
  const items =
    grouped && list.data
      ? groupBySeries(list.data)
          .map((item) => (item.kind === 'series' ? (catalog?.get(item.id) ?? item) : item))
          .slice(0, limit)
      : (list.data ?? [])

  return (
    <Section
      title={sectionTitle(section)}
      hideWhenEmpty={section.options.hideWhenEmpty}
      items={items}
      isPending={list.isPending}
      error={list.error}
      emptyText={LIST_EMPTY[kind]}
      render={(visible) => (
        <CardRow size={cardSize} variant="poster">
          {visible.map((item) => (
            // For episodes posterUrl is the series poster, so no episode stills (spoiler-free).
            <MediaItemCard key={item.id} item={item} />
          ))}
        </CardRow>
      )}
    />
  )
}

export function DashboardSectionView({ section }: SectionProps) {
  switch (section.type) {
    case 'currentlyWatching':
      return <CurrentlyWatchingSection section={section} />
    case 'newEpisodes':
      return <NewEpisodesSection section={section} />
    case 'following':
      return <FollowingSection section={section} />
    case 'continueWatching':
    case 'recentlyAdded':
    case 'favorites':
    case 'unwatchedMovies':
      return <ItemListSection section={section} kind={section.type} />
  }
}
