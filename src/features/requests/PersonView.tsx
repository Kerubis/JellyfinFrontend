import { useState } from 'react'
import { usePref } from '@/api/prefs-context'
import { useSeerrPeople } from '@/api/seerr'
import { CardGrid } from '@/components/cards'
import { seerrRef, sortCredits, type SeerrCredit, type SeerrKind, type SeerrPersonDetails, type SeerrSort } from '@/domain/seerr'
import { ResultSection } from './ResultSection'
import { SeerrTile } from './SeerrTile'

type Open = (target: { kind: SeerrKind; tmdbId: number }) => void

/** Credits shown before "Show all" (prolific people have hundreds). */
const FIRST_SHOWN = 40
const ROLES_SHOWN = 2

/**
 * One person: what they made (crew) and what they appeared in (cast). Several: the titles they all share. In the
 * chosen sort; the field's plain words filter by title.
 */
export function PersonView({
  personIds,
  kind,
  text,
  sort,
  onOpen,
}: {
  personIds: readonly number[]
  kind: SeerrKind | 'all'
  text: string
  sort: SeerrSort
  onOpen: Open
}) {
  const people = useSeerrPeople(personIds)
  if (people.error) return <p className="text-xs text-red-400">{people.error.message}</p>
  if (!people.data) return <p className="text-xs text-neutral-500">Loading…</p>
  const words = text.toLowerCase()
  const pick = (list: SeerrCredit[]) =>
    sortCredits(
      list.filter((c) => (kind === 'all' || c.kind === kind) && (!words || c.title.toLowerCase().includes(words))),
      sort,
    )
  const [first, ...others] = people.data
  if (!first) return null

  const sections =
    others.length === 0
      ? [
          { id: 'crew', title: 'Worked on', credits: pick(first.crew) },
          { id: 'cast', title: 'Appeared in', credits: pick(first.cast) },
        ]
      : [{ id: 'shared', title: 'Together', credits: pick(shared(people.data)) }]
  // Actors' own roles first, everyone else's work first.
  if (others.length === 0 && first.department === 'Acting') sections.reverse()
  const key = personIds.join('-')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        {people.data.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            {p.photo ? <img src={p.photo} alt="" className="size-16 rounded-full object-cover" /> : <div className="size-16 rounded-full bg-neutral-800" />}
            <div>
              <h2 className="text-lg leading-tight font-semibold">{p.name}</h2>
              {p.department && <p className="text-xs text-neutral-400">{p.department}</p>}
            </div>
          </div>
        ))}
      </div>
      {sections.every((s) => s.credits.length === 0) && <p className="text-sm text-neutral-500">No matching titles.</p>}
      {sections.map((s) => s.credits.length > 0 && <CreditSection key={`${key}-${s.id}`} title={s.title} credits={s.credits} onOpen={onOpen} />)}
    </div>
  )
}

/** Titles everyone worked on or appeared in, with each person's roles. */
function shared(people: readonly SeerrPersonDetails[]): SeerrCredit[] {
  const perPerson = people.map((p) => {
    const byTitle = new Map<string, SeerrCredit>()
    for (const c of [...p.crew, ...p.cast]) {
      const own = byTitle.get(seerrRef(c))
      byTitle.set(seerrRef(c), own ? { ...own, roles: [...own.roles, ...c.roles] } : c)
    }
    return { name: p.name, byTitle }
  })
  const [first, ...rest] = perPerson
  if (!first) return []
  return [...first.byTitle.values()]
    .filter((c) => rest.every((p) => p.byTitle.has(seerrRef(c))))
    .map((c) => ({ ...c, roles: perPerson.map((p) => `${p.name.split(' ')[0]}: ${p.byTitle.get(seerrRef(c))?.roles[0] ?? '?'}`) }))
}

function CreditSection({ title, credits, onOpen }: { title: string; credits: SeerrCredit[]; onOpen: Open }) {
  const { cardSize } = usePref('ui').value
  const [all, setAll] = useState(false)
  const shown = all ? credits : credits.slice(0, FIRST_SHOWN)
  return (
    <ResultSection
      title={title}
      count={credits.length}
      more={shown.length < credits.length ? { label: `Show all ${credits.length}`, onClick: () => setAll(true) } : undefined}
    >
      <CardGrid size={cardSize} variant="poster">
        {shown.map((c) => (
          <SeerrTile key={seerrRef(c)} result={c} detail={c.roles.slice(0, ROLES_SHOWN).join(', ') || undefined} onOpen={() => onOpen(c)} />
        ))}
      </CardGrid>
    </ResultSection>
  )
}
