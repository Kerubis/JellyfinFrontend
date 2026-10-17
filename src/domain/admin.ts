// Server administration (Settings → Administration): our own shapes for system info, sessions, tasks,
// activity and logs, mapped from Jellyfin DTOs in src/api/queries/admin.ts.

export type ServerInfo = {
  name: string
  version: string
  /** e.g. "Linux X64"; empty when the server doesn't say. */
  platform: string
  address?: string
  hasPendingRestart: boolean
  hasUpdateAvailable: boolean
  canRestart: boolean
}

/** One disk as Jellyfin sees it; several server folders often share the same disk. */
export type StorageDisk = {
  /** What lives on it, e.g. ["Data", "Cache", "Transcodes"] or ["Anime"]. */
  uses: string[]
  path: string
  free: number
  used: number
  network: boolean
}

export type PlayMethod = 'DirectPlay' | 'DirectStream' | 'Transcode'

export type AdminSession = {
  id: string
  userName?: string
  client: string
  deviceName: string
  appVersion?: string
  lastActivity?: string
  /** The client accepts commands (stop) / messages from the server. */
  mediaControl: boolean
  remoteControl: boolean
  nowPlaying?: {
    title: string
    /** "Series · S01E05" for episodes. */
    subtitle?: string
    positionSeconds: number
    durationSeconds?: number
    paused: boolean
    playMethod?: PlayMethod
    /** Why the server transcodes, e.g. "AudioCodecNotSupported". */
    transcodeReasons: string[]
    /** Hardware encoder in use, when transcoding. */
    hardwareAccel?: string
  }
}

export type TaskTrigger =
  | { type: 'daily'; secondsOfDay: number }
  | { type: 'weekly'; day: string; secondsOfDay: number }
  | { type: 'interval'; seconds: number }
  | { type: 'startup' }

export type TaskResult = { status: string; start?: string; end?: string; error?: string }

export type ScheduledTask = {
  id: string
  key: string
  name: string
  description: string
  category: string
  state: 'Idle' | 'Running' | 'Cancelling'
  /** 0–100 while running. */
  progress?: number
  lastResult?: TaskResult
  triggers: TaskTrigger[]
}

export type ActivityEntry = {
  id: number
  name: string
  overview?: string
  type: string
  date: string
  severity: 'Information' | 'Warning' | 'Error' | string
  userId?: string
}

export type LogFile = { name: string; size: number; modified: string }

const clock = (secondsOfDay: number) => {
  const h = Math.floor(secondsOfDay / 3600)
  const m = Math.floor((secondsOfDay % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "Daily at 03:00", "Every 12 hours", "Sundays at 02:00", "On startup". */
export function triggerLabel(trigger: TaskTrigger): string {
  switch (trigger.type) {
    case 'daily':
      return `Daily at ${clock(trigger.secondsOfDay)}`
    case 'weekly':
      return `${trigger.day}s at ${clock(trigger.secondsOfDay)}`
    case 'startup':
      return 'On startup'
    case 'interval': {
      const hours = trigger.seconds / 3600
      if (hours >= 24 && hours % 24 === 0) return hours === 24 ? 'Every day' : `Every ${hours / 24} days`
      if (hours >= 1) return hours === 1 ? 'Every hour' : `Every ${+hours.toFixed(2)} hours`
      return `Every ${Math.round(trigger.seconds / 60)} minutes`
    }
  }
}

/** Task status for display: running with progress, or how the last run went. */
export function isTaskRunning(task: ScheduledTask): boolean {
  return task.state !== 'Idle'
}

/** Library kinds that can be created here (video; this client doesn't browse music, books or photos). */
export const LIBRARY_KINDS = [
  { value: 'tvshows', label: 'Shows' },
  { value: 'movies', label: 'Movies' },
  { value: 'mixed', label: 'Mixed movies and shows' },
  { value: 'homevideos', label: 'Home videos' },
  { value: 'musicvideos', label: 'Music videos' },
] as const

export type LibraryKind = (typeof LIBRARY_KINDS)[number]['value']

/** The library options this client edits; everything else Jellyfin stores is kept as it is. */
export type LibrarySettings = {
  realtimeMonitor: boolean
  /** Write artwork and NFO files next to the media. */
  saveLocalMetadata: boolean
  metadataLanguage: string
  metadataCountry: string
  /** Refresh metadata every N days (0 = never). */
  refreshDays: number
  trickplay: boolean
  trickplayDuringScan: boolean
  chapterImages: boolean
  chapterImagesDuringScan: boolean
  embeddedTitles: boolean
}

export type AdminLibrary = {
  id: string
  name: string
  /** Jellyfin collection type, e.g. "tvshows"; undefined for mixed libraries. */
  kind?: string
  paths: string[]
  refreshing: boolean
  settings: LibrarySettings
}

export type FolderEntry = { name: string; path: string }
