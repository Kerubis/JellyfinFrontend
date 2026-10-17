import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { useGrantExtraTime, useSaveUserSafety, useUserSafety, useUserUsage } from '@/api/queries/users'
import { Button } from '@/components/Button'
import { CheckboxField, NumberField } from '@/components/form'
import { TimeField } from '@/components/TimeField'
import { budgetSecondsToday, HHMM, usedSecondsToday, type SafetyPrefs } from '@/domain/safety'

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
      <CheckboxField
        label="Show the Home page (off: no Home link, the app starts in the first library; e.g. for guests)"
        checked={draft.showHome}
        onChange={(showHome) => set({ showHome })}
      />
      <NumberField
        label="Daily watch time"
        value={draft.dailyMinutes}
        min={0}
        max={1440}
        suffix="min (0 = unlimited)"
        onChange={(dailyMinutes) => set({ dailyMinutes })}
      />
      <TodayUsage userId={userId} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <CheckboxField label="Bedtime from" checked={bedtime.enabled} onChange={(enabled) => set({ bedtime: { ...bedtime, enabled } })} />
        <TimeField label="Bedtime start" value={bedtime.start} disabled={!bedtime.enabled} onChange={(start) => set({ bedtime: { ...bedtime, start } })} />
        to
        <TimeField label="Bedtime end" value={bedtime.end} disabled={!bedtime.enabled} onChange={(end) => set({ bedtime: { ...bedtime, end } })} />
        <span className="text-xs text-neutral-500">playback stops, warning 10 min before (last minute in seconds)</span>
      </div>
      <p className="text-[11px] text-neutral-500">
        Soft limits can be worked around by someone who uses the Jellyfin API directly; the Jellyfin limits above can't.
      </p>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          disabled={save.isPending || !valid}
          // Only this form's fields: auto sign-out (account section) and extra time are kept as stored.
          onClick={() => save.mutate({ userId, patch: { kidMode: draft.kidMode, dailyMinutes: draft.dailyMinutes, bedtime: draft.bedtime, showHome: draft.showHome } })}
        >
          {save.isPending ? 'Saving…' : 'Save app limits'}
        </Button>
        {save.isSuccess && <span className="text-xs text-neutral-400">Saved</span>}
        {save.isError && <span className="text-xs text-red-400">{errorMessage(save.error)}</span>}
      </div>
    </div>
  )
}

/** Today's usage of this user and buttons to grant extra minutes (stored in their limits, gone tomorrow). */
function TodayUsage({ userId }: { userId: string }) {
  const safety = useUserSafety(userId)
  const usage = useUserUsage(userId)
  const grant = useGrantExtraTime()
  const [now] = useState(() => new Date())
  if (!safety.data || !usage.data || safety.data.dailyMinutes <= 0) return null
  const budget = (budgetSecondsToday(safety.data, now) ?? 0) / 60
  const used = Math.min(budget, Math.round(usedSecondsToday(usage.data, now) / 60))
  const extra = budget - safety.data.dailyMinutes
  return (
    <div className="flex flex-wrap items-center gap-2 pl-1 text-sm">
      <span className="text-neutral-400">
        Today: {used} of {budget} min used{extra > 0 ? ` (incl. ${extra} extra)` : ''}
      </span>
      {[15, 30].map((minutes) => (
        <Button key={minutes} variant="ghost" disabled={grant.isPending} onClick={() => grant.mutate({ userId, minutes })}>
          +{minutes} min today
        </Button>
      ))}
      {grant.isError && <span className="text-xs text-red-400">{errorMessage(grant.error)}</span>}
    </div>
  )
}
