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
  /** Off: no Home page / link, the app starts in the first library (e.g. for guests). */
  showHome: boolean
  /** Sign the profile out after this many minutes without watching (0 = never), e.g. for guests. */
  autoSignOutMinutes: number
  /** Extra minutes an admin granted for one day (on top of dailyMinutes; ignored on other days). */
  extra: { /** Local date "YYYY-MM-DD" */ date: string; minutes: number }
}

export type SafetyUsage = { /** Local date "YYYY-MM-DD" */ date: string; seconds: number }

export const DEFAULT_SAFETY: SafetyPrefs = {
  kidMode: false,
  dailyMinutes: 0,
  bedtime: { enabled: false, start: '20:00', end: '07:00' },
  showHome: true,
  autoSignOutMinutes: 0,
  extra: { date: '', minutes: 0 },
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
  return safety.dailyMinutes > 0 || safety.bedtime.enabled || !safety.showHome || safety.autoSignOutMinutes > 0
}

export function usedSecondsToday(usage: SafetyUsage, now: Date): number {
  return usage.date === localDate(now) ? usage.seconds : 0
}

/** Today's budget in seconds (daily limit + extra minutes granted for today); null = no daily limit. */
export function budgetSecondsToday(safety: SafetyPrefs, now: Date): number | null {
  if (safety.dailyMinutes <= 0) return null
  const extra = safety.extra.date === localDate(now) ? safety.extra.minutes : 0
  return (safety.dailyMinutes + extra) * 60
}

/** Seconds of watching left today (never negative); null = no daily limit. */
export function secondsLeftToday(safety: SafetyPrefs, usage: SafetyUsage, now: Date): number | null {
  const budget = budgetSecondsToday(safety, now)
  return budget === null ? null : Math.max(0, budget - usedSecondsToday(usage, now))
}

/** Adds minutes to today's extra time (a new day starts from zero). */
export function grantExtra(safety: SafetyPrefs, minutes: number, now: Date): SafetyPrefs {
  const today = localDate(now)
  const current = safety.extra.date === today ? safety.extra.minutes : 0
  return { ...safety, extra: { date: today, minutes: current + minutes } }
}

export function inBedtime(bedtime: Bedtime, now: Date): boolean {
  if (!bedtime.enabled) return false
  const t = now.getHours() * 60 + now.getMinutes()
  const start = minutesOfDay(bedtime.start)
  const end = minutesOfDay(bedtime.end)
  return start <= end ? t >= start && t < end : t >= start || t < end
}

/** Seconds until bedtime starts (null when disabled or already in it). */
export function secondsUntilBedtime(bedtime: Bedtime, now: Date): number | null {
  if (!bedtime.enabled || inBedtime(bedtime, now)) return null
  const t = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  return (minutesOfDay(bedtime.start) * 60 - t + 24 * 3600) % (24 * 3600)
}

/** Why new playback isn't allowed right now, or null. */
export function playbackBlock(safety: SafetyPrefs, usage: SafetyUsage, now: Date): string | null {
  if (inBedtime(safety.bedtime, now)) return `It's bedtime – watching is possible again from ${safety.bedtime.end}.`
  if (secondsLeftToday(safety, usage, now) === 0) return `Today's watching time is used up – see you tomorrow!`
  return null
}

/** A short heads-up shown in the player before a limit is reached, or null. */
export function limitWarning(safety: SafetyPrefs, usage: SafetyUsage, now: Date): string | null {
  // Playback stops when bedtime starts; the last minute counts down in seconds.
  const untilBed = secondsUntilBedtime(safety.bedtime, now)
  if (untilBed !== null && untilBed <= 10 * 60) {
    const left = untilBed < 60 ? `${untilBed} s` : `${Math.ceil(untilBed / 60)} min`
    return `Bedtime in ${left} – no more TV after that.`
  }
  const left = secondsLeftToday(safety, usage, now)
  if (left !== null && left > 0 && left <= 5 * 60) return `${Math.ceil(left / 60)} min of watching left today.`
  return null
}

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
