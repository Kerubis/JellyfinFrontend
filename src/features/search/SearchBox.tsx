import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

const DEBOUNCE_MS = 300

/** Header search: typing (debounced) shows results on /search; leaving the page keeps the term out of the way. */
export function SearchBox() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const onSearchPage = pathname === '/search'
  const urlTerm = onSearchPage ? (params.get('q') ?? '') : ''
  const [text, setText] = useState(urlTerm)
  const timer = useRef<number | undefined>(undefined)
  const input = useRef<HTMLInputElement>(null)

  // Keep the box in sync when navigating (back/forward to a search, or away from it).
  const [lastUrlTerm, setLastUrlTerm] = useState(urlTerm)
  if (urlTerm !== lastUrlTerm) {
    setLastUrlTerm(urlTerm)
    setText(urlTerm)
  }

  const go = (term: string) => {
    const q = term.trim()
    if (!q && !onSearchPage) return
    // Replace while refining on the search page, so "back" returns to where the search started.
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { replace: onSearchPage })
  }

  // "/" focuses the search box (unless typing somewhere else).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (e.key !== '/' || target?.closest('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <input
      ref={input}
      type="search"
      value={text}
      placeholder="Search  /"
      aria-label="Search"
      onChange={(e) => {
        const value = e.target.value
        setText(value)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => go(value), DEBOUNCE_MS)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          window.clearTimeout(timer.current)
          go(text)
        }
        if (e.key === 'Escape') input.current?.blur()
      }}
      className="w-40 rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm placeholder:text-neutral-600 focus:w-64 focus:border-accent-500 focus:outline-none sm:w-56"
    />
  )
}
