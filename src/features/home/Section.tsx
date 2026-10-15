import type { ReactNode } from 'react'
import { errorMessage } from '@/api/errors'

type Props<T> = {
  title: string
  items: readonly T[]
  isPending: boolean
  error: unknown
  emptyText: string
  render: (items: readonly T[]) => ReactNode
}

/** Section frame: title + count, loading/error/empty states. */
export function Section<T>({ title, items, isPending, error, emptyText, render }: Props<T>) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">{title}</h2>
        {items.length > 0 && <span className="text-xs text-neutral-500">{items.length}</span>}
      </header>
      {isPending ? (
        <p className="text-xs text-neutral-500">Loading…</p>
      ) : error ? (
        <p className="text-xs text-red-400">{errorMessage(error)}</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-neutral-500">{emptyText}</p>
      ) : (
        render(items)
      )}
    </section>
  )
}
