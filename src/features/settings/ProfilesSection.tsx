import { useState } from 'react'
import { usePref } from '@/api/prefs-context'
import { useCurrentUser, useMediaFolders, useRatingLevels } from '@/api/queries/users'
import { budgetSecondsToday, hasLimits, usedSecondsToday } from '@/domain/safety'
import { hasHardLimits, type ManagedUser } from '@/domain/users'
import { useTimeFormat } from '@/hooks/useTimeFormat'

const TITLE = 'text-sm font-semibold tracking-wide text-neutral-400 uppercase'

/** Non-admins: their own limits, read-only. */
export function OwnLimitsSection() {
  const me = useCurrentUser()
  return me.data ? <OwnRestrictions user={me.data} /> : null
}

function OwnRestrictions({ user }: { user: ManagedUser }) {
  const safety = usePref('safety').value
  const usage = usePref('safetyUsage').value
  const [now] = useState(() => new Date())
  const ratings = useRatingLevels()
  const folders = useMediaFolders()
  const time = useTimeFormat()
  const { limits } = user
  if (!hasHardLimits(limits) && !hasLimits(safety)) return null
  const rating = limits.maxParentalRating !== null ? ratings.data?.find((r) => r.value === limits.maxParentalRating) : undefined
  const rows: [string, string][] = []
  if (limits.maxParentalRating !== null) rows.push(['Ratings', `up to ${limits.maxParentalRating}${rating ? ` (${rating.names.slice(0, 3).join(', ')})` : ''}`])
  if (!limits.allFolders) rows.push(['Libraries', limits.folders.map((id) => folders.data?.find((f) => f.id === id)?.name ?? '…').join(', ') || 'none'])
  if (limits.blockedTags.length > 0) rows.push(['Blocked tags', limits.blockedTags.join(', ')])
  if (limits.schedules.length > 0) rows.push(['Allowed times', limits.schedules.map((s) => `${s.day} ${time.hour(s.startHour)}–${time.hour(s.endHour)}`).join(', ')])
  if (safety.dailyMinutes > 0) {
    const budget = (budgetSecondsToday(safety, now) ?? 0) / 60
    const used = Math.min(budget, Math.round(usedSecondsToday(usage, now) / 60))
    rows.push(['Daily watch time', `${budget} min${budget > safety.dailyMinutes ? ` (incl. ${budget - safety.dailyMinutes} extra today)` : ''} · ${used} min used today`])
  }
  if (safety.bedtime.enabled) rows.push(['Bedtime', `${time.clock(safety.bedtime.start)}–${time.clock(safety.bedtime.end)}`])
  if (!safety.showHome) rows.push(['Home page', 'hidden'])
  if (safety.autoSignOutMinutes > 0) rows.push(['Automatic sign-out', `after ${safety.autoSignOutMinutes} min without watching`])
  return (
    <section className="flex flex-col gap-2">
      <h2 className={TITLE}>Restrictions</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-neutral-500">Set by an administrator.</p>
    </section>
  )
}
