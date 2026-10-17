import { useMemo } from 'react'
import { usePref } from '@/api/prefs-context'
import { formatClock, formatDateTime, formatHour, resolveHour12 } from '@/lib/time'

/** The profile's time format (Settings → Appearance) with formatters bound to it. */
export function useTimeFormat() {
  const { timeFormat } = usePref('ui').value
  return useMemo(() => {
    const hour12 = resolveHour12(timeFormat)
    return {
      hour12,
      clock: (hhmm: string) => formatClock(hhmm, hour12),
      hour: (hours: number) => formatHour(hours, hour12),
      dateTime: (iso: string) => formatDateTime(iso, hour12),
    }
  }, [timeFormat])
}
