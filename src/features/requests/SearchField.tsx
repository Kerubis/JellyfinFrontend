import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNameSearch } from '@/api/seerr'
import { formatToken, parseQuery, replaceRange, tokenAt, type QueryToken, type TokenKind } from '@/domain/searchQuery'
import type { SeerrMatch } from '@/domain/seerr'
import { useFavoriteKeywords } from './useFavoriteKeywords'

const OPTIONS_SHOWN = 8
/** For plain words: a few of each kind, people first. */
const MIXED_SHOWN: Record<TokenKind, number> = { person: 4, keyword: 5, studio: 3 }
const KINDS: readonly TokenKind[] = ['person', 'keyword', 'studio']
const GROUP_LABEL: Record<TokenKind, string> = { person: 'People', keyword: 'Keywords', studio: 'Studios' }

type Option = { kind: TokenKind; match: SeerrMatch }

/**
 * What the dropdown completes: the token at the caret, or the run of plain words around it (`tom holland` can
 * become `@Tom_Holland`).
 */
function activeAt(tokens: readonly QueryToken[], caret: number): { kind: TokenKind | 'text'; name: string; start: number; end: number } | undefined {
  const at = tokenAt(tokens, caret)
  if (!at) return undefined
  if (at.kind !== 'text') return at
  let first = tokens.indexOf(at)
  let last = first
  while (tokens[first - 1]?.kind === 'text') first--
  while (tokens[last + 1]?.kind === 'text') last++
  const run = tokens.slice(first, last + 1)
  return { kind: 'text', name: run.map((t) => t.name).join(' '), start: run[0]?.start ?? at.start, end: run.at(-1)?.end ?? at.end }
}

/** Shared by the input and the mirror behind it, so the coloured text lines up with the caret. */
const BOX = 'rounded border px-2 py-1 text-sm leading-5'

const KIND_TEXT: Record<TokenKind, string> = { keyword: 'text-sky-300', person: 'text-amber-300', studio: 'text-emerald-300' }
const KIND_LABEL: Record<TokenKind, string> = { keyword: 'keyword', person: 'person', studio: 'studio' }

export type FieldProblem = { mark: 'ignored' | 'missing'; message: string }

/**
 * The request page's search field: plain words, `#keyword`, `@person`, `$studio` (PLAN.md M20). A transparent
 * input over a mirror that colours the tokens and shows ignored / unknown ones in red. The dropdown completes the
 * token at the caret, or offers people / keywords / studios for the plain words there (nothing preselected, so
 * Enter still searches titles); ↑↓, Enter / Tab, Escape.
 */
export function SearchField({
  text,
  onText,
  onCommit,
  problems,
}: {
  text: string
  /** Every keystroke. */
  onText: (text: string) => void
  /** Search right away (Enter, a picked completion). */
  onCommit: (text: string) => void
  /** By token start. The token being typed is never marked. */
  problems: ReadonlyMap<number, FieldProblem>
}) {
  const input = useRef<HTMLInputElement>(null)
  const mirror = useRef<HTMLDivElement>(null)
  const [caret, setCaret] = useState(text.length)
  const [focused, setFocused] = useState(true)
  const [highlight, setHighlight] = useState({ key: '', index: 0 })
  const [dismissed, setDismissed] = useState('')

  const tokens = parseQuery(text)
  const atCaret = focused ? tokenAt(tokens, caret) : undefined
  const active = focused ? activeAt(tokens, caret) : undefined
  const activeKey = active ? `${active.start}:${active.kind}:${active.name}` : ''
  const mixed = active?.kind === 'text'
  // One search per kind; only the token's own kind (or all three for plain words) is switched on.
  const queryFor = (kind: TokenKind) => (active && (mixed || active.kind === kind) ? active.name : '')
  const people = useNameSearch('person', queryFor('person')).data
  const keywords = useNameSearch('keyword', queryFor('keyword')).data
  const studios = useNameSearch('studio', queryFor('studio')).data
  // Starred keywords first (also when TMDB's first page misses them); a bare `#` lists them all.
  const favorites = useFavoriteKeywords()
  const favoriteMatches = active && (mixed || active.kind === 'keyword') ? favorites.matching(active.name) : []
  const found: Record<TokenKind, SeerrMatch[]> = {
    person: people ?? [],
    keyword: [...favoriteMatches, ...(keywords ?? []).filter((k) => !favorites.isFavorite(k.id))],
    studio: studios ?? [],
  }
  const options: Option[] = !active
    ? []
    : mixed
      ? KINDS.flatMap((kind) => found[kind].slice(0, MIXED_SHOWN[kind]).map((match) => ({ kind, match })))
      : found[active.kind as TokenKind].slice(0, OPTIONS_SHOWN).map((match) => ({ kind: active.kind as TokenKind, match }))
  const open = options.length > 0 && dismissed !== activeKey
  // Plain words start with nothing highlighted (-1): Enter searches titles.
  const index = highlight.key === activeKey ? Math.min(highlight.index, options.length - 1) : mixed ? -1 : 0

  // Keep the mirror scrolled like the input (long queries scroll sideways).
  useLayoutEffect(() => {
    if (mirror.current && input.current) mirror.current.scrollLeft = input.current.scrollLeft
  })

  const pick = (option: Option) => {
    if (!active) return
    const next = replaceRange(text, active.start, active.end, formatToken(option.kind, option.match.name))
    onText(next.text)
    onCommit(next.text)
    setCaret(next.caret)
    requestAnimationFrame(() => input.current?.setSelectionRange(next.caret, next.caret))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      // From "nothing highlighted", ↓ goes to the first option and ↑ to the last.
      const from = index === -1 && step === -1 ? options.length : index
      setHighlight({ key: activeKey, index: (from + step + options.length) % options.length })
    } else if (open && index >= 0 && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault()
      const option = options[index]
      if (option) pick(option)
    } else if (open && e.key === 'Escape') {
      setDismissed(activeKey)
    } else if (e.key === 'Enter') {
      onCommit(text)
    }
  }

  const shownProblems = tokens.flatMap((t) => {
    const problem = problems.get(t.start)
    return problem && t !== atCaret ? [{ token: t, problem }] : []
  })

  return (
    <div className="flex w-full flex-col gap-1 sm:w-[32rem]">
      <div className="relative rounded bg-neutral-900">
        <div ref={mirror} aria-hidden className={`${BOX} pointer-events-none absolute inset-0 overflow-hidden border-transparent whitespace-pre text-neutral-100`}>
          {segments(text, tokens, (t) => {
            const problem = t !== atCaret ? problems.get(t.start) : undefined
            if (problem) return problem.mark === 'missing' ? 'text-red-400 underline decoration-wavy decoration-red-400/70' : 'text-red-400'
            return t.kind === 'text' ? undefined : KIND_TEXT[t.kind]
          })}
        </div>
        <input
          ref={input}
          type="text"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="request-search-options"
          aria-activedescendant={open && index >= 0 ? `request-search-option-${index}` : undefined}
          aria-label="Search titles, #keywords, @people and $studios to request"
          placeholder="Search titles, #keyword, @person, $studio"
          value={text}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            onText(e.target.value)
            setCaret(e.target.selectionStart ?? e.target.value.length)
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onScroll={(e) => mirror.current && (mirror.current.scrollLeft = e.currentTarget.scrollLeft)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          className={`${BOX} relative w-full border-neutral-600 bg-transparent text-transparent caret-neutral-100 placeholder:text-neutral-600 selection:bg-accent-600/40 focus:border-accent-500 focus:outline-none`}
        />
        {open && (
          <ul id="request-search-options" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded border border-neutral-600 bg-neutral-800 py-1 shadow-lg">
            {options.map((o, i) => (
              <li key={`${o.kind}-${o.match.id}`} role="presentation">
                {mixed && o.kind !== options[i - 1]?.kind && (
                  <div className="px-2 pt-1 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">{GROUP_LABEL[o.kind]}</div>
                )}
                <div
                  id={`request-search-option-${i}`}
                  role="option"
                  aria-selected={i === index}
                  // Keep the focus in the field.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(o)
                  }}
                  onMouseEnter={() => setHighlight({ key: activeKey, index: i })}
                  className={`flex cursor-pointer items-center gap-2 px-2 py-1 text-sm ${i === index ? 'bg-accent-700/50 text-white' : 'text-neutral-200'}`}
                >
                  {o.kind === 'person' &&
                    (o.match.photo ? <img src={o.match.photo} alt="" className="size-6 rounded-full object-cover" /> : <span className="size-6 rounded-full bg-neutral-700" />)}
                  <span className={KIND_TEXT[o.kind]}>{formatToken(o.kind, o.match.name)}</span>
                  {/* TMDB id (comes with the search): tells namesakes apart. */}
                  <span className="text-[11px] text-neutral-500 tabular-nums">{o.match.id}</span>
                  {o.match.detail && <span className="truncate text-xs text-neutral-500">{o.match.detail}</span>}
                  {o.kind === 'keyword' && (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={favorites.isFavorite(o.match.id) ? `Unstar #${o.match.name}` : `Star #${o.match.name}`}
                      title={favorites.isFavorite(o.match.id) ? 'Favorite: always listed first. Click to remove' : 'Add to favorites: always listed first'}
                      // Toggles without picking the option or leaving the field.
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        favorites.toggle(o.match)
                      }}
                      className={`ml-auto shrink-0 rounded px-1 text-base leading-none ${favorites.isFavorite(o.match.id) ? 'text-amber-300' : 'text-neutral-500 hover:text-amber-200'}`}
                    >
                      {favorites.isFavorite(o.match.id) ? '★' : '☆'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {shownProblems.length > 0 && (
        <ul className="flex flex-col text-xs text-red-400">
          {shownProblems.map(({ token, problem }) => (
            <li key={token.start}>
              {problem.mark === 'missing' ? (
                <>
                  No {KIND_LABEL[token.kind as TokenKind]} “{token.name}”
                </>
              ) : (
                <>
                  “{text.slice(token.start, token.end)}” ignored: {problem.message}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The field's text with each token wrapped in its colour (gaps kept as they are). */
function segments(text: string, tokens: readonly QueryToken[], colour: (t: QueryToken) => string | undefined) {
  const out = []
  let at = 0
  for (const t of tokens) {
    if (t.start > at) out.push(text.slice(at, t.start))
    out.push(
      <span key={t.start} className={colour(t)}>
        {text.slice(t.start, t.end)}
      </span>,
    )
    at = t.end
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}
