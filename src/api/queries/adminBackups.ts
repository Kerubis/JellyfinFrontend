import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFor } from '../client'
import { useSignedIn } from '../session-context'

// Server backups (admins): created and stored by the server itself.

export type BackupContents = { Database: boolean; Metadata: boolean; Trickplay: boolean; Subtitles: boolean }
export type Backup = { path: string; created: string; serverVersion: string; contents: Partial<BackupContents> }

function useBackupHttp() {
  const { server, account } = useSignedIn()
  const api = apiFor(server.url, account.accessToken)
  return {
    http: api.axiosInstance,
    headers: { Authorization: api.authorizationHeader, 'Content-Type': 'application/json' },
    url: (path: string) => `${server.url}${path}`,
    key: ['user', account.userId, 'admin', 'backups'] as const,
  }
}

export function useBackups() {
  const { http, headers, url, key } = useBackupHttp()
  return useQuery({
    queryKey: key,
    staleTime: 30_000,
    queryFn: async (): Promise<Backup[]> => {
      const { data } = await http.get<Record<string, unknown>[]>(url('/Backup'), { headers })
      return data
        .map((b) => ({
          path: String(b.Path),
          created: String(b.DateCreated ?? ''),
          serverVersion: String(b.ServerVersion ?? ''),
          contents: (b.Options as Partial<BackupContents> | undefined) ?? {},
        }))
        .sort((a, b) => b.created.localeCompare(a.created))
    },
  })
}

export function useCreateBackup() {
  const { http, headers, url, key } = useBackupHttp()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contents: BackupContents) => http.post(url('/Backup/Create'), contents, { headers }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Restores a backup; the server restarts afterwards. */
export function useRestoreBackup() {
  const { http, headers, url } = useBackupHttp()
  return useMutation({ mutationFn: (path: string) => http.post(url('/Backup/Restore'), { ArchiveFileName: path }, { headers }) })
}
