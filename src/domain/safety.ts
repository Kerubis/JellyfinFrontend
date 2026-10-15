// Soft limits enforced by this app (PLAN.md §3.1). Jellyfin enforces the hard limits (ratings, tags,
// libraries, access schedules); these are on top and can be worked around via the API by design.

export type Bedtime = { enabled: boolean; /** "HH:MM" */ start: string; /** "HH:MM" */ end: string }

export type SafetyPrefs = {
  /** Reduced app: home + browsing only, no settings, no profile switching (only sign out). */
  kidMode: boolean
  /** Minutes of playback per day; 0 = unlimited. */
  dailyMinutes: number
  /** No new playback between start and end (may span midnight). */
  bedtime: Bedtime
}

export type SafetyUsage = { /** Local date "YYYY-MM-DD" */ date: string; seconds: number }

export const DEFAULT_SAFETY: SafetyPrefs = {
  kidMode: false,
  dailyMinutes: 0,
  bedtime: { enabled: false, start: '20:00', end: '07:00' },
}

const pad = (n: number) => String(n).padStart(2, '0')

export function localDate(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const minutesOfDay = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function hasLimits(safety: SafetyPrefs): boolean {
  return safety.dailyMinutes > 0 || safety.bedtime.enabled
}

export function usedSecondsToday(usage: SafetyUsage, now: Date): number {
  return usage.date === localDate(now) ? usage.seconds : 0
}

export function inBedtime(bedtime: Bedtime, now: Date): boolean {
  if (!bedtime.enabled) return false
  const t = now.getHours() * 60 + now.getMinutes()
  const start = minutesOfDay(bedtime.start)
  const end = minutesOfDay(bedtime.end)
  return start <= end ? t >= start && t < end : t >= start || t < end
}

/** Minutes until bedtime starts (null when disabled or already in it). */
export function minutesUntilBedtime(bedtime: Bedtime, now: Date): number | null {
  if (!bedtime.enabled || inBedtime(bedtime, now)) return null
  const t = now.getHours() * 60 + now.getMinutes()
  return (minutesOfDay(bedtime.start) - t + 24 * 60) % (24 * 60)
}

/** Why new playback isn't allowed right now, or null. */
export function playbackBlock(safety: SafetyPrefs, usage: SafetyUsage, now: Date): string | null {
  if (inBedtime(safety.bedtime, now)) return `It's bedtime – watching is possible again from ${safety.bedtime.end}.`
  if (safety.dailyMinutes > 0 && usedSecondsToday(usage, now) >= safety.dailyMinutes * 60) {
    return `Today's ${safety.dailyMinutes} minutes are used up – see you tomorrow!`
  }
  return null
}

/** A short heads-up shown in the player before a limit is reached, or null. */
export function limitWarning(safety: SafetyPrefs, usage: SafetyUsage, now: Date): string | null {
  const untilBed = minutesUntilBedtime(safety.bedtime, now)
  if (untilBed !== null && untilBed <= 10) return `Bedtime in ${untilBed} min – no new episodes after that.`
  if (safety.dailyMinutes > 0) {
    const left = Math.ceil((safety.dailyMinutes * 60 - usedSecondsToday(usage, now)) / 60)
    if (left > 0 && left <= 5) return `${left} min of watching left today.`
  }
  return null
}

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
