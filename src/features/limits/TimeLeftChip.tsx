import { useEffect, useState } from 'react'
import { usePref } from '@/api/prefs-context'
import { secondsLeftToday } from '@/domain/safety'

/**
 * Header chip for profiles with a daily watch-time budget (kid mode too): minutes left today, amber in the last
 * five, "Time's up" at zero. Usage is synced about once a minute while watching, so it follows along per minute.
 */
export function TimeLeftChip() {
  const safety = usePref('safety').value
  const usage = usePref('safetyUsage').value
  // Re-evaluate now and then (a new day starts with a full budget).
  const [now, setNow] = useState(() => new Date())
  const limited = safety.dailyMinutes > 0
  useEffect(() => {
    if (!limited) return
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [limited])

  const left = secondsLeftToday(safety, usage, now)
  if (left === null) return null
  const minutes = Math.ceil(left / 60)
  const tone = left === 0 ? 'border-red-500/50 text-red-300' : minutes <= 5 ? 'border-amber-500/50 text-amber-300' : 'border-neutral-700 text-neutral-300'
  const label = left === 0 ? "Time's up" : `${minutes} min left`

  return (
    <span title="Watching time left today" className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${tone}`}>
      <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
        {/* Hourglass */}
        <path fill="currentColor" d="M6 2h12v2h-1v3.6a3 3 0 0 1-1.2 2.4L13.7 12l2.1 2a3 3 0 0 1 1.2 2.4V20h1v2H6v-2h1v-3.6a3 3 0 0 1 1.2-2.4l2.1-2-2.1-2A3 3 0 0 1 7 7.6V4H6V2Zm3 2v3.6c0 .3.1.6.4.8L12 10.7l2.6-2.3c.3-.2.4-.5.4-.8V4H9Zm3 9.3-2.6 2.3c-.3.2-.4.5-.4.8V20h6v-3.6c0-.3-.1-.6-.4-.8L12 13.3Z" />
      </svg>
      <span className="sr-only">Watching time left today: </span>
      {label}
    </span>
  )
}
