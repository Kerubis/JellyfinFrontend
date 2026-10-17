import { useEffect, useState } from 'react'
import { usePref } from '@/api/prefs-context'
import { nextLimit } from '@/domain/safety'

/** "45 min" / "2 h 10 min". */
function formatLeft(seconds: number): string {
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  return minutes % 60 ? `${h} h ${minutes % 60} min` : `${h} h`
}

/**
 * Header chip for profiles with a daily budget or a bedtime (kid mode too): time left until whichever comes
 * first, amber in the last five minutes, red once reached. Usage is synced about once a minute while watching.
 */
export function TimeLeftChip() {
  const safety = usePref('safety').value
  const usage = usePref('safetyUsage').value
  const [now, setNow] = useState(() => new Date())
  const limited = safety.dailyMinutes > 0 || safety.bedtime.enabled
  useEffect(() => {
    if (!limited) return
    // Re-evaluate regularly: bedtime comes closer with the clock, a new day starts with a full budget.
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [limited])

  const next = nextLimit(safety, usage, now)
  if (!next) return null
  const reached = next.seconds <= 0
  const tone = reached ? 'border-red-500/50 text-red-300' : next.seconds <= 5 * 60 ? 'border-amber-500/50 text-amber-300' : 'border-neutral-700 text-neutral-300'
  const label = reached ? (next.kind === 'bedtime' ? 'Bedtime' : "Time's up") : `${formatLeft(next.seconds)} left`
  const title = next.kind === 'bedtime' ? 'Time until bedtime' : 'Watching time left today'

  return (
    <span title={title} className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${tone}`}>
      <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
        {/* Hourglass */}
        <path fill="currentColor" d="M6 2h12v2h-1v3.6a3 3 0 0 1-1.2 2.4L13.7 12l2.1 2a3 3 0 0 1 1.2 2.4V20h1v2H6v-2h1v-3.6a3 3 0 0 1 1.2-2.4l2.1-2-2.1-2A3 3 0 0 1 7 7.6V4H6V2Zm3 2v3.6c0 .3.1.6.4.8L12 10.7l2.6-2.3c.3-.2.4-.5.4-.8V4H9Zm3 9.3-2.6 2.3c-.3.2-.4.5-.4.8V20h6v-3.6c0-.3-.1-.6-.4-.8L12 13.3Z" />
      </svg>
      <span className="sr-only">{title}: </span>
      {label}
    </span>
  )
}
