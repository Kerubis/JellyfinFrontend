import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { useSaveUserSafety, useUserSafety } from '@/api/queries/users'
import { Button } from '@/components/Button'
import { CheckboxField, NumberField } from '@/components/form'
import { HHMM, type SafetyPrefs } from '@/domain/safety'

const TIME = 'rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm focus:border-accent-500 focus:outline-none'

/** Soft limits (enforced by this app) for one user, stored in that user's synced prefs. */
export function SafetyEditor({ userId }: { userId: string }) {
  const stored = useUserSafety(userId)
  if (stored.isPending) return <p className="text-xs text-neutral-500">Loading…</p>
  if (stored.isError) return <p className="text-xs text-red-400">{errorMessage(stored.error)}</p>
  return <SafetyForm userId={userId} initial={stored.data} />
}

function SafetyForm({ userId, initial }: { userId: string; initial: SafetyPrefs }) {
  const [draft, setDraft] = useState(initial)
  const save = useSaveUserSafety()
  const set = (patch: Partial<SafetyPrefs>) => setDraft((d) => ({ ...d, ...patch }))
  const bedtime = draft.bedtime
  const valid = !bedtime.enabled || (HHMM.test(bedtime.start) && HHMM.test(bedtime.end))

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">App limits (soft, enforced by this app)</h4>
      <CheckboxField
        label="Kid mode: no settings, no profile switching (only sign out)"
        checked={draft.kidMode}
        onChange={(kidMode) => set({ kidMode })}
      />
      <NumberField
        label="Daily watch time"
        value={draft.dailyMinutes}
        min={0}
        max={1440}
        suffix="min (0 = unlimited)"
        onChange={(dailyMinutes) => set({ dailyMinutes })}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <CheckboxField label="Bedtime from" checked={bedtime.enabled} onChange={(enabled) => set({ bedtime: { ...bedtime, enabled } })} />
        <input type="time" className={TIME} value={bedtime.start} disabled={!bedtime.enabled} onChange={(e) => set({ bedtime: { ...bedtime, start: e.target.value } })} />
        to
        <input type="time" className={TIME} value={bedtime.end} disabled={!bedtime.enabled} onChange={(e) => set({ bedtime: { ...bedtime, end: e.target.value } })} />
        <span className="text-xs text-neutral-500">no new playback, warning 10 min before</span>
      </div>
      <p className="text-[11px] text-neutral-500">
        Soft limits can be worked around by someone who uses the Jellyfin API directly; the Jellyfin limits above can't.
      </p>
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={save.isPending || !valid} onClick={() => save.mutate({ userId, safety: draft })}>
          {save.isPending ? 'Saving…' : 'Save app limits'}
        </Button>
        {save.isSuccess && <span className="text-xs text-neutral-400">Saved</span>}
        {save.isError && <span className="text-xs text-red-400">{errorMessage(save.error)}</span>}
      </div>
    </div>
  )
}
