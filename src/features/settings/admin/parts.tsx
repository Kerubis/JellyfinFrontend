import type { ReactNode } from 'react'

/** Section heading used across the settings pages. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">{children}</h2>
      {action}
    </div>
  )
}

/** Thin bar for progress / disk usage, 0–1. */
export function Meter({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'warn' }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded bg-white/10" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className={`block h-full ${tone === 'warn' ? 'bg-amber-400' : 'bg-accent-500'}`} style={{ width: `${pct}%` }} />
    </span>
  )
}


/** Two independent columns on wide screens (each a stack of sections), one column below xl. */
export function TwoColumns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid items-start gap-8 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-8">{left}</div>
      <div className="flex min-w-0 flex-col gap-8">{right}</div>
    </div>
  )
}
