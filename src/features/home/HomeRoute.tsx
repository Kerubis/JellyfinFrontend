import { Navigate } from 'react-router'
import { usePref } from '@/api/prefs-context'
import { useLibraries } from '@/api/queries/libraries'
import { isBrowsable } from '@/domain/library'
import { HomePage } from './HomePage'

/** The start page: Home, or the first library for profiles without Home (app limit `showHome`). */
export function HomeRoute() {
  const { showHome } = usePref('safety').value
  const libraries = useLibraries()
  if (showHome) return <HomePage />
  if (libraries.isPending) return null
  const first = (libraries.data ?? []).find(isBrowsable)
  return first ? <Navigate to={`/library/${first.id}`} replace /> : <p className="text-sm text-neutral-500">No libraries available for this profile.</p>
}
