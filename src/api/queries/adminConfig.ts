import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { setPath, type ConfigSource } from '@/domain/adminSettings'
import { apiFor } from '../client'
import { useSignedIn } from '../session-context'

type Config = Record<string, unknown>

function configUrl(source: ConfigSource): string {
  switch (source.kind) {
    case 'system':
      return '/System/Configuration'
    case 'named':
      return `/System/Configuration/${source.key}`
    case 'plugin':
      return `/Plugins/${source.id}/Configuration`
  }
}

function useConfigApi(source: ConfigSource) {
  const { server, account } = useSignedIn()
  const api = apiFor(server.url, account.accessToken)
  // Plain requests: one code path for system, named and plugin configurations (all JSON in, JSON out).
  const request = { headers: { Authorization: api.authorizationHeader } }
  const url = `${server.url}${configUrl(source)}`
  return {
    key: ['user', account.userId, 'admin', 'config', configUrl(source)] as const,
    read: async () => (await api.axiosInstance.get<Config>(url, request)).data,
    write: (config: Config) => api.axiosInstance.post(url, config, { headers: { ...request.headers, 'Content-Type': 'application/json' } }),
  }
}

export function useServerConfig(source: ConfigSource) {
  const { key, read } = useConfigApi(source)
  return useQuery({ queryKey: key, staleTime: 30_000, queryFn: read })
}

/** Saves the given fields: the configuration is read fresh, only these paths are changed, and it's written back whole. */
export function useSaveServerConfig(source: ConfigSource) {
  const { key, read, write } = useConfigApi(source)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      let config = await read()
      for (const [path, value] of Object.entries(values)) config = setPath(config, path, value)
      await write(config)
      return config
    },
    onSuccess: (config) => {
      queryClient.setQueryData(key, config)
      // Restart-needed flags and similar live in the system info.
      void queryClient.invalidateQueries({ queryKey: [key[0], key[1], 'admin', 'system'] })
    },
  })
}
