// Profile preferences, synced through Jellyfin (see PLAN.md §3.1).
// Each key is stored separately as a versioned JSON envelope, so a write only touches what changed.
// To add a key: add its type to PrefsSchema and a definition to PREF_DEFS. Bump `version` and add
// a `migrate` step only when an existing field changes meaning; new fields just get a default.

import { DEFAULT_SECTIONS, normalizeSections, type DashboardSection } from './dashboard'
import { DEFAULT_SAFETY, HHMM, type SafetyPrefs, type SafetyUsage } from './safety'
import type { PartialRule, SubtitleMode, TrackMemory } from './tracks'
import { normalizeLanguage } from '@/lib/languages'
import type { TimeFormat } from '@/lib/time'

export type SkipMode = 'auto' | 'button' | 'off'

export type PlaybackPrefs = {
  autoplayNext: boolean
  autoplayCountdownSeconds: number
  /** Ask "Still watching?" after this many autoplayed episodes without input. 0 = never. */
  stillWatchingAfterEpisodes: number
  skipIntro: SkipMode
  skipOutro: SkipMode
  resume: 'always' | 'ask' | 'startOver'
  playbackRate: number
  /** Seconds for the skip buttons / arrow keys. */
  skipBack: number
  skipForward: number
  /** Per-library skip times by library id; missing values use the ones above. */
  librarySkip: Record<string, { back?: number; forward?: number }>
}

export const SKIP_LIMITS = { min: 1, max: 300 } as const

/** Skip times for an item's library (library override → profile setting). */
export function skipSeconds(playback: PlaybackPrefs, libraryId: string | undefined): { back: number; forward: number } {
  const library = libraryId ? playback.librarySkip[libraryId] : undefined
  return { back: library?.back ?? playback.skipBack, forward: library?.forward ?? playback.skipForward }
}

export type CardSize = 'xs' | 'sm' | 'md'

export type UiPrefs = {
  cardSize: CardSize
  /** Show thumbnails and descriptions of unwatched episodes. */
  showSpoilers: boolean
  /** Text colour of the header links by NAV_HOME or library id (#rrggbb); missing = default grey/white. */
  navColors: Record<string, string>
  /** Clock times: follow the browser's language, or always 24 / 12 hours. */
  timeFormat: TimeFormat
}

/** navColors key of the "Home" link. */
export const NAV_HOME = 'home'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const clamp = (n: number, min: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min)

const SUBTITLE_MODES: readonly SubtitleMode[] = ['default', 'off', 'forced', 'always', 'smart']

function normalizeRule(value: unknown): PartialRule {
  if (!isRecord(value)) return {}
  const languages = (list: unknown) =>
    Array.isArray(list) ? list.flatMap((c) => (typeof c === 'string' ? (normalizeLanguage(c) ?? []) : [])) : undefined
  const mode = SUBTITLE_MODES.find((m) => m === value.subtitleMode)
  return {
    ...(languages(value.audio)?.length ? { audio: languages(value.audio) } : {}),
    ...(languages(value.subtitles)?.length ? { subtitles: languages(value.subtitles) } : {}),
    ...(mode ? { subtitleMode: mode } : {}),
  }
}

export type HiddenEntry = {
  /** Series id or movie id. */
  id: string
  /** ISO timestamp of when it was hidden; playing it after this unhides it. */
  at: string
}

/** What was removed from Currently Watching (PLAN.md §3.9): only the exceptions are stored, the sections are derived. */
export type WatchingPrefs = {
  /** Removed shows / movies; a show then sits in New Episodes (or Not watched), a movie in Not watched. */
  hidden: HiddenEntry[]
}

function isHiddenEntry(value: unknown): value is HiddenEntry {
  return isRecord(value) && typeof value.id === 'string' && typeof value.at === 'string'
}

export type DashboardPrefs = {
  sections: DashboardSection[]
  /** Section ids hidden on one device only; only ever set through the device-override layer. */
  deviceHidden: string[]
}

export type SubtitlePrefs = {
  /** Font size of text subtitles in the full player, in px (the mini player scales it down). */
  fontSize: number
  /** Opacity of the box behind each line, 0 = no box (text shadow only). */
  background: number
  /** Distance from the bottom edge in % of the player height (while the controls are hidden). */
  position: number
}

export type LanguagePrefs = {
  /** Profile-wide rule; empty fields fall back to Jellyfin's user settings. */
  global: PartialRule
  /** Per-library rules by library id; empty fields fall back to the global rule. */
  libraries: Record<string, PartialRule>
}

export type SeriesTrackPrefs = {
  /** Last manual audio/subtitle choice per series id. */
  entries: Record<string, TrackMemory & { at: string }>
}

export type PrefsSchema = {
  playback: PlaybackPrefs
  ui: UiPrefs
  watching: WatchingPrefs
  dashboard: DashboardPrefs
  subtitles: SubtitlePrefs
  languages: LanguagePrefs
  seriesTracks: SeriesTrackPrefs
  /** Soft limits; written by an admin into the (kid's) own prefs. */
  safety: SafetyPrefs
  /** Watch time counted today (written by the profile's own player). */
  safetyUsage: SafetyUsage
}

export type PrefKey = keyof PrefsSchema

/** Preferences that may differ per screen, stored only on this device. */
export type DeviceOverrides = { [K in PrefKey]?: Partial<PrefsSchema[K]> }

type PrefDef<T> = {
  version: number
  defaults: T
  /** Upgrades data written by an older version, before it is checked against the defaults. */
  migrate?: (data: Record<string, unknown>, fromVersion: number) => Record<string, unknown>
  /** Deep validation for nested data the generic field check can't cover. */
  normalize?: (value: T) => T
}

export const PREF_DEFS: { [K in PrefKey]: PrefDef<PrefsSchema[K]> } = {
  playback: {
    version: 1,
    defaults: {
      autoplayNext: true,
      autoplayCountdownSeconds: 10,
      stillWatchingAfterEpisodes: 3,
      skipIntro: 'button',
      skipOutro: 'button',
      resume: 'always',
      playbackRate: 1,
      skipBack: 5,
      skipForward: 5,
      librarySkip: {},
    },
    normalize: (v) => {
      const seconds = (n: unknown) =>
        typeof n === 'number' && Number.isFinite(n) ? clamp(Math.round(n), SKIP_LIMITS.min, SKIP_LIMITS.max) : undefined
      const librarySkip: PlaybackPrefs['librarySkip'] = {}
      for (const [id, value] of Object.entries(isRecord(v.librarySkip) ? v.librarySkip : {})) {
        if (!isRecord(value)) continue
        const back = seconds(value.back)
        const forward = seconds(value.forward)
        if (back !== undefined || forward !== undefined) librarySkip[id] = { back, forward }
      }
      return { ...v, skipBack: seconds(v.skipBack) ?? 5, skipForward: seconds(v.skipForward) ?? 5, librarySkip }
    },
  },
  ui: {
    version: 1,
    defaults: { cardSize: 'sm', showSpoilers: false, navColors: {}, timeFormat: 'auto' },
    normalize: (v) => ({
      ...v,
      timeFormat: v.timeFormat === '24' || v.timeFormat === '12' ? v.timeFormat : 'auto',
      navColors: Object.fromEntries(
        Object.entries(isRecord(v.navColors) ? v.navColors : {}).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string' && HEX_COLOR.test(entry[1]),
        ),
      ),
    }),
  },
  // Stored as `following` until 2026-10-17 (together with the removed Follow list); decodeAllPrefs carries it over.
  watching: {
    version: 2,
    defaults: { hidden: [] },
    // v1 stored hidden as plain ids; give them a "hidden now" timestamp.
    migrate: (data, from) =>
      from < 2 && Array.isArray(data.hidden)
        ? {
            ...data,
            hidden: data.hidden.map((id: unknown) => (typeof id === 'string' ? { id, at: new Date().toISOString() } : id)),
          }
        : data,
    normalize: (v) => ({ hidden: (v.hidden as unknown[]).filter(isHiddenEntry) }),
  },
  subtitles: {
    version: 1,
    defaults: { fontSize: 28, background: 0.65, position: 6 },
    normalize: (v) => ({
      fontSize: clamp(Math.round(v.fontSize), 12, 72),
      background: clamp(v.background, 0, 1),
      position: clamp(v.position, 0, 40),
    }),
  },
  languages: {
    version: 1,
    defaults: { global: {}, libraries: {} },
    normalize: (v) => ({
      global: normalizeRule(v.global),
      libraries: Object.fromEntries(
        Object.entries(isRecord(v.libraries) ? v.libraries : {}).map(([id, rule]) => [id, normalizeRule(rule)]),
      ),
    }),
  },
  safety: {
    version: 1,
    defaults: DEFAULT_SAFETY,
    normalize: (v) => ({
      kidMode: v.kidMode,
      dailyMinutes: clamp(Math.round(v.dailyMinutes), 0, 24 * 60),
      bedtime: {
        enabled: isRecord(v.bedtime) && v.bedtime.enabled === true,
        start: isRecord(v.bedtime) && typeof v.bedtime.start === 'string' && HHMM.test(v.bedtime.start) ? v.bedtime.start : DEFAULT_SAFETY.bedtime.start,
        end: isRecord(v.bedtime) && typeof v.bedtime.end === 'string' && HHMM.test(v.bedtime.end) ? v.bedtime.end : DEFAULT_SAFETY.bedtime.end,
      },
      showHome: v.showHome !== false,
      extra: {
        date: isRecord(v.extra) && typeof v.extra.date === 'string' ? v.extra.date : '',
        minutes: isRecord(v.extra) && typeof v.extra.minutes === 'number' ? clamp(Math.round(v.extra.minutes), 0, 24 * 60) : 0,
      },
    }),
  },
  safetyUsage: {
    version: 1,
    defaults: { date: '', seconds: 0 },
    normalize: (v) => ({ date: v.date, seconds: clamp(Math.round(v.seconds), 0, 24 * 3600) }),
  },
  seriesTracks: {
    version: 1,
    defaults: { entries: {} },
    normalize: (v) => ({ entries: isRecord(v.entries) ? (v.entries as SeriesTrackPrefs['entries']) : {} }),
  },
  dashboard: {
    version: 2,
    defaults: { sections: DEFAULT_SECTIONS, deviceHidden: [] },
    // v2 (M18): saved layouts get the new "Not watched" section once (removed section types drop out in normalize).
    migrate: (data, from) =>
      from < 2 && Array.isArray(data.sections) && !data.sections.some((s: unknown) => isRecord(s) && s.type === 'notWatched')
        ? { ...data, sections: [...data.sections, { id: 'not-watched', type: 'notWatched', visible: true, options: {} }] }
        : data,
    normalize: (v) => ({
      sections: normalizeSections(v.sections),
      deviceHidden: v.deviceHidden.filter((id) => typeof id === 'string'),
    }),
  },
}

export const PREF_KEYS = Object.keys(PREF_DEFS) as PrefKey[]

export type PrefsValues = { [K in PrefKey]: PrefsSchema[K] }

export function defaultPrefs(): PrefsValues {
  return Object.fromEntries(PREF_KEYS.map((key) => [key, PREF_DEFS[key].defaults])) as PrefsValues
}

type Envelope = { v: number; updatedAt: string; data: unknown }


/** Keeps only known fields whose type matches the default; everything else falls back. */
function sanitize<T extends Record<string, unknown>>(defaults: T, data: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...defaults }
  for (const [field, fallback] of Object.entries(defaults)) {
    const value = data[field]
    const matches = Array.isArray(fallback) ? Array.isArray(value) : value !== null && typeof value === typeof fallback
    if (matches) out[field] = value
  }
  return out as T
}

export function decodePref<K extends PrefKey>(key: K, raw: string | null | undefined): PrefsSchema[K] {
  const def = PREF_DEFS[key]
  if (!raw) return def.defaults
  try {
    const envelope = JSON.parse(raw) as Partial<Envelope>
    if (typeof envelope.v !== 'number' || !isRecord(envelope.data)) return def.defaults
    const data = envelope.v < def.version && def.migrate ? def.migrate(envelope.data, envelope.v) : envelope.data
    const value = sanitize(def.defaults, data)
    return def.normalize ? def.normalize(value) : value
  } catch {
    return def.defaults
  }
}

export function encodePref(key: PrefKey, value: unknown): string {
  const envelope: Envelope = { v: PREF_DEFS[key].version, updatedAt: new Date().toISOString(), data: value }
  return JSON.stringify(envelope)
}

/** Keys that were renamed: until the new key is written, its value is read from the old one. */
const RENAMED_FROM: Partial<Record<PrefKey, string>> = { watching: 'following' }

export function decodeAllPrefs(raw: Record<string, string | null | undefined>): PrefsValues {
  return Object.fromEntries(
    PREF_KEYS.map((key) => {
      const old = RENAMED_FROM[key]
      return [key, decodePref(key, raw[key] ?? (old ? raw[old] : undefined))]
    }),
  ) as PrefsValues
}
