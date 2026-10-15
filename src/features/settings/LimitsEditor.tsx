import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { useMediaFolders, useRatingLevels, useUpdateLimits } from '@/api/queries/users'
import { Button } from '@/components/Button'
import { CheckboxField } from '@/components/form'
import { hourLabel, SCHEDULE_DAYS, type AccessSchedule, type ManagedUser, type ScheduleDay, type UserLimits } from '@/domain/users'

const SELECT = 'rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm focus:border-accent-500 focus:outline-none'
const HOURS = Array.from({ length: 49 }, (_, i) => i / 2)

/** Jellyfin's hard limits for one user (enforced by the server); saved explicitly. */
export function LimitsEditor({ user }: { user: ManagedUser }) {
  const [draft, setDraft] = useState<UserLimits>(user.limits)
  const [tagsText, setTagsText] = useState(user.limits.blockedTags.join(', '))
  const ratings = useRatingLevels()
  const folders = useMediaFolders()
  const save = useUpdateLimits()
  const set = (patch: Partial<UserLimits>) => setDraft((d) => ({ ...d, ...patch }))
  const setSchedule = (i: number, patch: Partial<AccessSchedule>) =>
    set({ schedules: draft.schedules.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Jellyfin limits (enforced by the server)</h4>

      <label className="flex items-center justify-between gap-4 text-sm">
        Highest allowed rating
        <select
          className={SELECT}
          value={draft.maxParentalRating ?? ''}
          onChange={(e) => set({ maxParentalRating: e.target.value === '' ? null : Number(e.target.value) })}
        >
          <option value="">No limit</option>
          {ratings.data?.map((r) => (
            <option key={r.value} value={r.value}>
              Up to {r.value} ({r.names.slice(0, 4).join(', ')}
              {r.names.length > 4 ? ', …' : ''})
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1">
        <CheckboxField label="All libraries" checked={draft.allFolders} onChange={(allFolders) => set({ allFolders })} />
        {!draft.allFolders && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pl-6">
            {folders.data?.map((f) => (
              <CheckboxField
                key={f.id}
                label={f.name}
                checked={draft.folders.includes(f.id)}
                onChange={(on) => set({ folders: on ? [...draft.folders, f.id] : draft.folders.filter((id) => id !== f.id) })}
              />
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center justify-between gap-4 text-sm">
        Blocked tags
        <input
          value={tagsText}
          placeholder="e.g. Horror, Gore"
          onChange={(e) => setTagsText(e.target.value)}
          onBlur={() => set({ blockedTags: tagsText.split(',').map((t) => t.trim()).filter(Boolean) })}
          className={`${SELECT} w-56`}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm">Allowed times {draft.schedules.length === 0 && <span className="text-xs text-neutral-500">(always)</span>}</span>
        {draft.schedules.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 pl-2 text-sm">
            <select className={SELECT} value={s.day} onChange={(e) => setSchedule(i, { day: e.target.value as ScheduleDay })}>
              {SCHEDULE_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select className={SELECT} value={s.startHour} onChange={(e) => setSchedule(i, { startHour: Number(e.target.value) })}>
              {HOURS.slice(0, -1).map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            –
            <select className={SELECT} value={s.endHour} onChange={(e) => setSchedule(i, { endHour: Number(e.target.value) })}>
              {HOURS.slice(1).map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            <button type="button" className="text-xs text-neutral-400 hover:text-red-300" onClick={() => set({ schedules: draft.schedules.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <Button variant="ghost" className="self-start text-xs" onClick={() => set({ schedules: [...draft.schedules, { day: 'Everyday', startHour: 7, endHour: 20 }] })}>
          + Add time window
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate({ userId: user.id, limits: draft })}>
          {save.isPending ? 'Saving…' : 'Save Jellyfin limits'}
        </Button>
        {save.isSuccess && <span className="text-xs text-neutral-400">Saved</span>}
        {save.isError && <span className="text-xs text-red-400">{errorMessage(save.error)}</span>}
      </div>
    </div>
  )
}
