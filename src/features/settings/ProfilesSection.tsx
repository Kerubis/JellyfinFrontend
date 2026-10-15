import { usePref } from '@/api/prefs-context'
import { useCurrentUser, useMediaFolders, useRatingLevels, useUsers } from '@/api/queries/users'
import { useSignedIn } from '@/api/session-context'
import { Avatar } from '@/components/Avatar'
import { hasLimits } from '@/domain/safety'
import { hasHardLimits, hourLabel, type ManagedUser } from '@/domain/users'
import { LimitsEditor } from './LimitsEditor'
import { SafetyEditor } from './SafetyEditor'

const TITLE = 'text-sm font-semibold tracking-wide text-neutral-400 uppercase'

/** Admins: every other user's Jellyfin limits and app limits. Others: their own limits, read-only. */
export function ProfilesSection() {
  const me = useCurrentUser()
  if (!me.data) return null
  return me.data.isAdmin ? <AdminProfiles /> : <OwnRestrictions user={me.data} />
}

function AdminProfiles() {
  const { account } = useSignedIn()
  const users = useUsers(true)
  const others = (users.data ?? []).filter((u) => u.id !== account.userId)
  return (
    <section className="flex flex-col gap-2">
      <h2 className={TITLE}>Profiles & limits</h2>
      {others.length === 0 && <p className="text-xs text-neutral-500">No other users on this server.</p>}
      {others.map((user) => (
        <details key={user.id} className="rounded border border-neutral-800 px-3 py-2">
          <summary className="flex cursor-pointer items-center gap-2 text-sm">
            <Avatar name={user.name} url={user.avatarUrl} />
            {user.name}
            <span className="text-[11px] text-neutral-500">{user.isAdmin ? 'administrator' : hasHardLimits(user.limits) ? 'limited' : 'no limits'}</span>
          </summary>
          {user.isAdmin ? (
            <p className="mt-2 text-xs text-neutral-500">Administrators can't be limited.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-5">
              <LimitsEditor user={user} />
              <SafetyEditor userId={user.id} />
            </div>
          )}
        </details>
      ))}
    </section>
  )
}

function OwnRestrictions({ user }: { user: ManagedUser }) {
  const safety = usePref('safety').value
  const ratings = useRatingLevels()
  const folders = useMediaFolders()
  const { limits } = user
  if (!hasHardLimits(limits) && !hasLimits(safety)) return null
  const rating = limits.maxParentalRating !== null ? ratings.data?.find((r) => r.value === limits.maxParentalRating) : undefined
  const rows: [string, string][] = []
  if (limits.maxParentalRating !== null) rows.push(['Ratings', `up to ${limits.maxParentalRating}${rating ? ` (${rating.names.slice(0, 3).join(', ')})` : ''}`])
  if (!limits.allFolders) rows.push(['Libraries', limits.folders.map((id) => folders.data?.find((f) => f.id === id)?.name ?? '…').join(', ') || 'none'])
  if (limits.blockedTags.length > 0) rows.push(['Blocked tags', limits.blockedTags.join(', ')])
  if (limits.schedules.length > 0) rows.push(['Allowed times', limits.schedules.map((s) => `${s.day} ${hourLabel(s.startHour)}–${hourLabel(s.endHour)}`).join(', ')])
  if (safety.dailyMinutes > 0) rows.push(['Daily watch time', `${safety.dailyMinutes} min`])
  if (safety.bedtime.enabled) rows.push(['Bedtime', `${safety.bedtime.start}–${safety.bedtime.end}`])
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
