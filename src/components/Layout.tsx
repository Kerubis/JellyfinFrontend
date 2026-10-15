import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { JellyfinIcon } from './JellyfinIcon'

type Props = {
  /** Left part of the header (navigation). */
  nav: ReactNode
  /** Right part of the header (search, profile menu). */
  actions?: ReactNode
  children: ReactNode
}

export function Layout({ nav, actions, children }: Props) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-neutral-800 bg-neutral-950/80 px-4 backdrop-blur sm:px-6 lg:px-10">
        <Link to="/" className="mr-2 flex shrink-0 items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-accent-400" title="Home">
          <JellyfinIcon className="size-6" />
          <span className="bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] bg-clip-text text-sm font-semibold text-transparent">Jellyfin</span>
        </Link>
        {nav}
        <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
      </header>
      <main className="flex-1 px-4 py-4 sm:px-6 lg:px-10">{children}</main>
    </div>
  )
}
