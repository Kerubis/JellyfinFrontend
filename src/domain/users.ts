// Jellyfin's own (hard) per-user limits, enforced by the server.

export const SCHEDULE_DAYS = ['Everyday', 'Weekday', 'Weekend', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export type ScheduleDay = (typeof SCHEDULE_DAYS)[number]

/** Hours are decimals as in Jellyfin (e.g. 7.5 = 07:30). */
export type AccessSchedule = { day: ScheduleDay; startHour: number; endHour: number }

export type UserLimits = {
  /** Highest allowed rating level (null = no limit). */
  maxParentalRating: number | null
  blockedTags: string[]
  /** All libraries, or only `folders`. */
  allFolders: boolean
  folders: string[]
  /** Allowed times; empty = always. */
  schedules: AccessSchedule[]
}

/** Account switches from the user's Jellyfin policy (admin user management). */
export type UserAccess = {
  isAdmin: boolean
  /** Can't sign in at all. */
  disabled: boolean
  /** Not listed on login screens (sign in by typing the name). */
  hidden: boolean
  /** May connect from outside the LAN. */
  remoteAccess: boolean
  downloads: boolean
  /** May get transcoded streams (off = direct play / remux only). */
  transcoding: boolean
}

export type ManagedUser = {
  id: string
  name: string
  isAdmin: boolean
  avatarUrl?: string
  limits: UserLimits
  access: UserAccess
  hasPassword: boolean
  lastActivity?: string
}

/** Ratings grouped by level: "up to 7 (TV-Y7, …)". */
export type RatingLevel = { value: number; names: string[] }

export function hasHardLimits(limits: UserLimits): boolean {
  return limits.maxParentalRating !== null || limits.blockedTags.length > 0 || !limits.allFolders || limits.schedules.length > 0
}

