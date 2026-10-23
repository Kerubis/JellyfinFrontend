import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { usePref } from '@/api/prefs-context'
import { useUsers } from '@/api/queries/users'
import { checkSeerr, useSaveUserSeerrConfig, useSeerrServers, useSeerrUserLinks, useUsersSeerrConfig } from '@/api/seerr'
import { ErrorText } from '@/components/AuthCard'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import {
  normalizeSeerrUrl,
  routeKey,
  SEERR_DEFAULT,
  SEERR_URL,
  withSuggestions,
  type SeerrConfig,
  type SeerrKind,
  type SeerrRouting,
  type SeerrServer,
} from '@/domain/seerr'
import type { ManagedUser } from '@/domain/users'
import { SectionTitle } from './parts'

const OFF: SeerrConfig = { url: '', apiKey: '', routing: {} }

/**
 * Seerr server for "Request with Seerr" on the Schedule page. Jellyfin has no app data shared by all users that
 * non-admins can read, so the address and key are written into the prefs of every profile allowed to request (D38).
 */
export function SeerrSection() {
  const users = useUsers(true)
  const sorted = [...(users.data ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const stored = useUsersSeerrConfig(sorted.map((u) => u.id))

  const error = users.error ?? stored.error
  if (error) return <ErrorText>{errorMessage(error)}</ErrorText>
  if (!users.data || !stored.data) return <p className="text-xs text-neutral-500">Loading…</p>
  return <SeerrForm users={sorted} stored={stored.data.map((c) => c ?? OFF)} />
}

function SeerrForm({ users, stored }: { users: ManagedUser[]; stored: SeerrConfig[] }) {
  const ownPref = usePref('seerr')
  const save = useSaveUserSeerrConfig()
  // Start from the own profile's config, else any user's (they're all written the same).
  const initial = [ownPref.profile, ...stored].find((c) => c.apiKey) ?? OFF
  const [url, setUrl] = useState(initial.url)
  const [apiKey, setApiKey] = useState(initial.apiKey)
  const [routing, setRouting] = useState<SeerrRouting>(initial.routing)
  const [allowed, setAllowed] = useState(() => new Set(users.filter((_, i) => stored[i]?.apiKey).map((u) => u.id)))
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; message: string }>({ kind: 'idle' })

  const connection = { url: normalizeSeerrUrl(url), apiKey: apiKey.trim() }
  const valid = SEERR_URL.test(connection.url) && connection.apiKey !== ''
  const links = useSeerrUserLinks(valid ? connection : undefined, users.map((u) => u.id))
  const tvServers = useSeerrServers('tv', valid ? connection : null)
  const movieServers = useSeerrServers('movie', valid ? connection : null)
  const servers = { tv: tvServers.data ?? [], movie: movieServers.data ?? [] }
  const config: SeerrConfig = { ...connection, routing: withSuggestions(routing, servers) }

  const wanted = (userId: string) => (allowed.has(userId) && valid ? config : OFF)
  const same = (a: SeerrConfig, b: SeerrConfig) => a.url === b.url && a.apiKey === b.apiKey && JSON.stringify(a.routing) === JSON.stringify(b.routing)
  const changes = users.flatMap((u, i) => {
    const next = wanted(u.id)
    return same(next, stored[i] ?? OFF) ? [] : [{ userId: u.id, config: next }]
  })

  const toggle = (id: string) =>
    setAllowed((set) => {
      const next = new Set(set)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async () => {
    setState({ kind: 'saving' })
    try {
      if (valid) await checkSeerr(config)
      for (const change of changes) await save.mutateAsync(change)
      setState({ kind: 'saved' })
    } catch (error) {
      setState({ kind: 'error', message: errorMessage(error) })
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Seerr</SectionTitle>
      <p className="text-xs text-neutral-500">
        Lets the profiles below request movies and shows (Request page, Schedule). Requests are made as each profile's own Seerr user
        (Jellyfin users imported in Seerr), with their permissions and quotas. The address and API key (Seerr → Settings →
        General) are saved into each allowed profile, so its users could read the key.
      </p>
      <TextField
        label="Seerr address"
        placeholder="http://192.168.1.20:5055"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        hint={url.trim() && !SEERR_URL.test(normalizeSeerrUrl(url)) ? 'http(s)://host:port, without a path' : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      <TextField label="API key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" spellCheck={false} />

      {valid && (
        <RoutingTable
          servers={servers}
          error={tvServers.error ?? movieServers.error}
          routing={config.routing}
          onChange={(key, id) => setRouting((r) => ({ ...r, [key]: id }))}
        />
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Can request</h3>
        <ul className="flex flex-col divide-y divide-neutral-800">
          {users.map((user, i) => {
            const link = links[i]
            return (
              <li key={user.id}>
                <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
                  <input type="checkbox" checked={allowed.has(user.id)} onChange={() => toggle(user.id)} className="size-4 accent-accent-500" />
                  <Avatar name={user.name} url={user.avatarUrl} />
                  <span className="min-w-0 flex-1 font-medium">{user.name}</span>
                  {link === null && <span className="text-xs text-amber-300">not a Seerr user</span>}
                  {link && <span className="text-xs text-neutral-500">Seerr: {link.name || `#${link.id}`}</span>}
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={changes.length === 0 || state.kind === 'saving' || (url.trim() !== '' && !valid)} onClick={() => void submit()}>
          {state.kind === 'saving' ? 'Checking…' : 'Save'}
        </Button>
        {state.kind === 'saved' && changes.length === 0 && <span className="text-xs text-green-400">Saved.</span>}
        {state.kind === 'error' && <span className="text-xs text-red-400">{state.message} Not saved.</span>}
      </div>
    </section>
  )
}

const ROWS: { kind: SeerrKind; anime: boolean; label: string }[] = [
  { kind: 'tv', anime: true, label: 'Anime shows' },
  { kind: 'tv', anime: false, label: 'Other shows' },
  { kind: 'movie', anime: true, label: 'Anime movies' },
  { kind: 'movie', anime: false, label: 'Other movies' },
]

/**
 * Which Sonarr / Radarr server each kind of request starts with (D39); the request panel can still change it.
 * Anime = TMDB keyword "anime" or Japanese animation, and everything from the Schedule page.
 */
function RoutingTable({
  servers,
  error,
  routing,
  onChange,
}: {
  servers: Record<SeerrKind, readonly SeerrServer[]>
  error: Error | null
  routing: SeerrRouting
  onChange: (key: ReturnType<typeof routeKey>, id: number) => void
}) {
  const has4k = servers.tv.some((s) => s.is4k) || servers.movie.some((s) => s.is4k)
  const select = 'w-full rounded border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-sm focus:border-accent-500 focus:outline-none'
  const cell = (kind: SeerrKind, anime: boolean, is4k: boolean) => {
    const options = servers[kind].filter((s) => s.is4k === is4k)
    if (options.length === 0) return <span className="text-xs text-neutral-600">no {is4k ? '4K ' : ''}server</span>
    const key = routeKey(kind, anime, is4k)
    const fallback = options.find((s) => s.isDefault)?.name
    return (
      <select className={select} value={routing[key] ?? SEERR_DEFAULT} onChange={(e) => onChange(key, Number(e.target.value))}>
        <option value={SEERR_DEFAULT}>Seerr default{fallback ? ` (${fallback})` : ''}</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Destination servers</h3>
      <p className="text-xs text-neutral-500">
        Where requests go unless changed in the request popup. Anime is recognised by TMDB's “anime” keyword (or Japanese
        animation); everything requested from the Schedule counts as anime. Servers named “…anime…” are suggested.
      </p>
      {error ? (
        <ErrorText>{errorMessage(error)}</ErrorText>
      ) : (
        <table className="text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-1 pr-3 font-normal" />
              <th className="py-1 pr-3 font-normal">HD</th>
              {has4k && <th className="py-1 font-normal">4K</th>}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={`${row.kind}-${row.anime}`}>
                <td className="py-1 pr-3 whitespace-nowrap text-neutral-300">{row.label}</td>
                <td className="py-1 pr-3">{cell(row.kind, row.anime, false)}</td>
                {has4k && <td className="py-1">{cell(row.kind, row.anime, true)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
