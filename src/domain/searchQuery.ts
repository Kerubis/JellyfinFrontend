// The request page's search syntax: plain words search titles; `#keyword`, `@person` and `$studio` are tokens.
// Tokens end at a space, so spaces inside a name are written as `_` (`@Tom_Holland`); quotes work too
// (`@"Tom Holland"`). See PLAN.md M20.

export type TokenKind = 'keyword' | 'person' | 'studio'

export const SIGIL: Record<TokenKind, string> = { keyword: '#', person: '@', studio: '$' }
const KIND_OF: Record<string, TokenKind | undefined> = { '#': 'keyword', '@': 'person', $: 'studio' }

export type QueryToken = {
  kind: TokenKind | 'text'
  /** Tokens: the name with spaces (`_` and quotes undone); text: the word. */
  name: string
  /** Position in the field, end exclusive. */
  start: number
  end: number
}

const SPACE = /\s/

export function parseQuery(text: string): QueryToken[] {
  const tokens: QueryToken[] = []
  let i = 0
  while (i < text.length) {
    if (SPACE.test(text[i] ?? '')) {
      i++
      continue
    }
    const start = i
    const kind = KIND_OF[text[i] ?? ''] ?? 'text'
    if (kind !== 'text') i++
    let raw: string
    if (kind !== 'text' && text[i] === '"') {
      // Quoted: up to the closing quote (or the end while it's being typed).
      const close = text.indexOf('"', i + 1)
      raw = text.slice(i + 1, close === -1 ? text.length : close)
      i = close === -1 ? text.length : close + 1
    } else {
      const from = i
      while (i < text.length && !SPACE.test(text[i] ?? '')) i++
      raw = text.slice(from, i)
    }
    tokens.push({ kind, name: kind === 'text' ? raw : raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim(), start, end: i })
  }
  return tokens
}

/** `#time_travel` for keyword "time travel". */
export const formatToken = (kind: TokenKind, name: string) => SIGIL[kind] + name.trim().replace(/\s+/g, '_')

/** The token the caret is in or right behind. */
export const tokenAt = (tokens: readonly QueryToken[], caret: number) => tokens.find((t) => caret >= t.start && caret <= t.end)

/** Replaces [start, end) with `insert` plus a space (unless one follows); the caret goes after it. */
export function replaceRange(text: string, start: number, end: number, insert: string): { text: string; caret: number } {
  const rest = text.slice(end)
  const spaced = rest.startsWith(' ') ? insert : `${insert} `
  return { text: text.slice(0, start) + spaced + rest, caret: start + insert.length + 1 }
}

/** Names compare without case and with spaces collapsed. */
export const sameName = (a: string, b: string) => a.toLowerCase().replace(/\s+/g, ' ').trim() === b.toLowerCase().replace(/\s+/g, ' ').trim()

/** The title-search part: the plain words. */
export const textOf = (tokens: readonly QueryToken[]) =>
  tokens
    .filter((t) => t.kind === 'text')
    .map((t) => t.name)
    .join(' ')

/**
 * What the request page shows for a query, and the tokens it has to ignore (Seerr can't combine them):
 * - people: their titles (several: the ones they share), filtered by the plain words; keywords / studios ignored
 * - discover: titles with all keywords (and one studio, or the network); plain words ignored
 * - titles: a title search; requests: the profile's own requests
 */
export type QueryMode = 'requests' | 'titles' | 'people' | 'discover'
export type IgnoreReason = 'withPeople' | 'textWithFilters' | 'oneStudio'

export const IGNORE_MESSAGE: Record<IgnoreReason, string> = {
  withPeople: "can't be combined with @people",
  textWithFilters: "title words can't be combined with #keywords or $studios",
  oneStudio: 'only one $studio at a time',
}

export function planQuery(all: readonly QueryToken[], hasNetwork: boolean): { mode: QueryMode; ignored: Map<QueryToken, IgnoreReason> } {
  const ignored = new Map<QueryToken, IgnoreReason>()
  // A bare sigil (being typed) is nothing yet.
  const tokens = all.filter((t) => t.kind === 'text' || t.name)
  const text = textOf(tokens)
  if (tokens.some((t) => t.kind === 'person')) {
    for (const t of tokens) if (t.kind === 'keyword' || t.kind === 'studio') ignored.set(t, 'withPeople')
    return { mode: 'people', ignored }
  }
  if (hasNetwork || tokens.some((t) => t.kind === 'keyword' || t.kind === 'studio')) {
    for (const t of tokens) if (t.kind === 'text') ignored.set(t, 'textWithFilters')
    for (const t of tokens.filter((x) => x.kind === 'studio').slice(1)) ignored.set(t, 'oneStudio')
    return { mode: 'discover', ignored }
  }
  return { mode: text.length >= 2 ? 'titles' : 'requests', ignored }
}
