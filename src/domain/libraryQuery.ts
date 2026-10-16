// Library grid filters, kept in the URL (?sort=added&watched=unwatched&genre=Comedy) so back/forward
// and links keep the browsing context.

export type LibraryQuery = {
  sort: 'name' | 'added' | 'year' | 'rating' | 'played'
  order: 'asc' | 'desc'
  watched: 'all' | 'unwatched' | 'watched'
  genre?: string
  year?: number
}

const SORTS: readonly LibraryQuery['sort'][] = ['name', 'added', 'year', 'rating', 'played']
const WATCHED: readonly LibraryQuery['watched'][] = ['all', 'unwatched', 'watched']

/** Natural direction per sort: A→Z, newest / best / most recent first. */
export const DEFAULT_ORDER: Record<LibraryQuery['sort'], LibraryQuery['order']> = {
  name: 'asc',
  added: 'desc',
  year: 'desc',
  rating: 'desc',
  played: 'desc',
}

export function parseLibraryQuery(params: URLSearchParams): LibraryQuery {
  const sort = SORTS.find((s) => s === params.get('sort')) ?? 'name'
  const order = params.get('order') === 'asc' ? 'asc' : params.get('order') === 'desc' ? 'desc' : DEFAULT_ORDER[sort]
  const year = Number(params.get('year'))
  return {
    sort,
    order,
    watched: WATCHED.find((w) => w === params.get('watched')) ?? 'all',
    genre: params.get('genre') || undefined,
    year: Number.isInteger(year) && year > 0 ? year : undefined,
  }
}

export function libraryQueryParams(query: LibraryQuery): Record<string, string> {
  const params: Record<string, string> = {}
  if (query.sort !== 'name') params.sort = query.sort
  if (query.order !== DEFAULT_ORDER[query.sort]) params.order = query.order
  if (query.watched !== 'all') params.watched = query.watched
  if (query.genre) params.genre = query.genre
  if (query.year) params.year = String(query.year)
  return params
}

/** Letters of the A–Z jump bar; '#' collects digits, symbols and non-Latin titles. */
export const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] as const

/** Jump-bar bucket of a sort name ("Ébène" → "E", "86" → "#"). */
export function letterOf(sortName: string): string {
  const first = sortName.normalize('NFD').charAt(0).toUpperCase()
  return first >= 'A' && first <= 'Z' ? first : '#'
}

