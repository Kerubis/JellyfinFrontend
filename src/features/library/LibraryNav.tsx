import { NavLink } from 'react-router'
import { useLibraries } from '@/api/queries/libraries'

const LINK = ({ isActive }: { isActive: boolean }) =>
  `rounded px-2 py-1 text-sm whitespace-nowrap ${isActive ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-100'}`

/** Header navigation: Home + one link per video library. */
export function LibraryNav() {
  const libraries = useLibraries()
  const browsable = (libraries.data ?? []).filter((l) => ['tvshows', 'movies', 'boxsets', 'homevideos', 'other'].includes(l.type))
  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
      <NavLink to="/" end className={LINK}>
        Home
      </NavLink>
      {browsable.map((library) => (
        <NavLink key={library.id} to={`/library/${library.id}`} className={LINK}>
          {library.name}
        </NavLink>
      ))}
    </nav>
  )
}
