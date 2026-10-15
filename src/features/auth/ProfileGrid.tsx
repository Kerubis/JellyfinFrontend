import { useQuery } from '@tanstack/react-query'
import { getPublicUsers } from '@/api/auth'
import { useSession } from '@/api/session-context'
import { Avatar } from '@/components/Avatar'
import type { Server } from '@/domain/auth'

type Tile = { userId: string; name: string; avatarUrl?: string; signedIn: boolean; stored: boolean }

/** Profiles remembered on this device plus the server's public users. Signed-in ones switch instantly. */
export function ProfileGrid({ server, onPickUser }: { server: Server; onPickUser: (name: string) => void }) {
  const { accounts, switchAccount, signOut } = useSession()
  const publicUsers = useQuery({
    queryKey: ['server', server.id, 'publicUsers'],
    queryFn: () => getPublicUsers(server),
    staleTime: 60_000,
  })

  const tiles: Tile[] = accounts.map((a) => ({ ...a, signedIn: !!a.accessToken, stored: true }))
  for (const user of publicUsers.data ?? []) {
    if (!tiles.some((t) => t.userId === user.id)) {
      tiles.push({ userId: user.id, name: user.name, avatarUrl: user.avatarUrl, signedIn: false, stored: false })
    }
  }
  if (tiles.length === 0) return null

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
      {tiles.map((tile) => (
        <li key={tile.userId} className="group relative">
          <button
            type="button"
            onClick={() => (tile.signedIn ? switchAccount(tile.userId) : onPickUser(tile.name))}
            className="flex w-full flex-col items-center gap-1.5 rounded p-2 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-violet-400"
          >
            <Avatar name={tile.name} url={tile.avatarUrl} size="lg" />
            <span className="w-full truncate text-xs">{tile.name}</span>
            {tile.stored && !tile.signedIn && <span className="text-[10px] text-neutral-500">signed out</span>}
          </button>
          {tile.stored && (
            <button
              type="button"
              onClick={() => void signOut(tile.userId)}
              title={`Forget ${tile.name} on this device`}
              className="absolute top-0.5 right-0.5 hidden size-5 rounded-full bg-neutral-800 text-xs text-neutral-400 group-hover:block hover:text-white"
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
