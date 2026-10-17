import { useScheduledTasks } from '@/api/queries/admin'
import { Meter } from './parts'

/** Progress of Jellyfin's "Scan Media Library" task while it runs (tasks are polled every 2 s then). */
export function ScanProgress() {
  const tasks = useScheduledTasks()
  const scan = tasks.data?.find((t) => t.key === 'RefreshLibrary')
  if (!scan || scan.state === 'Idle') return null
  const percent = Math.round(scan.progress ?? 0)
  return (
    <div className="flex max-w-md flex-col gap-1">
      <div className="flex justify-between text-xs text-neutral-400">
        <span>{scan.state === 'Cancelling' ? 'Stopping library scan…' : 'Scanning libraries…'}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <Meter value={percent / 100} />
    </div>
  )
}
