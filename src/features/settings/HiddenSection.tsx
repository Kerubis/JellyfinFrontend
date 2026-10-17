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
      <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">Removed from Currently Watching</h2>
      <p className="text-xs text-neutral-500">
        Removed shows wait in New Episodes (or Not watched, if no episode was watched); removed movies in Not watched. Playing
        something of them again brings them back by itself; entries with nothing left to watch disappear from this list.
      </p>
      {hiddenIds.length === 0 ? (
        <p className="text-xs text-neutral-500">Nothing removed. Use ⋯ → “Remove from Currently Watching” on a card.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {hiddenIds.map((id) => (
            <li key={id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{names.get(id) ?? (items.isPending ? '…' : 'Unknown item')}</span>
              <Button variant="ghost" onClick={() => unhide(id)}>
                Back to Currently Watching
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
