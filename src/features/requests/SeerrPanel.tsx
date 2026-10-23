import { useState } from 'react'
import { useSeerrRequest, useSeerrUser } from '@/api/seerr'
import { Button } from '@/components/Button'
import { canRequest, defaultSeasons, STATUS_LABEL, type SeerrMedia, type SeerrStatus } from '@/domain/seerr'
import { useRequestDestination } from './useRequestDestination'

const STATUS_TONE: Record<SeerrStatus, string> = {
  available: 'bg-green-600/25 text-green-300',
  partial: 'bg-green-600/15 text-green-300',
  processing: 'bg-accent-700/40 text-accent-300',
  pending: 'bg-amber-500/20 text-amber-300',
  none: 'bg-neutral-700 text-neutral-300',
}

export function StatusBadge({ status }: { status: SeerrStatus }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
}

const note = 'text-xs text-neutral-500'
const select = 'max-w-56 truncate rounded border border-neutral-600 bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-200 focus:border-accent-500 focus:outline-none'

/**
 * What Seerr has of a title (state per season, HD or 4K), and requesting the chosen seasons / the movie as the
 * profile's own Seerr user, to the chosen server (D39). Used by the schedule popup and the request page's popup.
 */
export function SeerrPanel({
  media,
  mappedSeason,
  guessed = false,
  anime = media.anime,
  seerrUrl,
}: {
  media: SeerrMedia
  /** Season to preselect (from the anime id mapping). */
  mappedSeason?: number
  /** Found by title search: say so. */
  guessed?: boolean
  /** Picks the anime route; defaults to what TMDB says (the schedule knows better: always anime). */
  anime?: boolean
  seerrUrl: string
}) {
  const user = useSeerrUser()
  const request = useSeerrRequest()
  const dest = useRequestDestination(media.kind, anime)
  // HD and 4K are separate in Seerr: the chips and the badge show the chosen variant.
  const statusOf = (s: { status: SeerrStatus; status4k: SeerrStatus }) => (dest.is4k ? s.status4k : s.status)
  const seasons = media.seasons.map((s) => ({ ...s, status: statusOf(s) }))
  const [selected, setSelected] = useState(() => defaultSeasons(seasons, mappedSeason))
  const isTv = media.kind === 'tv'
  const requestable = isTv ? seasons.some((s) => canRequest(s.status)) : canRequest(statusOf(media))
  const toggle = (n: number) => setSelected((list) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n].sort((a, b) => a - b)))

  const set4k = (value: boolean) => {
    dest.setIs4k(value)
    request.reset()
    setSelected(defaultSeasons(media.seasons.map((s) => ({ ...s, status: value ? s.status4k : s.status })), mappedSeason))
  }

  const submit = () => {
    if (!user.data) return
    request.mutate(
      {
        kind: media.kind,
        tmdbId: media.tmdbId,
        seasons: selected,
        userId: user.data.id,
        is4k: dest.is4k,
        serverId: dest.server?.id,
        profileId: dest.profileId,
        rootFolder: dest.rootFolder,
      },
      { onSuccess: () => setSelected([]) },
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-700 p-2.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-500">Seerr</span>
        <a href={`${seerrUrl}/${media.kind}/${media.tmdbId}`} target="_blank" rel="noreferrer" className="font-medium text-neutral-100 hover:underline">
          {media.title}
          {media.year && <span className="font-normal text-neutral-400"> ({media.year})</span>}
        </a>
        <StatusBadge status={statusOf(media)} />
        {guessed && <span className="text-[11px] text-amber-300/80">best title match, check it's the right show</span>}
      </div>

      {isTv && seasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seasons.map((s) => {
            const open = canRequest(s.status)
            const on = selected.includes(s.number)
            return (
              <button
                key={s.number}
                type="button"
                disabled={!open || request.isPending}
                onClick={() => toggle(s.number)}
                title={`${s.name}${s.episodes ? ` · ${s.episodes} episodes` : ''} · ${STATUS_LABEL[s.status]}`}
                aria-pressed={on}
                className={`flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs transition-colors ${
                  on
                    ? 'border-accent-500 bg-accent-600/25 text-white'
                    : open
                      ? 'border-neutral-600 text-neutral-300 hover:border-neutral-400'
                      : 'cursor-default border-neutral-700 text-neutral-500'
                }`}
              >
                S{s.number}
                {s.status !== 'none' && <StatusBadge status={s.status} />}
              </button>
            )
          })}
        </div>
      )}

      <Destination dest={dest} anime={anime} onSet4k={set4k} />

      <div className="flex flex-wrap items-center gap-2">
        {requestable && (
          <Button
            variant="primary"
            disabled={!user.data || request.isPending || (isTv && selected.length === 0)}
            onClick={submit}
          >
            {request.isPending
              ? 'Requesting…'
              : isTv
                ? `Request ${selected.length === 1 ? `season ${selected[0]}` : `${selected.length} seasons`}${dest.is4k ? ' in 4K' : ''}`
                : `Request movie${dest.is4k ? ' in 4K' : ''}`}
          </Button>
        )}
        {request.data &&
          (request.data.serverKept ? (
            <span className="text-xs text-green-400">Requested{dest.server ? ` to ${dest.server.name}` : ''}.</span>
          ) : (
            <span className="text-xs text-amber-300">
              Requested, but Seerr used its default server: your Seerr user needs the “Advanced Requests” permission to choose one.
            </span>
          ))}
        {request.isError && <span className="text-xs text-red-400">{request.error.message}</span>}
        {user.isPending && <span className={note}>Looking up your Seerr user…</span>}
        {user.error && <span className="text-xs text-red-400">{user.error.message}</span>}
        {user.data === null && <span className="text-xs text-amber-300">Your profile isn't a Seerr user yet; an admin can import it in Seerr → Users.</span>}
      </div>
    </div>
  )
}

type Dest = ReturnType<typeof useRequestDestination>

/** HD / 4K, the server, and its quality profile and root folder. */
function Destination({ dest, anime, onSet4k }: { dest: Dest; anime: boolean; onSet4k: (value: boolean) => void }) {
  if (dest.servers.error) return <p className="text-xs text-red-400">Servers: {dest.servers.error.message} Requests go to Seerr's default.</p>
  if (!dest.servers.data) return <p className={note}>Loading servers…</p>
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {dest.has4k && (
          <span className="flex overflow-hidden rounded border border-neutral-600" role="group" aria-label="Quality">
            {[false, true].map((value) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={dest.is4k === value}
                onClick={() => onSet4k(value)}
                className={`px-2 py-0.5 ${dest.is4k === value ? 'bg-accent-600 text-white' : 'text-neutral-300 hover:bg-neutral-700'}`}
              >
                {value ? '4K' : 'HD'}
              </button>
            ))}
          </span>
        )}
        <label className="flex items-center gap-1.5 text-neutral-500">
          To
          <select className={select} value={dest.server?.id ?? ''} onChange={(e) => dest.setServer(Number(e.target.value))}>
            {dest.choices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isDefault ? ' (Seerr default)' : ''}
              </option>
            ))}
          </select>
        </label>
        {anime && <span className="rounded bg-purple-700/40 px-1.5 py-0.5 text-[10px] font-medium text-purple-200">Anime</span>}
      </div>
      <ServerOptions dest={dest} />
    </div>
  )
}

function ServerOptions({ dest }: { dest: Dest }) {
  if (dest.options.error) return <p className="text-xs text-red-400">{dest.options.error.message}</p>
  if (!dest.options.data) return <p className={note}>Loading profiles…</p>
  const { profiles, rootFolders } = dest.options.data
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
      <label className="flex items-center gap-1.5">
        Quality
        <select className={select} value={dest.profileId ?? ''} onChange={(e) => dest.setProfileId(Number(e.target.value))}>
          {dest.profileId === undefined && <option value="">Server default</option>}
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        Folder
        <select className={select} value={dest.rootFolder ?? ''} onChange={(e) => dest.setRootFolder(e.target.value)}>
          {dest.rootFolder === undefined && <option value="">Server default</option>}
          {rootFolders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
