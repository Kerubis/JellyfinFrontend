import { PosterCard } from '@/components/cards'
import type { MediaItem } from '@/domain/media'
import { itemPath } from '@/features/home/links'
import { MediaCaption } from './MediaCaption'
import { useMediaActions } from './useMediaActions'

/** Poster card for any item with the standard overlay actions (library, search, home rows). */
export function MediaItemCard({ item, marker }: { item: MediaItem; marker?: string }) {
  const { count, ...actions } = useMediaActions(item)
  return (
    <PosterCard
      {...actions}
      to={itemPath(item)}
      title={item.kind === 'episode' ? `${item.seriesName ?? ''} ${item.name}`.trim() : item.name}
      caption={<MediaCaption item={item} />}
      imageUrl={item.posterUrl}
      count={count}
      marker={marker}
      progress={item.progress}
    />
  )
}
