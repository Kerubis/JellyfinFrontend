import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFor } from '../client'
import { useSignedIn } from '../session-context'

// Plugins (admins). Plain requests: the SDK models add nothing here and the catalog uses lower-case keys.

export type Plugin = {
  id: string
  name: string
  version: string
  description: string
  /** Active, Restart, Disabled, Malfunctioned, NotSupported, Superceded, Deleted. */
  status: string
  canUninstall: boolean
  configurable: boolean
  imageUrl?: string
}

export type Package = {
  guid: string
  name: string
  overview: string
  description: string
  category: string
  owner: string
  /** Newest first. */
  versions: { version: string; changelog: string; targetAbi: string; repositoryName: string; repositoryUrl: string }[]
}

export type Repository = { Name: string; Url: string; Enabled: boolean }

function usePluginApi() {
  const { server, account } = useSignedIn()
  const api = apiFor(server.url, account.accessToken)
  const headers = { Authorization: api.authorizationHeader }
  const http = api.axiosInstance
  const url = (path: string) => `${server.url}${path}`
  const queryClient = useQueryClient()
  const base = ['user', account.userId, 'admin'] as const
  const changed = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [...base, 'plugins'] }),
      queryClient.invalidateQueries({ queryKey: [...base, 'system'] }),
    ])
  return { server, account, http, headers, url, base, changed }
}

export function usePlugins() {
  const { http, headers, url, base, server, account } = usePluginApi()
  return useQuery({
    queryKey: [...base, 'plugins'],
    staleTime: 30_000,
    queryFn: async (): Promise<Plugin[]> => {
      const { data } = await http.get<Record<string, unknown>[]>(url('/Plugins'), { headers })
      return data
        .map((p) => ({
          id: String(p.Id),
          name: String(p.Name),
          version: String(p.Version),
          description: String(p.Description ?? ''),
          status: String(p.Status),
          canUninstall: p.CanUninstall === true,
          configurable: !!p.ConfigurationFileName,
          // <img> can't send headers, hence the token in the URL (as for subtitles).
          imageUrl: p.HasImage ? `${server.url}/Plugins/${p.Id}/${p.Version}/Image?api_key=${account.accessToken}` : undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  })
}

export function usePluginAction() {
  const { http, headers, url, changed } = usePluginApi()
  return useMutation({
    mutationFn: ({ plugin, action }: { plugin: Plugin; action: 'enable' | 'disable' | 'uninstall' }) => {
      const path = `/Plugins/${plugin.id}/${plugin.version}`
      if (action === 'uninstall') return http.delete(url(path), { headers })
      return http.post(url(`${path}/${action === 'enable' ? 'Enable' : 'Disable'}`), null, { headers })
    },
    onSettled: changed,
  })
}

export function useCatalog(enabled: boolean) {
  const { http, headers, url, base } = usePluginApi()
  return useQuery({
    queryKey: [...base, 'catalog'],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async () => (await http.get<Package[]>(url('/Packages'), { headers })).data.sort((a, b) => a.name.localeCompare(b.name)),
  })
}

export function useInstallPackage() {
  const { http, headers, url, changed } = usePluginApi()
  return useMutation({
    mutationFn: (pkg: Package) => {
      const latest = pkg.versions[0]
      return http.post(url(`/Packages/Installed/${encodeURIComponent(pkg.name)}`), null, {
        headers,
        params: { assemblyGuid: pkg.guid, version: latest?.version, repositoryUrl: latest?.repositoryUrl },
      })
    },
    onSettled: changed,
  })
}

export function useRepositories() {
  const { http, headers, url, base } = usePluginApi()
  return useQuery({
    queryKey: [...base, 'repositories'],
    staleTime: 60_000,
    queryFn: async () => (await http.get<Repository[]>(url('/Repositories'), { headers })).data,
  })
}

/** Saves the whole repository list (the API only takes the full list). */
export function useSaveRepositories() {
  const { http, headers, url, base } = usePluginApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (list: Repository[]) => http.post(url('/Repositories'), list, { headers: { ...headers, 'Content-Type': 'application/json' } }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [...base, 'repositories'] }),
        queryClient.invalidateQueries({ queryKey: [...base, 'catalog'] }),
      ]),
  })
}
