import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { JellyfinIcon } from './JellyfinIcon'
import { PageScrollbar } from './PageScrollbar'
import { PageScrollbarContext } from './pageScrollbarContext'

type Props = {
  /** Left part of the header (navigation). */
  nav: ReactNode
  /** Right part of the header (search, profile menu). */
  actions?: ReactNode
  children: ReactNode
}

export function Layout({ nav, actions, children }: Props) {
  // Pages with their own rail (library A–Z) replace the page scrollbar while they're mounted.
  const [replaced, setReplaced] = useState(0)
  const [change] = useState(() => (delta: 1 | -1) => setReplaced((n) => n + delta))
  // The native scrollbar stays hidden; PageScrollbar or a page's own rail takes its place.
  useEffect(() => {
    const root = document.documentElement.style
    root.scrollbarWidth = 'none'
    return () => {
      root.scrollbarWidth = ''
    }
  }, [])
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-neutral-800 bg-neutral-950/80 px-4 backdrop-blur sm:px-6 lg:px-10">
        <Link to="/" className="mr-2 flex shrink-0 items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-accent-400" title="Home">
          <JellyfinIcon className="size-6" />
          <span className="bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] bg-clip-text text-sm font-semibold text-transparent">Jellyfin</span>
        </Link>
        {nav}
        <div className="ml-auto flex shrink-0 items-center gap-2 self-stretch">{actions}</div>
      </header>
      {/* Right padding keeps cards clear of the 20 px scrollbar rail on narrow screens. */}
      <main className="flex-1 px-4 py-4 max-sm:pr-7 sm:px-6 lg:px-10">
        <PageScrollbarContext value={change}>{children}</PageScrollbarContext>
      </main>
      {replaced === 0 && <PageScrollbar />}
    </div>
  )
}
