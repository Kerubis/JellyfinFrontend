import { useSearchParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import { useActivity } from '@/api/queries/admin'
import { useUsers } from '@/api/queries/users'
import { ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { ActivityList } from './OverviewSections'
import { LogsSection } from './LogsSection'
import { SectionTitle, TwoColumns } from './parts'

/** The server's activity log (sign-ins, playback, library changes, errors), newest first. */
export function ActivitySection() {
  const activity = useActivity()
  const users = useUsers(true)
  const names = new Map((users.data ?? []).map((u) => [u.id, u.name]))
  const items = (activity.data?.pages ?? []).flatMap((p) => p.items)
  const total = activity.data?.pages[0]?.total

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle action={total !== undefined && <span className="text-xs text-neutral-500">{total} entries</span>}>Activity</SectionTitle>
      {activity.isError && <ErrorText>{errorMessage(activity.error)}</ErrorText>}
      <ActivityList
        items={items.map((entry) => {
          // Most entries already name the user; add it where they don't.
          const user = entry.userId ? names.get(entry.userId) : undefined
          const prefix = user && !entry.name.includes(user) ? user : undefined
          return { ...entry, overview: [prefix, entry.overview].filter(Boolean).join(' · ') || undefined }
        })}
      />
      {activity.hasNextPage && (
        <Button variant="ghost" className="self-start" disabled={activity.isFetchingNextPage} onClick={() => void activity.fetchNextPage()}>
          {activity.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </section>
  )
}

/** Activity log and log files side by side; an open log file (`?file=`) gets the full width. */
export function ActivityAndLogs() {
  const [params] = useSearchParams()
  if (params.get('file')) return <LogsSection />
  return <TwoColumns left={<ActivitySection />} right={<LogsSection />} />
}
