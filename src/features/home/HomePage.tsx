import { usePref } from '@/api/prefs-context'
import { DashboardSectionView } from './sections'

export function HomePage() {
  const { sections } = usePref('dashboard').value
  return (
    <div className="flex flex-col gap-6">
      {sections
        .filter((s) => s.visible)
        .map((section) => (
          <DashboardSectionView key={section.id} section={section} />
        ))}
    </div>
  )
}
