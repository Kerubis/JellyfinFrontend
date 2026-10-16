import { useState } from 'react'
import { usePref } from '@/api/prefs-context'
import { useLibraries } from '@/api/queries/libraries'
import { Button } from '@/components/Button'
import { CheckboxField, OptionalNumberField } from '@/components/form'
import {
  createSection,
  DEFAULT_NEW_DAYS,
  DEFAULT_SECTIONS,
  moveSection,
  SECTION_INFO,
  SECTION_TYPES,
  type DashboardSection,
  type SectionType,
} from '@/domain/dashboard'

const ICON = 'flex size-7 items-center justify-center rounded text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-30'

/** Rename field: empty = the type's default title; saved on blur / Enter. */
function TitleInput({ section, onChange }: { section: DashboardSection; onChange: (title: string | undefined) => void }) {
  const [text, setText] = useState(section.title ?? '')
  const commit = () => {
    const title = text.trim() || undefined
    if (title !== section.title) onChange(title)
  }
  return (
    <input
      value={text}
      placeholder={SECTION_INFO[section.type].title}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      aria-label="Section title"
      className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold placeholder:text-neutral-300 hover:border-neutral-700 focus:border-accent-500 focus:outline-none"
    />
  )
}

function SectionRow({
  section,
  index,
  count,
  hiddenHere,
  onChange,
  onMove,
  onRemove,
  onHideHere,
}: {
  section: DashboardSection
  index: number
  count: number
  hiddenHere: boolean
  onChange: (patch: Partial<DashboardSection>) => void
  onMove: (delta: number) => void
  onRemove: () => void
  onHideHere: (hidden: boolean) => void
}) {
  const info = SECTION_INFO[section.type]
  const libraries = useLibraries()
  const videoLibraries = (libraries.data ?? []).filter((l) => l.type === 'tvshows' || l.type === 'movies' || l.type === 'other')
  const setOptions = (patch: Partial<DashboardSection['options']>) => onChange({ options: { ...section.options, ...patch } })
  const selectedLibraries = section.options.libraryIds ?? []

  return (
    <li className={`flex flex-col gap-2 rounded border border-neutral-800 p-2 ${section.visible && !hiddenHere ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-1">
        <button type="button" className={ICON} title="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" className={ICON} title="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
          ↓
        </button>
        <TitleInput key={section.title ?? ''} section={section} onChange={(title) => onChange({ title })} />
        <span className="hidden text-[11px] text-neutral-500 sm:inline">{info.title}</span>
        <button type="button" className={`${ICON} hover:text-red-300`} title="Remove section" onClick={onRemove}>
          ✕
        </button>
      </div>
      <p className="px-1 text-[11px] text-neutral-500">{info.description}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        <CheckboxField label="Visible" checked={section.visible} onChange={(visible) => onChange({ visible })} />
        <CheckboxField label="Hide on this device" checked={hiddenHere} onChange={onHideHere} />
        <CheckboxField
          label="Hide when empty"
          checked={!!section.options.hideWhenEmpty}
          onChange={(on) => setOptions({ hideWhenEmpty: on || undefined })}
        />
        {info.options.includes('limit') && (
          <OptionalNumberField
            key={`limit-${section.options.limit ?? ''}`}
            label="Max items"
            value={section.options.limit}
            placeholder={info.defaultLimit === 0 ? 'all' : String(info.defaultLimit)}
            min={0}
            max={500}
            onChange={(limit) => setOptions({ limit })}
          />
        )}
        {info.options.includes('days') && (
          <OptionalNumberField
            key={`days-${section.options.days ?? ''}`}
            label={section.type === 'newEpisodes' ? 'Only added in the last' : 'NEW badge for'}
            value={section.options.days}
            placeholder={section.type === 'newEpisodes' ? 'all' : String(DEFAULT_NEW_DAYS)}
            min={1}
            max={365}
            suffix="days"
            onChange={(days) => setOptions({ days })}
          />
        )}
      </div>
      {info.options.includes('libraries') && videoLibraries.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-neutral-400">
          <span>Libraries:</span>
          {videoLibraries.map((library) => (
            <CheckboxField
              key={library.id}
              label={library.name}
              checked={selectedLibraries.includes(library.id)}
              onChange={(on) => {
                const ids = on ? [...selectedLibraries, library.id] : selectedLibraries.filter((id) => id !== library.id)
                setOptions({ libraryIds: ids.length > 0 ? ids : undefined })
              }}
            />
          ))}
          <span className="text-[11px] text-neutral-500">(none ticked = all)</span>
        </div>
      )}
    </li>
  )
}

/** Settings → Home: order, visibility (synced / this device), titles, options, add / remove / reset. */
export function DashboardEditor() {
  const dashboard = usePref('dashboard')
  const { sections } = dashboard.profile
  const deviceHidden = dashboard.override?.deviceHidden ?? []
  const [newType, setNewType] = useState<SectionType>('recentlyAdded')

  const save = (next: DashboardSection[]) => dashboard.update({ sections: next })
  const setHiddenHere = (id: string, hidden: boolean) => {
    const ids = hidden ? [...new Set([...deviceHidden, id])] : deviceHidden.filter((x) => x !== id)
    const { deviceHidden: _removed, ...rest } = dashboard.override ?? {}
    dashboard.setOverride(ids.length > 0 ? { ...rest, deviceHidden: ids } : rest)
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">Home sections</h2>
        <p className="text-xs text-neutral-500">
          What the home page shows, in this order. Changes are saved right away and synced to your other devices.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {sections.map((section, index) => (
          <SectionRow
            key={section.id}
            section={section}
            index={index}
            count={sections.length}
            hiddenHere={deviceHidden.includes(section.id)}
            onChange={(patch) => save(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)))}
            onMove={(delta) => save(moveSection(sections, index, delta))}
            onRemove={() => save(sections.filter((_, i) => i !== index))}
            onHideHere={(hidden) => setHiddenHere(section.id, hidden)}
          />
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Section type"
          value={newType}
          onChange={(e) => setNewType(e.target.value as SectionType)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm focus:border-accent-500 focus:outline-none"
        >
          {SECTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {SECTION_INFO[type].title}
            </option>
          ))}
        </select>
        <Button onClick={() => save([...sections, createSection(newType, sections)])}>Add section</Button>
        <Button
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            save(DEFAULT_SECTIONS)
            const { deviceHidden: _removed, ...rest } = dashboard.override ?? {}
            dashboard.setOverride(rest)
          }}
        >
          Reset to default
        </Button>
      </div>
    </section>
  )
}
