import { usePref } from '@/api/prefs-context'
import { DashboardSectionView } from './sections'

/** Sections are configured in Settings → Home. */
export function HomePage() {
  const { sections, deviceHidden } = usePref('dashboard').value
  const shown = sections.filter((s) => s.visible && !deviceHidden.includes(s.id))
  return (
    <div className="flex flex-col gap-6">
      {shown.length === 0 && <p className="text-sm text-neutral-500">No sections shown. Add some in Settings → Home.</p>}
      {shown.map((section) => (
        <DashboardSectionView key={section.id} section={section} />
      ))}
    </div>
  )
}
