import { useState } from 'react'
import { usePref } from '@/api/prefs-context'
import { useWriteThrough } from '@/api/queries/account'
import { useLibraries } from '@/api/queries/libraries'
import { useItemsByIds } from '@/api/queries/items'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/form'
import { jellyfinLanguagePatch, type PartialRule, type SubtitleMode } from '@/domain/tracks'
import { languageName, parseLanguageList } from '@/lib/languages'

const MODES: { value: SubtitleMode; label: string }[] = [
  { value: 'default', label: 'As marked in the file' },
  { value: 'smart', label: 'Smart (only when the audio is foreign)' },
  { value: 'always', label: 'Always' },
  { value: 'forced', label: 'Forced / Signs & Songs only' },
  { value: 'off', label: 'Off' },
]

const INHERIT = 'inherit'

/** Comma-separated language codes; saved on blur / Enter. */
function LanguageListField({ label, value, placeholder, onChange }: { label: string; value: string[] | undefined; placeholder: string; onChange: (codes: string[] | undefined) => void }) {
  const [text, setText] = useState(value?.join(', ') ?? '')
  const commit = () => {
    const codes = parseLanguageList(text)
    setText(codes.join(', '))
    onChange(codes.length > 0 ? codes : undefined)
  }
  const names = (value ?? []).map(languageName).join(', ')
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm" title={names}>
        {label}
      </label>
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="w-48 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm placeholder:text-neutral-600 focus:border-accent-500 focus:outline-none"
      />
    </div>
  )
}

function RuleFields({ rule, inheritLabel, onChange }: { rule: PartialRule; inheritLabel: string; onChange: (rule: PartialRule) => void }) {
  const set = (patch: PartialRule) => {
    const next: PartialRule = { ...rule, ...patch }
    for (const key of Object.keys(next) as (keyof PartialRule)[]) if (next[key] === undefined) delete next[key]
    onChange(next)
  }
  return (
    <>
      <LanguageListField label="Audio languages" value={rule.audio} placeholder={inheritLabel} onChange={(audio) => set({ audio })} />
      <LanguageListField label="Subtitle languages" value={rule.subtitles} placeholder={inheritLabel} onChange={(subtitles) => set({ subtitles })} />
      <SelectField
        label="Subtitles"
        value={rule.subtitleMode ?? INHERIT}
        options={[{ value: INHERIT, label: inheritLabel }, ...MODES]}
        onChange={(v) => set({ subtitleMode: v === INHERIT ? undefined : (v as SubtitleMode) })}
      />
    </>
  )
}

/** Audio/subtitle language defaults: profile-wide, per library, and what was remembered per series. */
export function LanguageSection() {
  const languages = usePref('languages')
  const writeThrough = useWriteThrough()
  const libraries = useLibraries()
  const { global, libraries: perLibrary } = languages.profile
  const videoLibraries = (libraries.data ?? []).filter((l) => l.type === 'tvshows' || l.type === 'movies' || l.type === 'other')

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">Languages</h2>
      <p className="text-[11px] text-neutral-500">
        Codes like <code>jpn, eng, deu</code> (or <code>ja, en, de</code>), most preferred first. Empty fields use the next level:
        library → profile → the file's defaults. Picking a track in the player is remembered per series. The profile setting is
        also saved to your Jellyfin user (first language only), so other Jellyfin apps use it too.
      </p>
      <RuleFields
        rule={global}
        inheritLabel="Jellyfin setting"
        onChange={(rule) => {
          writeThrough(jellyfinLanguagePatch(global, rule))
          languages.update({ global: rule })
        }}
      />

      {videoLibraries.map((library) => (
        <details key={library.id} className="rounded border border-neutral-800 px-3 py-2" open={!!perLibrary[library.id]}>
          <summary className="cursor-pointer text-sm">
            {library.name}
            {perLibrary[library.id] && Object.keys(perLibrary[library.id] ?? {}).length > 0 && (
              <span className="ml-2 text-[11px] text-accent-400">custom</span>
            )}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <RuleFields
              rule={perLibrary[library.id] ?? {}}
              inheritLabel="Profile setting"
              onChange={(rule) => {
                const next = { ...perLibrary }
                if (Object.keys(rule).length > 0) next[library.id] = rule
                else delete next[library.id]
                languages.update({ libraries: next })
              }}
            />
          </div>
        </details>
      ))}

      <RememberedTracks />
    </section>
  )
}

function RememberedTracks() {
  const seriesTracks = usePref('seriesTracks')
  const entries = seriesTracks.profile.entries
  const ids = Object.keys(entries)
  const items = useItemsByIds(ids)
  const names = new Map((items.data ?? []).map((i) => [i.id, i.name]))
  if (ids.length === 0) return null

  const forget = (id?: string) => {
    if (!id) return seriesTracks.update({ entries: {} })
    const next = { ...entries }
    delete next[id]
    seriesTracks.update({ entries: next })
  }
  const describe = (id: string) => {
    const e = entries[id]
    const audio = e?.audio?.language ? languageName(e.audio.language) : '–'
    const sub = e?.subtitle === 'off' ? 'no subtitles' : e?.subtitle?.language ? `${languageName(e.subtitle.language)} subtitles${e.subtitle.forced ? ' (signs)' : ''}` : '–'
    return `${audio} audio, ${sub}`
  }

  return (
    <details className="rounded border border-neutral-800 px-3 py-2">
      <summary className="cursor-pointer text-sm">Remembered per series ({ids.length})</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {ids.map((id) => (
          <li key={id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              {names.get(id) ?? '…'} <span className="text-xs text-neutral-500">· {describe(id)}</span>
            </span>
            <Button variant="ghost" onClick={() => forget(id)}>
              Forget
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" className="mt-1" onClick={() => forget()}>
        Forget all
      </Button>
    </details>
  )
}
