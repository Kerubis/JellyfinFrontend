// Clock times ("HH:MM", always stored in 24 h) shown in the profile's time format (Settings → Appearance).

export type TimeFormat = 'auto' | '24' | '12'

/** Whether to show 12-hour times; "auto" follows the browser's language. */
export function resolveHour12(format: TimeFormat): boolean {
  if (format !== 'auto') return format === '12'
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "20:30" → "20:30" or "8:30 PM". */
export function formatClock(hhmm: string, hour12: boolean): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  if (!hour12) return `${pad(h)}:${pad(m)}`
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}

/** Decimal hours as Jellyfin stores access times (7.5 = 07:30, 24 = end of day). */
export function formatHour(hours: number, hour12: boolean): string {
  const h = Math.floor(hours)
  const clock = formatClock(`${pad(h % 24)}:${pad(Math.round((hours - h) * 60))}`, hour12)
  return h === 24 && !hour12 ? '24:00' : clock
}

/** Typed time → "HH:MM" (24 h): "2030", "20.30", "8", "8pm", "8:30 am", "12 AM". Undefined when it isn't a time. */
export function parseClock(text: string): string | undefined {
  const match = /^(\d{1,2})(?:[:.h ]?(\d{2}))?\s*([ap])?\.?m?\.?$/i.exec(text.trim())
  if (!match) return undefined
  let h = Number(match[1])
  const m = Number(match[2] ?? 0)
  const half = match[3]?.toLowerCase()
  if (half) {
    if (h < 1 || h > 12) return undefined
    h = (h % 12) + (half === 'p' ? 12 : 0)
  }
  return h < 24 && m < 60 ? `${pad(h)}:${pad(m)}` : undefined
}

/** Local date and time in the chosen format, e.g. for tooltips. */
export function formatDateTime(iso: string, hour12: boolean): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short', hour12 })
}
