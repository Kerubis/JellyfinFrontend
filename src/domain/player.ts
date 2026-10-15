import { episodeLabel } from './media'
import type { MediaTracks, TrackChoice } from './tracks'

// Player model. Every way of controlling playback (UI, keyboard, media keys, later Home Assistant via
// the Jellyfin session socket) goes through PlayerCommand (PLAN.md D8).

export type PlayMethod = 'DirectPlay' | 'DirectStream' | 'Transcode'

/** What is playing, for display and reporting. */
export type NowPlaying = {
  id: string
  kind: 'episode' | 'movie' | 'other'
  name: string
  seriesId?: string
  seriesName?: string
  seasonNumber?: number
  episodeNumber?: number
  posterUrl?: string
  durationSeconds?: number
  /** Library (collection folder) the item belongs to, for per-library language rules. */
  libraryId?: string
}

export type TextTrack = { index: number; label: string; language?: string; url: string; isDefault: boolean }

/** Result of the server's PlaybackInfo decision. */
export type PlaybackSource = {
  itemId: string
  mediaSourceId: string
  playSessionId: string
  url: string
  /** 'hls' for transcodes / remuxes, 'direct' for a static file. */
  kind: 'direct' | 'hls'
  playMethod: PlayMethod
  audioStreamIndex?: number
  /** Requested subtitle stream; for image subtitles it is burned into the video. */
  subtitleStreamIndex?: number
  /** The requested subtitle is an image format and therefore burned in by the server. */
  burnedIn: boolean
  /** Text subtitles as WebVTT (ASS loses its styling here until M7). */
  textTracks: TextTrack[]
}

/** How to request a source: which media source and tracks, and whether direct play is allowed. */
export type SourceRequest = TrackChoice & { mediaSourceId: string; allowDirectPlay: boolean }

/** What gets reported to the server (start / progress / stopped). */
export type PlaybackReport = {
  source: PlaybackSource
  positionSeconds: number
  isPaused: boolean
  isMuted: boolean
  volume: number
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'

export type PlayerState = {
  status: PlayerStatus
  item?: NowPlaying
  source?: PlaybackSource
  /** Seconds. */
  position: number
  duration: number
  /** Seconds buffered ahead of the playhead's range end. */
  bufferedUntil: number
  volume: number
  muted: boolean
  view: 'full' | 'mini'
  fullscreen: boolean
  error?: string
  /** Set while waiting for the user to choose resume / start over. */
  resumePrompt?: { positionSeconds: number }
  /** The episode after this one (looked up once playback starts). */
  nextItemId?: string
  /** All audio/subtitle streams of the current item. */
  tracks?: MediaTracks
  /** Selected subtitle stream (text: drawn by us; image: burned in), null = off. */
  subtitleIndex: number | null
  /** Subtitle delay in seconds (positive = later). */
  subtitleOffset: number
}

export type StartAt = 'auto' | 'resume' | 'beginning' | number

export type PlayerCommand =
  | { type: 'play'; itemId: string; startAt?: StartAt }
  | { type: 'resolveResume'; resume: boolean }
  | { type: 'togglePause' }
  | { type: 'pause' }
  | { type: 'unpause' }
  | { type: 'seek'; seconds: number }
  | { type: 'seekBy'; seconds: number }
  | { type: 'next' }
  | { type: 'stop' }
  | { type: 'setVolume'; volume: number }
  | { type: 'toggleMute' }
  | { type: 'setView'; view: PlayerState['view'] }
  | { type: 'toggleFullscreen' }
  | { type: 'setAudioTrack'; index: number }
  | { type: 'setSubtitleTrack'; index: number | null }
  | { type: 'adjustSubtitleOffset'; seconds: number }
  | { type: 'resetSubtitleOffset' }

export const INITIAL_PLAYER_STATE: PlayerState = {
  status: 'idle',
  position: 0,
  duration: 0,
  bufferedUntil: 0,
  volume: 1,
  muted: false,
  view: 'full',
  fullscreen: false,
  subtitleIndex: null,
  subtitleOffset: 0,
}

export const TICKS_PER_SECOND = 10_000_000

/** "Series" + "S01E05 · Episode name" for episodes, just the name otherwise. */
export function nowPlayingTitle(item: NowPlaying | undefined): { title: string; subtitle?: string } {
  if (!item) return { title: '' }
  if (item.kind === 'episode') {
    return { title: item.seriesName ?? item.name, subtitle: [episodeLabel(item), item.name].filter(Boolean).join(' · ') }
  }
  return { title: item.name }
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** Per-device playback settings (not synced: they describe this screen/network). */
export type DevicePlaybackSettings = {
  /** Mbps; 0 = automatic (no limit below the server's). */
  maxBitrateMbps: number
  /** Let the browser play Matroska files directly (Chromium can, Firefox can't). */
  allowMkvDirectPlay: boolean
  /** Always transcode (debugging / weak clients). */
  forceTranscode: boolean
}

export const DEFAULT_DEVICE_PLAYBACK: DevicePlaybackSettings = {
  maxBitrateMbps: 0,
  allowMkvDirectPlay: true,
  forceTranscode: false,
}
