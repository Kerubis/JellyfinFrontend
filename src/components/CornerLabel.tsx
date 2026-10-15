import type { ReactNode } from 'react'
import { CORNER, type Corner } from './corners'

function CornerLabel({ corner, title, children }: { corner: Corner; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className={`absolute ${CORNER[corner]} min-w-9 bg-accent-600 px-2 py-1 text-center text-sm leading-tight font-bold text-white shadow`}
    >
      {children}
    </span>
  )
}

/** Unwatched episode count, top-left. */
export function CountLabel({ count }: { count: number }) {
  return (
    <CornerLabel corner="tl" title={`${count} unwatched`}>
      {count}
    </CornerLabel>
  )
}

/** Short marker like NEW or NEXT, bottom-left. */
export function MarkerLabel({ children }: { children: string }) {
  return (
    <CornerLabel corner="bl">
      <span className="text-xs tracking-wide">{children}</span>
    </CornerLabel>
  )
}
