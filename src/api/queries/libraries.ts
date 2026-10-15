import { getUserViewApi } from '@jellyfin/sdk/lib/utils/api'
import { useQuery } from '@tanstack/react-query'
import type { Server, SignedInAccount } from '@/domain/auth'
import type { Library } from '@/domain/library'
import { apiFor } from '../client'
import { toLibrary } from '../mappers'
import { useSignedIn } from '../session-context'

async function fetchLibraries(server: Server, account: SignedInAccount): Promise<Library[]> {
  // The server only returns libraries this user may access (user policy: EnabledFolders).
  const { data } = await getUserViewApi(apiFor(server.url, account.accessToken)).getUserViews({
    userId: account.userId,
  })
  return (data.Items ?? []).map((dto) => toLibrary(server, dto))
}

export function useLibraries() {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'libraries'],
    queryFn: () => fetchLibraries(server, account),
    staleTime: 5 * 60_000,
  })
}
