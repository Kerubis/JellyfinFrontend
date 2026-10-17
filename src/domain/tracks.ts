// Audio / subtitle track resolution (PLAN.md §3.4). Pure functions, so the rules are testable.
//
// Layers, first match wins: per-series memory (last manual choice) → per-library rule → profile
// rule → Jellyfin user settings → the file's default flags.

import { normalizeLanguage } from '@/lib/languages'

export type AudioStream = {
  index: number
  language?: string
  title?: string
  codec?: string
  channels?: number
  isDefault: boolean
}

export type SubtitleStream = {
  index: number
  language?: string
  title?: string
  codec?: string
  isForced: boolean
  isDefault: boolean
  /** Text formats (srt, ass, vtt, ...) are rendered by us; image formats (PGS, VobSub) are burned in. */
  isText: boolean
  isExternal: boolean
}

export type MediaTracks = {
  mediaSourceId: string
  audio: AudioStream[]
  subtitles: SubtitleStream[]
  defaultAudioIndex?: number
  defaultSubtitleIndex?: number
}

/**
 * - default: whatever the file marks as default
 * - off: no subtitles
 * - forced: only forced / "Signs & Songs" tracks
 * - always: full subtitles in a preferred language
 * - smart: like "always", but only "forced" when the audio is already in a subtitle language
 */
export type SubtitleMode = 'default' | 'off' | 'forced' | 'always' | 'smart'

export type LanguageRule = {
  /** Preferred audio languages, in order (ISO 639-2/T). */
  audio: string[]
  /** Preferred subtitle languages, in order. */
  subtitles: string[]
  subtitleMode: SubtitleMode
}

/** A layer may leave fields out to inherit them from the next layer. */
export type PartialRule = Partial<LanguageRule>

/** Last manual choice for a series, by language + title (indices differ between files). */
export type TrackMemory = {
  audio?: { language?: string; title?: string }
  subtitle?: { language?: string; title?: string; forced: boolean } | 'off'
}

export type TrackChoice = { audioIndex?: number; subtitleIndex: number | null }

const BUILT_IN: LanguageRule = { audio: [], subtitles: [], subtitleMode: 'default' }

/** Merges rule layers (highest priority first); empty language lists count as "not set". */
export function resolveRule(layers: readonly (PartialRule | undefined)[]): LanguageRule {
  const pick = <K extends keyof LanguageRule>(key: K): LanguageRule[K] => {
    for (const layer of layers) {
      const value = layer?.[key]
      if (value !== undefined && !(Array.isArray(value) && value.length === 0)) return value as LanguageRule[K]
    }
    return BUILT_IN[key]
  }
  return { audio: pick('audio'), subtitles: pick('subtitles'), subtitleMode: pick('subtitleMode') }
}

const lang = (s: { language?: string }) => normalizeLanguage(s.language)

const SIGNS = /\b(signs?|songs?|forced)\b/i
const FULL = /\b(full|dialog(ue)?)\b/i
const SDH = /\b(sdh|cc|hearing)\b/i

/** "Signs & Songs" / forced tracks only translate on-screen text and lyrics. */
export function isSignsTrack(s: SubtitleStream): boolean {
  return s.isForced || SIGNS.test(s.title ?? '')
}

/** The track a <video> plays when given the file directly (it can't switch audio tracks). */
export function browserDefaultAudio(tracks: MediaTracks): number | undefined {
  return (tracks.audio.find((a) => a.isDefault) ?? tracks.audio[0])?.index
}

function pickAudio(tracks: MediaTracks, rule: LanguageRule, memory: TrackMemory | undefined): AudioStream | undefined {
  const { audio } = tracks
  if (audio.length <= 1) return audio[0]
  const remembered = memory?.audio
  if (remembered?.language) {
    const same = audio.filter((a) => lang(a) === normalizeLanguage(remembered.language))
    const match = same.find((a) => a.title === remembered.title) ?? same[0]
    if (match) return match
  }
  for (const language of rule.audio) {
    const same = audio.filter((a) => lang(a) === language)
    const match = same.find((a) => a.isDefault) ?? same[0]
    if (match) return match
  }
  return audio.find((a) => a.index === tracks.defaultAudioIndex) ?? audio.find((a) => a.isDefault) ?? audio[0]
}

/** Best "full dialogue" track: titled Full/Dialogue first, Signs & Songs / SDH last, default flag as tiebreak. */
function bestFull(candidates: readonly SubtitleStream[]): SubtitleStream | undefined {
  const score = (s: SubtitleStream) =>
    (FULL.test(s.title ?? '') ? 4 : 0) + (isSignsTrack(s) ? -8 : 0) + (SDH.test(s.title ?? '') ? -1 : 0) + (s.isDefault ? 1 : 0)
  return [...candidates].sort((a, b) => score(b) - score(a))[0]
}

function pickSubtitle(
  tracks: MediaTracks,
  rule: LanguageRule,
  memory: TrackMemory | undefined,
  audioLanguage: string | undefined,
): SubtitleStream | null {
  const subs = tracks.subtitles
  if (subs.length === 0) return null

  const remembered = memory?.subtitle
  if (remembered === 'off') return null
  if (remembered?.language) {
    const same = subs.filter((s) => lang(s) === normalizeLanguage(remembered.language))
    const match =
      same.find((s) => s.title === remembered.title) ??
      (remembered.forced ? same.find(isSignsTrack) : bestFull(same.filter((s) => !isSignsTrack(s))))
    if (match) return match
  }

  const mode = rule.subtitleMode
  if (mode === 'off') return null
  if (mode === 'default') return subs.find((s) => s.index === tracks.defaultSubtitleIndex) ?? null

  // Languages to look in: the preferred subtitle languages, else the audio language.
  const languages = rule.subtitles.length > 0 ? rule.subtitles : audioLanguage ? [audioLanguage] : []
  const inLanguage = (language: string) => subs.filter((s) => lang(s) === language)
  const understoodAudio = !!audioLanguage && rule.subtitles.includes(audioLanguage)
  const forcedOnly = mode === 'forced' || (mode === 'smart' && understoodAudio)

  if (forcedOnly) {
    // Signs & Songs for the language being heard first, then the preferred languages.
    for (const language of [...new Set([...(audioLanguage ? [audioLanguage] : []), ...languages])]) {
      const match = inLanguage(language).find(isSignsTrack)
      if (match) return match
    }
    return null
  }

  // always / smart with foreign audio: full subtitles in the first preferred language that has them.
  for (const language of languages) {
    const match = bestFull(inLanguage(language).filter((s) => !isSignsTrack(s)))
    if (match) return match
  }
  for (const language of languages) {
    const match = inLanguage(language)[0]
    if (match) return match
  }
  return languages.length === 0 ? (bestFull(subs) ?? null) : null
}

export function chooseTracks(tracks: MediaTracks, rule: LanguageRule, memory?: TrackMemory): TrackChoice {
  const audio = pickAudio(tracks, rule, memory)
  const subtitle = pickSubtitle(tracks, rule, memory, audio ? lang(audio) : undefined)
  return { audioIndex: audio?.index, subtitleIndex: subtitle?.index ?? null }
}

/** What to remember when the user picks a track by hand. */
export function memoryFor(tracks: MediaTracks, choice: TrackChoice): TrackMemory {
  const audio = tracks.audio.find((a) => a.index === choice.audioIndex)
  const subtitle = tracks.subtitles.find((s) => s.index === choice.subtitleIndex)
  return {
    audio: audio ? { language: lang(audio), title: audio.title } : undefined,
    subtitle: subtitle ? { language: lang(subtitle), title: subtitle.title, forced: isSignsTrack(subtitle) } : 'off',
  }
}

/** Jellyfin user configuration → a rule layer. */
export function ruleFromJellyfin(config: {
  AudioLanguagePreference?: string | null
  SubtitleLanguagePreference?: string | null
  SubtitleMode?: string | null
}): PartialRule {
  const audio = normalizeLanguage(config.AudioLanguagePreference)
  const subtitle = normalizeLanguage(config.SubtitleLanguagePreference)
  const modes: Record<string, SubtitleMode> = {
    None: 'off',
    OnlyForced: 'forced',
    Always: 'always',
    Smart: 'smart',
    Default: 'default',
  }
  return {
    audio: audio ? [audio] : undefined,
    subtitles: subtitle ? [subtitle] : undefined,
    subtitleMode: config.SubtitleMode ? modes[config.SubtitleMode] : undefined,
  }
}

const JELLYFIN_SUBTITLE_MODES: Record<SubtitleMode, 'Default' | 'None' | 'OnlyForced' | 'Always' | 'Smart'> = {
  default: 'Default',
  off: 'None',
  forced: 'OnlyForced',
  always: 'Always',
  smart: 'Smart',
}

/** The Jellyfin user configuration fields that mirror the profile-wide language rule. */
export type JellyfinLanguageConfig = {
  AudioLanguagePreference?: string
  SubtitleLanguagePreference?: string
  SubtitleMode?: (typeof JELLYFIN_SUBTITLE_MODES)[SubtitleMode]
}

/**
 * What changed in the profile-wide rule, as Jellyfin user configuration (D32 write-through). Jellyfin keeps
 * one language per kind, so the first one is written; a cleared field clears it there too.
 */
export function jellyfinLanguagePatch(previous: PartialRule, next: PartialRule): JellyfinLanguageConfig {
  const patch: JellyfinLanguageConfig = {}
  if (previous.audio?.[0] !== next.audio?.[0]) patch.AudioLanguagePreference = next.audio?.[0] ?? ''
  if (previous.subtitles?.[0] !== next.subtitles?.[0]) patch.SubtitleLanguagePreference = next.subtitles?.[0] ?? ''
  if (previous.subtitleMode !== next.subtitleMode) patch.SubtitleMode = JELLYFIN_SUBTITLE_MODES[next.subtitleMode ?? 'default']
  return patch
}
