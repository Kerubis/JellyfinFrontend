import { useCurrentlyWatching, useFollowedSeries, useItemList, useNewEpisodes, type ItemListKind } from '@/api/queries/home'
import { usePref } from '@/api/prefs-context'
import { CardGrid, CardRow, PosterCard } from '@/components/cards'
import type { SeriesEntry } from '@/domain/currentlyWatching'
import { DEFAULT_NEW_DAYS, sectionLimit, sectionTitle, type DashboardSection } from '@/domain/dashboard'
import { episodeLabel, episodeRangeLabel, type MediaItem } from '@/domain/media'
import { itemPath, seriesPath } from './links'
import { useAutoUnhide, useHiddenFromWatching } from '@/hooks/useHiddenFromWatching'
import { usePlay } from '@/features/player/player-context'
import { Section } from './Section'

type SectionProps = { section: DashboardSection }

const capped = <T,>(items: readonly T[], limit: number): readonly T[] => (limit > 0 ? items.slice(0, limit) : items)

const HIDE_LABEL = 'Remove from Currently Watching'

function SeriesWatchingCard({
  entry,
  series,
  showSpoilers,
  onHide,
  onPlay,
}: {
  entry: SeriesEntry
  series?: MediaItem
  showSpoilers: boolean
  onHide: () => void
  onPlay: () => void
}) {
  return (
    <PosterCard
      onRemove={{ label: HIDE_LABEL, onClick: onHide }}
      // The poster plays (or resumes) the next episode; the title and ⋯ open the series.
      onPlay={onPlay}
      to={seriesPath(entry.seriesId)}
      secondary={{ to: seriesPath(entry.seriesId), label: 'Open series' }}
      title={series?.name ?? entry.next.name}
      subtitle={episodeLabel(entry.next) || 'Next episode'}
      tooltip={showSpoilers ? `${series?.name ?? ''}: ${entry.next.name}` : series?.name}
      imageUrl={series?.posterUrl}
      count={entry.unplayedCount}
      marker={entry.isNew ? 'NEW' : undefined}
      progress={entry.progress}
    />
  )
}

function MovieWatchingCard({ movie, onHide, onPlay }: { movie: MediaItem; onHide: () => void; onPlay: () => void }) {
  return (
    <PosterCard
      onRemove={{ label: HIDE_LABEL, onClick: onHide }}
      onPlay={onPlay}
      to={itemPath(movie)}
      title={movie.name}
      subtitle={['Movie', movie.year].filter(Boolean).join(' · ')}
      imageUrl={movie.posterUrl}
      progress={movie.progress}
    />
  )
}

function CurrentlyWatchingSection({ section }: SectionProps) {
  const { cardSize, showSpoilers } = usePref('ui').value
  const watching = useCurrentlyWatching(section.options.days ?? DEFAULT_NEW_DAYS)
  const { hide } = useHiddenFromWatching()
  const play = usePlay()
  useAutoUnhide()
  const { isPending, error } = watching
  const items = capped(watching.items, sectionLimit(section))
  return (
    <Section
      title={sectionTitle(section)}
      items={items}
      isPending={isPending}
      error={error}
      emptyText="Nothing in progress. Start a series or movie (or follow a series) and it shows up here."
      render={(visible) => (
        <CardGrid size={cardSize} variant="poster">
          {visible.map(({ entry, series }) =>
            entry.kind === 'movie' ? (
              <MovieWatchingCard
                key={entry.movie.id}
                movie={entry.movie}
                onHide={() => hide(entry.movie.id)}
                onPlay={() => play(entry.movie.id)}
              />
            ) : (
              <SeriesWatchingCard
                key={entry.seriesId}
                entry={entry}
                series={series}
                showSpoilers={showSpoilers}
                onHide={() => hide(entry.seriesId)}
                onPlay={() => play(entry.next.id)}
              />
            ),
          )}
        </CardGrid>
      )}
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
      items={items}
      isPending={isPending}
      error={error}
      emptyText="No unwatched episodes for the shows you're watching."
      render={(visible) => (
        <CardRow size={cardSize} variant="poster">
          {visible.map(({ group, series, isNew }) => (
            <PosterCard
              key={group.seriesId}
              to={seriesPath(group.seriesId)}
              title={series?.name ?? ''}
              subtitle={episodeRangeLabel(group.episodes) || 'New episodes'}
              tooltip={
                showSpoilers
                  ? [series?.name, ...group.episodes.map((e) => `${episodeLabel(e)} ${e.name}`)].join('\n')
                  : series?.name
              }
              imageUrl={series?.posterUrl}
              count={group.episodes.length}
              marker={isNew ? 'NEW' : undefined}
            />
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
      items={items}
      isPending={isPending}
      error={error}
      emptyText="You're not following any series yet."
      render={(visible) => (
        <CardRow size={cardSize} variant="poster">
          {visible.map((item) => (
            <PosterCard key={item.id} to={seriesPath(item.id)} title={item.name} imageUrl={item.posterUrl} />
          ))}
        </CardRow>
      )}
    />
  )
}

function itemSubtitle(item: MediaItem): string {
  if (item.kind === 'episode') return [episodeLabel(item), item.name].filter(Boolean).join(' · ')
  if (item.kind === 'season') return item.name
  return item.year ? String(item.year) : ''
}

const LIST_EMPTY: Record<ItemListKind, string> = {
  continueWatching: 'Nothing started.',
  recentlyAdded: 'Nothing added recently.',
  favorites: 'No favorites yet.',
  unwatchedMovies: 'No unwatched movies.',
}

function ItemListSection({ section, kind }: SectionProps & { kind: ItemListKind }) {
  const { cardSize } = usePref('ui').value
  const list = useItemList(kind, sectionLimit(section) || 100, section.options.libraryIds)

  return (
    <Section
      title={sectionTitle(section)}
      items={list.data ?? []}
      isPending={list.isPending}
      error={list.error}
      emptyText={LIST_EMPTY[kind]}
      render={(visible) => (
        <CardRow size={cardSize} variant="poster">
          {visible.map((item) => (
            // For episodes posterUrl is the series poster, so no episode stills (spoiler-free).
            <PosterCard
              key={item.id}
              to={itemPath(item)}
              title={item.seriesName ?? item.name}
              subtitle={itemSubtitle(item)}
              tooltip={[item.seriesName, itemSubtitle(item)].filter(Boolean).join(': ') || item.name}
              imageUrl={item.posterUrl}
              progress={item.progress}
            />
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
