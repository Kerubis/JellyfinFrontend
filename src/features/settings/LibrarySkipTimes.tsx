import { usePref } from '@/api/prefs-context'
import { useLibraries } from '@/api/queries/libraries'
import { OptionalNumberField } from '@/components/form'
import { SKIP_LIMITS } from '@/domain/prefs'

/** Per-library skip back/forward times (e.g. shorter for anime, longer for movies). */
export function LibrarySkipTimes() {
  const playback = usePref('playback')
  const libraries = useLibraries()
  const { skipBack, skipForward, librarySkip } = playback.profile
  const videoLibraries = (libraries.data ?? []).filter((l) => l.type === 'tvshows' || l.type === 'movies' || l.type === 'other')
  if (videoLibraries.length === 0) return null

  const set = (libraryId: string, patch: { back?: number; forward?: number }) => {
    const current = { ...librarySkip[libraryId], ...patch }
    const next = { ...librarySkip }
    if (current.back === undefined && current.forward === undefined) delete next[libraryId]
    else next[libraryId] = current
    playback.update({ librarySkip: next })
  }

  return (
    <details className="rounded border border-neutral-800 px-3 py-2" open={Object.keys(librarySkip).length > 0}>
      <summary className="cursor-pointer text-sm">Skip times per library</summary>
      <ul className="mt-2 flex flex-col gap-1.5">
        {videoLibraries.map((library) => (
          <li key={library.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{library.name}</span>
            <span className="flex gap-3">
              <OptionalNumberField
                label="back"
                value={librarySkip[library.id]?.back}
                placeholder={String(skipBack)}
                min={SKIP_LIMITS.min}
                max={SKIP_LIMITS.max}
                suffix="s"
                onChange={(back) => set(library.id, { back })}
              />
              <OptionalNumberField
                label="forward"
                value={librarySkip[library.id]?.forward}
                placeholder={String(skipForward)}
                min={SKIP_LIMITS.min}
                max={SKIP_LIMITS.max}
                suffix="s"
                onChange={(forward) => set(library.id, { forward })}
              />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-neutral-500">Empty fields use the times above.</p>
    </details>
  )
}
