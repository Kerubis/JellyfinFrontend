import type { ReactNode } from 'react'
import { Button } from '@/components/Button'
import { PREF_DEFS } from '@/domain/prefs'
import { EPISODE_RANGE_MAX, MEDIA_TYPES, type ScheduleFilters, type ScheduleStream } from '@/domain/schedule'

type Update = (patch: Partial<ScheduleFilters>) => void

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-accent-400 ${
        active ? 'border-accent-600 bg-accent-600 text-white' : 'border-neutral-600 text-neutral-300 hover:border-neutral-400'
      }`}
    >
      {children}
    </button>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-neutral-300">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

/** Chips that toggle values in a list. */
function MultiChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[]
  value: readonly T[]
  onChange: (value: T[]) => void
}) {
  return options.map((o) => (
    <Chip
      key={o.value}
      active={value.includes(o.value)}
      onClick={() => onChange(value.includes(o.value) ? value.filter((v) => v !== o.value) : [...value, o.value])}
    >
      {o.label}
    </Chip>
  ))
}

/** Chips where exactly one is selected. */
function SingleChips<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return options.map((o) => (
    <Chip key={String(o.value)} active={value === o.value} onClick={() => onChange(o.value)}>
      {o.label}
    </Chip>
  ))
}

function RangeInputs({ value, onChange }: { value: [number, number]; onChange: (value: [number, number]) => void }) {
  const [min, max] = value
  const input = (n: number, set: (n: number) => void, label: string) => (
    <input
      type="number"
      aria-label={label}
      min={0}
      max={EPISODE_RANGE_MAX}
      value={n}
      onChange={(e) => {
        const next = e.target.valueAsNumber
        if (!Number.isNaN(next)) set(Math.min(EPISODE_RANGE_MAX, Math.max(0, Math.round(next))))
      }}
      className="w-16 rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-right text-xs text-neutral-100 focus:border-accent-500 focus:outline-none"
    />
  )
  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-400">
      {input(min, (n) => onChange([n, Math.max(n, max)]), 'Minimum')}
      to
      {input(max, (n) => onChange([Math.min(min, n), n]), 'Maximum')}
      {max >= EPISODE_RANGE_MAX && <span>(no limit)</span>}
    </span>
  )
}

const HIDE_OPTIONS = {
  raw: [
    { value: 'sub', label: 'Subbed' },
    { value: 'dub', label: 'Dubbed' },
  ],
  sub: [
    { value: 'dub', label: 'Dubbed' },
    { value: 'raw', label: 'Raw exists' },
  ],
  dub: [
    { value: 'sub', label: 'Subbed' },
    { value: 'raw', label: 'Raw exists' },
  ],
} as const

/** Settings and filters, saved in the profile (synced). */
export function ScheduleFiltersPanel({
  filters,
  update,
  platforms,
}: {
  filters: ScheduleFilters
  update: Update
  /** Streaming platforms seen in the loaded weeks. */
  platforms: ScheduleStream[]
}) {
  return (
    <div className="grid gap-x-8 gap-y-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-accent-400">Settings</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Group label="Air type">
            <MultiChips
              options={[
                { value: 'raw', label: 'Raw' },
                { value: 'sub', label: 'Sub' },
                { value: 'dub', label: 'Dub' },
              ]}
              value={filters.airTypes}
              onChange={(airTypes) => update({ airTypes })}
            />
          </Group>
          <Group label="Hide raw when">
            <MultiChips options={HIDE_OPTIONS.raw} value={filters.hideRawWhen} onChange={(hideRawWhen) => update({ hideRawWhen })} />
          </Group>
          <Group label="Hide sub when">
            <MultiChips options={HIDE_OPTIONS.sub} value={filters.hideSubWhen} onChange={(hideSubWhen) => update({ hideSubWhen })} />
          </Group>
          <Group label="Hide dub when">
            <MultiChips options={HIDE_OPTIONS.dub} value={filters.hideDubWhen} onChange={(hideDubWhen) => update({ hideDubWhen })} />
          </Group>
          <Group label="Images">
            <SingleChips
              options={[
                { value: true, label: 'Show' },
                { value: false, label: 'Hide' },
              ]}
              value={filters.images}
              onChange={(images) => update({ images })}
            />
          </Group>
          <Group label="Donghua">
            <SingleChips
              options={[
                { value: true, label: 'Show' },
                { value: false, label: 'Hide' },
              ]}
              value={filters.donghua}
              onChange={(donghua) => update({ donghua })}
            />
          </Group>
          <Group label="Sort by">
            <SingleChips
              options={[
                { value: 'time', label: 'Time' },
                { value: 'alphabetical', label: 'Alphabetically' },
                { value: 'unaired', label: 'Unaired first' },
              ]}
              value={filters.sortBy}
              onChange={(sortBy) => update({ sortBy })}
            />
          </Group>
          <Group label="Week type">
            <SingleChips
              options={[
                { value: 'monday', label: 'Monday first' },
                { value: 'sunday', label: 'Sunday first' },
                { value: 'saturday', label: 'Saturday first' },
                { value: 'rotating', label: 'Rotating' },
              ]}
              value={filters.weekStart}
              onChange={(weekStart) => update({ weekStart })}
            />
          </Group>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-accent-400">Filters</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Group label="Streaming platforms">
            <SingleChips
              options={[
                { value: 'include', label: 'Include' },
                { value: 'exclude', label: 'Exclude' },
              ]}
              value={filters.platformMode}
              onChange={(platformMode) => update({ platformMode })}
            />
            <span className="w-px self-stretch bg-neutral-700" />
            {platforms.length === 0 && <span className="text-xs text-neutral-500">None this week</span>}
            <MultiChips
              options={platforms.map((p) => ({ value: p.platform, label: p.name }))}
              value={filters.platforms}
              onChange={(next) => update({ platforms: next })}
            />
          </Group>
          <Group label="Media type">
            <MultiChips
              options={MEDIA_TYPES.map((t) => ({ value: t.route, label: t.name }))}
              value={filters.mediaTypes}
              onChange={(mediaTypes) => update({ mediaTypes })}
            />
          </Group>
          <Group label="Total episodes">
            <RangeInputs value={filters.totalEpisodes} onChange={(totalEpisodes) => update({ totalEpisodes })} />
          </Group>
          <Group label="Aired episode">
            <RangeInputs value={filters.airedEpisode} onChange={(airedEpisode) => update({ airedEpisode })} />
          </Group>
        </div>
      </div>

      <div className="lg:col-span-2">
        <Button onClick={() => update(PREF_DEFS.schedule.defaults)}>Reset</Button>
      </div>
    </div>
  )
}
