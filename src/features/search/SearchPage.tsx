import { Link, useSearchParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import { usePref } from '@/api/prefs-context'
import { useSearch } from '@/api/queries/library'
import { useSeerrConfig } from '@/api/seerr'
import { CardGrid } from '@/components/cards'
import type { MediaItem } from '@/domain/media'
import { MediaItemCard } from '@/features/media/MediaItemCard'

function Results({ title, query }: { title: string; query: { data?: MediaItem[]; isPending: boolean; error: unknown } }) {
  const { cardSize } = usePref('ui').value
  if (query.isPending) return <p className="text-xs text-neutral-500">Searching {title.toLowerCase()}…</p>
  if (query.error) return <p className="text-xs text-red-400">{errorMessage(query.error)}</p>
  if (!query.data?.length) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">
        {title} <span className="text-xs font-normal text-neutral-500">{query.data.length}</span>
      </h2>
      <CardGrid size={cardSize} variant="poster">
        {query.data.map((item) => (
          <MediaItemCard key={item.id} item={item} />
        ))}
      </CardGrid>
    </section>
  )
}

export function SearchPage() {
  const [params] = useSearchParams()
  const term = params.get('q') ?? ''
  const { enabled, titles, episodes } = useSearch(term)
  const seerr = useSeerrConfig()

  if (!enabled) return <p className="text-sm text-neutral-500">Type at least 2 characters to search titles.</p>
  const nothing = !titles.isPending && !episodes.isPending && !titles.data?.length && !episodes.data?.length

  return (
    <div className="flex flex-col gap-6">
      <Results title="Shows & movies" query={titles} />
      <Results title="Episodes" query={episodes} />
      {nothing && (
        <p className="text-sm text-neutral-500">
          Nothing found for “{term}”. Search matches the titles stored in Jellyfin (e.g. the English title, not a nickname).
        </p>
      )}
      {seerr && !titles.isPending && (
        <p className="text-sm text-neutral-400">
          Not in your library?{' '}
          <Link to={`/requests?q=${encodeURIComponent(term)}`} className="text-accent-400 hover:underline">
            Request “{term}” with Seerr
          </Link>
        </p>
      )}
    </div>
  )
}
