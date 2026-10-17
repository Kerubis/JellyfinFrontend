import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFor, jellyfin } from '../client'
import { useSignedIn } from '../session-context'

// Devices and API keys (admins). Deleting a device signs it out (its access tokens are revoked).

export type Device = { id: string; name: string; app: string; appVersion: string; userName?: string; lastActivity?: string; isThisDevice: boolean }
export type ApiKey = { token: string; app: string; created?: string; lastActivity?: string }

function useAdminHttp() {
  const { server, account } = useSignedIn()
  const api = apiFor(server.url, account.accessToken)
  const queryClient = useQueryClient()
  return {
    http: api.axiosInstance,
    headers: { Authorization: api.authorizationHeader },
    url: (path: string) => `${server.url}${path}`,
    base: ['user', account.userId, 'admin'] as const,
    queryClient,
  }
}

const NEVER = '0001-01-01'

export function useDevices() {
  const { http, headers, url, base } = useAdminHttp()
  return useQuery({
    queryKey: [...base, 'devices'],
    staleTime: 30_000,
    queryFn: async (): Promise<Device[]> => {
      const { data } = await http.get<{ Items?: Record<string, unknown>[] }>(url('/Devices'), { headers })
      return (data.Items ?? [])
        .map((d) => ({
          id: String(d.Id),
          name: String(d.Name ?? 'Unknown device'),
          app: String(d.AppName ?? ''),
          appVersion: String(d.AppVersion ?? ''),
          userName: typeof d.LastUserName === 'string' ? d.LastUserName : undefined,
          lastActivity: typeof d.DateLastActivity === 'string' && !d.DateLastActivity.startsWith(NEVER) ? d.DateLastActivity : undefined,
          isThisDevice: d.Id === jellyfin.deviceInfo.id,
        }))
        .sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''))
    },
  })
}

/** Signs out the given devices (never this one). */
export function useRemoveDevices() {
  const { http, headers, url, base, queryClient } = useAdminHttp()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids.filter((id) => id !== jellyfin.deviceInfo.id)) await http.delete(url('/Devices'), { headers, params: { id } })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...base, 'devices'] }),
  })
}

export function useApiKeys() {
  const { http, headers, url, base } = useAdminHttp()
  return useQuery({
    queryKey: [...base, 'apiKeys'],
    staleTime: 30_000,
    queryFn: async (): Promise<ApiKey[]> => {
      const { data } = await http.get<{ Items?: Record<string, unknown>[] }>(url('/Auth/Keys'), { headers })
      return (data.Items ?? []).map((k) => ({
        token: String(k.AccessToken),
        app: String(k.AppName ?? ''),
        created: typeof k.DateCreated === 'string' ? k.DateCreated : undefined,
        lastActivity: typeof k.DateLastActivity === 'string' && !k.DateLastActivity.startsWith(NEVER) ? k.DateLastActivity : undefined,
      }))
    },
  })
}

/** Creates a key; resolves with the new key (found by diffing the list, the API doesn't return it). */
export function useCreateApiKey() {
  const { http, headers, url, base, queryClient } = useAdminHttp()
  return useMutation({
    mutationFn: async (app: string) => {
      const list = async () => ((await http.get<{ Items?: { AccessToken?: string }[] }>(url('/Auth/Keys'), { headers })).data.Items ?? []).map((k) => k.AccessToken)
      const before = new Set(await list())
      await http.post(url('/Auth/Keys'), null, { headers, params: { app: app.trim() } })
      return (await list()).find((token) => token && !before.has(token))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...base, 'apiKeys'] }),
  })
}

export function useRevokeApiKey() {
  const { http, headers, url, base, queryClient } = useAdminHttp()
  return useMutation({
    mutationFn: (token: string) => http.delete(url(`/Auth/Keys/${encodeURIComponent(token)}`), { headers }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...base, 'apiKeys'] }),
  })
}
