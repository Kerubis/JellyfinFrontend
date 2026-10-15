import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

const NAV = [{ to: '/', label: 'Home' }]

export function Layout({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 flex h-11 items-center gap-1 border-b border-neutral-800 bg-neutral-950/90 px-3 backdrop-blur">
        <span className="mr-3 text-sm font-semibold text-accent-300">Jellyfin</span>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `rounded px-2 py-1 text-sm ${isActive ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-100'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <div className="ml-auto">{actions}</div>
      </header>
      <main className="flex-1 p-3">{children}</main>
    </div>
  )
}
