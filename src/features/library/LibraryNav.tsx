import { NavLink } from 'react-router'
import { usePref } from '@/api/prefs-context'
import { useLibraries } from '@/api/queries/libraries'
import { headerLinkClass as LINK } from '@/components/headerLink'
import { isBrowsable } from '@/domain/library'
import { NAV_HOME } from '@/domain/prefs'

/** Header navigation: Home + one link per video library. */
export function LibraryNav() {
  const libraries = useLibraries()
  // Per-link text colour from Settings → Display; unset links keep the default grey / white.
  const { navColors } = usePref('ui').value
  const { showHome } = usePref('safety').value
  const color = (key: string) => (navColors[key] ? { color: navColors[key] } : undefined)
  const browsable = (libraries.data ?? []).filter(isBrowsable)
  return (
    <nav className="flex min-w-0 self-stretch overflow-x-auto [scrollbar-width:none]">
      {showHome && (
        <NavLink to="/" end className={LINK} style={color(NAV_HOME)}>
          Home
        </NavLink>
      )}
      {browsable.map((library) => (
        <NavLink key={library.id} to={`/library/${library.id}`} className={LINK} style={color(library.id)}>
          {library.name}
        </NavLink>
      ))}
    </nav>
  )
}
