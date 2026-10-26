import type { ReactNode } from 'react'
import { Button } from '@/components/Button'

/** A titled block of results on the request page, with an optional "More" button for paged lists. */
export function ResultSection({
  title,
  count,
  more,
  children,
}: {
  title: ReactNode
  count?: number
  more?: { label: string; disabled?: boolean; onClick: () => void }
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">
        {title} {count !== undefined && <span className="text-xs font-normal text-neutral-500">{count}</span>}
      </h2>
      {children}
      {more && (
        <Button className="self-center" disabled={more.disabled} onClick={more.onClick}>
          {more.label}
        </Button>
      )}
    </section>
  )
}
