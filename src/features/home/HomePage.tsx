import { errorMessage } from '@/api/errors'
import { useLibraries } from '@/api/queries/libraries'
import type { Library } from '@/domain/library'

const TYPE_LABEL: Partial<Record<Library['type'], string>> = {
  movies: 'Movies',
  tvshows: 'Shows',
  music: 'Music',
  books: 'Books',
  photos: 'Photos',
  homevideos: 'Videos',
  boxsets: 'Collections',
  playlists: 'Playlists',
  livetv: 'Live TV',
}

// Placeholder until M3: lists the user's libraries to prove auth + data layer work end to end.
export function HomePage() {
  const libraries = useLibraries()

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-neutral-400 uppercase">Libraries</h2>
      {libraries.isPending && <p className="text-sm text-neutral-500">Loading…</p>}
      {libraries.isError && <p className="text-sm text-red-400">{errorMessage(libraries.error)}</p>}
      {libraries.data?.length === 0 && <p className="text-sm text-neutral-500">No libraries available for this user.</p>}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
        {libraries.data?.map((library) => (
          <li key={library.id} className="overflow-hidden rounded bg-neutral-900">
            <div className="aspect-video bg-neutral-800">
              {library.imageUrl && (
                <img src={library.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
              )}
            </div>
            <div className="flex items-baseline justify-between gap-2 px-2 py-1">
              <span className="truncate text-sm">{library.name}</span>
              <span className="shrink-0 text-[10px] text-neutral-500 uppercase">{TYPE_LABEL[library.type] ?? ''}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
