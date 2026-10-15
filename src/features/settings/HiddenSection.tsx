import { useItemsByIds } from '@/api/queries/items'
import { Button } from '@/components/Button'
import { useHiddenFromWatching } from '@/hooks/useHiddenFromWatching'

/** Lists what was removed from Currently Watching, with a way to bring it back. */
export function HiddenSection() {
  const { hiddenIds, unhide } = useHiddenFromWatching()
  const items = useItemsByIds(hiddenIds)
  const names = new Map((items.data ?? []).map((item) => [item.id, item.name]))

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">Hidden from Currently Watching</h2>
      {hiddenIds.length === 0 ? (
        <p className="text-xs text-neutral-500">Nothing hidden. Use × on a Currently Watching card to remove it.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {hiddenIds.map((id) => (
            <li key={id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{names.get(id) ?? (items.isPending ? '…' : 'Unknown item')}</span>
              <Button variant="ghost" onClick={() => unhide(id)}>
                Unhide
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
