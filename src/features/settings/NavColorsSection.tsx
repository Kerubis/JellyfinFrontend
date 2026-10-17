import { usePref } from '@/api/prefs-context'
import { useLibraries } from '@/api/queries/libraries'
import { isBrowsable } from '@/domain/library'
import { NAV_HOME } from '@/domain/prefs'

/** What the picker starts from for links without a colour (the header's default link grey). */
const DEFAULT_COLOR = '#a3a3a3'

/** Text colour of each header link (Home + libraries), synced with the profile. */
export function NavColorsSection() {
  const ui = usePref('ui')
  const libraries = useLibraries()
  const { navColors } = ui.profile
  const { showHome } = usePref('safety').value
  const entries = [...(showHome ? [{ key: NAV_HOME, name: 'Home' }] : []), ...(libraries.data ?? []).filter(isBrowsable).map((l) => ({ key: l.id, name: l.name }))]

  const set = (key: string, color: string | undefined) => {
    const next = { ...navColors }
    if (color) next[key] = color
    else delete next[key]
    ui.update({ navColors: next })
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">Header link colours</h2>
      <ul className="flex flex-col gap-1.5">
        {entries.map(({ key, name }) => (
          <li key={key} className="flex items-center gap-3 text-sm">
            <input
              type="color"
              aria-label={`Text colour of ${name}`}
              value={navColors[key] ?? DEFAULT_COLOR}
              onChange={(e) => set(key, e.target.value)}
              className="h-7 w-10 cursor-pointer rounded border border-neutral-700 bg-neutral-900 p-0.5"
            />
            <span className="min-w-0 flex-1 truncate font-medium" style={navColors[key] ? { color: navColors[key] } : undefined}>
              {name}
            </span>
            {navColors[key] && (
              <button type="button" className="text-xs text-neutral-400 hover:text-neutral-100" onClick={() => set(key, undefined)}>
                Reset
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
