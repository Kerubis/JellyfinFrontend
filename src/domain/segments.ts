// Intro / recap / outro / preview segments: from Jellyfin's MediaSegments API when a provider
// plugin fills it, otherwise derived from chapter names (common in anime releases: "OP", "ED").

export type SegmentType = 'intro' | 'recap' | 'outro' | 'preview'

export type Segment = {
  type: SegmentType
  /** Seconds. */
  start: number
  end: number
  source: 'server' | 'chapters'
}

export type Chapter = { name: string; start: number }

const SERVER_TYPES: Record<string, SegmentType> = { Intro: 'intro', Recap: 'recap', Outro: 'outro', Preview: 'preview' }

export function fromServerSegments(items: readonly { Type?: string; StartTicks?: number; EndTicks?: number }[]): Segment[] {
  return items.flatMap((s) => {
    const type = s.Type ? SERVER_TYPES[s.Type] : undefined
    if (!type || s.StartTicks === undefined || s.EndTicks === undefined) return []
    return [{ type, start: s.StartTicks / 10_000_000, end: s.EndTicks / 10_000_000, source: 'server' as const }]
  })
}

// "Intro", "Prologue", "Avant" are the cold open before the opening, not the opening itself.
const CHAPTER_TYPES: [RegExp, SegmentType][] = [
  [/^(op|opening|opening (song|theme|credits)|op ?\d+|theme song)$/i, 'intro'],
  [/^(ed|ending|ending (song|theme|credits)|ed ?\d+|credits|end credits)$/i, 'outro'],
  [/^(recap|previously( on.*)?)$/i, 'recap'],
  [/^(preview|next episode( preview)?|next time|yokoku)$/i, 'preview'],
]

/** Plausible lengths, so a mislabelled chapter doesn't skip half an episode. */
const MAX_LENGTH: Record<SegmentType, number> = { intro: 200, recap: 240, outro: 300, preview: 120 }
const MIN_LENGTH = 5

export function fromChapters(chapters: readonly Chapter[], duration: number): Segment[] {
  const sorted = [...chapters].sort((a, b) => a.start - b.start)
  return sorted.flatMap((chapter, i) => {
    const type = CHAPTER_TYPES.find(([pattern]) => pattern.test(chapter.name.trim()))?.[1]
    if (!type) return []
    const end = sorted[i + 1]?.start ?? duration
    const length = end - chapter.start
    if (!(length >= MIN_LENGTH && length <= MAX_LENGTH[type])) return []
    return [{ type, start: chapter.start, end, source: 'chapters' as const }]
  })
}

export function segmentAt(segments: readonly Segment[], time: number): Segment | undefined {
  // A small margin at the end, so a seek to `end` doesn't land back inside the segment.
  return segments.find((s) => time >= s.start && time < s.end - 0.5)
}

/**
 * When "Up next" appears: at the outro if only the outro (and maybe a preview) is left after it,
 * otherwise `countdown` seconds before the end, so post-credit scenes aren't cut off.
 */
export function upNextTime(segments: readonly Segment[], duration: number, countdown: number): number {
  const fallback = Math.max(0, duration - Math.max(countdown, 5))
  const outro = segments.find((s) => s.type === 'outro')
  if (!outro) return fallback
  let tail = outro.end
  const preview = segments.find((s) => s.type === 'preview' && Math.abs(s.start - tail) <= 2)
  if (preview) tail = preview.end
  return tail >= duration - 5 ? Math.min(outro.start, fallback) : fallback
}

export const SEGMENT_LABEL: Record<SegmentType, string> = {
  intro: 'Skip intro',
  recap: 'Skip recap',
  outro: 'Skip credits',
  preview: 'Skip preview',
}
