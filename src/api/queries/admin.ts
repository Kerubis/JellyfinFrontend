import type {
  ActivityLogEntry,
  FolderStorageDto,
  SessionInfoDto,
  SystemStorageDto,
  TaskInfo,
  TaskTriggerInfo,
} from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi, getScheduledTaskApi, getSessionApi, getSystemApi } from '@jellyfin/sdk/lib/utils/api'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ActivityEntry,
  AdminSession,
  LogFile,
  PlayMethod,
  ScheduledTask,
  ServerInfo,
  StorageDisk,
  TaskTrigger,
} from '@/domain/admin'
import { episodeLabel } from '@/domain/media'
import { TICKS_PER_SECOND } from '@/domain/player'
import { apiFor } from '../client'
import { useSignedIn } from '../session-context'

// Server administration (admins only; the server refuses everyone else with 403).

const ADMIN = 'admin'

function useAdminApi() {
  const { server, account } = useSignedIn()
  return { server, account, api: apiFor(server.url, account.accessToken), key: ['user', account.userId, ADMIN] as const }
}

// --- System -------------------------------------------------------------------

export function useServerInfo() {
  const { api, key } = useAdminApi()
  return useQuery({
    queryKey: [...key, 'system'],
    staleTime: 30_000,
    queryFn: async (): Promise<ServerInfo> => {
      const { data } = await getSystemApi(api).getSystemInfo()
      return {
        name: data.ServerName ?? 'Jellyfin',
        version: data.Version ?? '',
        platform: [data.OperatingSystemDisplayName || data.OperatingSystem, data.SystemArchitecture].filter(Boolean).join(' '),
        address: data.LocalAddress ?? undefined,
        hasPendingRestart: !!data.HasPendingRestart,
        hasUpdateAvailable: !!data.HasUpdateAvailable,
        canRestart: data.CanSelfRestart ?? true,
      }
    },
  })
}

const FOLDER_LABELS: [keyof SystemStorageDto, string][] = [
  ['ProgramDataFolder', 'Data'],
  ['InternalMetadataFolder', 'Metadata'],
  ['CacheFolder', 'Cache'],
  ['ImageCacheFolder', 'Image cache'],
  ['TranscodingTempFolder', 'Transcodes'],
  ['LogFolder', 'Logs'],
  ['WebFolder', 'Web client'],
]

/** Server folders and library folders, grouped by the disk they live on. */
function toDisks(data: SystemStorageDto): StorageDisk[] {
  const disks = new Map<string, StorageDisk>()
  const add = (folder: FolderStorageDto | null | undefined, use: string) => {
    if (!folder?.Path) return
    const id = folder.DeviceId || folder.Path
    const disk = disks.get(id)
    if (disk) {
      if (!disk.uses.includes(use)) disk.uses.push(use)
      return
    }
    disks.set(id, {
      uses: [use],
      path: folder.Path,
      free: folder.FreeSpace ?? 0,
      used: folder.UsedSpace ?? 0,
      network: folder.StorageType === 'Network',
    })
  }
  for (const [key, label] of FOLDER_LABELS) add(data[key] as FolderStorageDto | undefined, label)
  for (const library of data.Libraries ?? []) for (const folder of library.Folders ?? []) add(folder, library.Name ?? 'Library')
  return [...disks.values()]
}

export function useStorage() {
  const { api, key } = useAdminApi()
  return useQuery({
    queryKey: [...key, 'storage'],
    staleTime: 60_000,
    queryFn: async () => toDisks((await getSystemApi(api).getSystemStorage()).data),
  })
}

/** Scan all libraries / restart / shut down. */
export function useServerAction() {
  const { api, key } = useAdminApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (action: 'scan' | 'restart' | 'shutdown') => {
      if (action === 'scan') await getLibraryApi(api).refreshLibrary()
      else if (action === 'restart') await getSystemApi(api).restartApplication()
      else await getSystemApi(api).shutdownApplication()
    },
    onSuccess: (_data, action) => {
      if (action === 'scan') void queryClient.invalidateQueries({ queryKey: [...key, 'tasks'] })
    },
  })
}

// --- Sessions -----------------------------------------------------------------

const PLAY_METHODS: readonly PlayMethod[] = ['DirectPlay', 'DirectStream', 'Transcode']

function toSession(dto: SessionInfoDto): AdminSession {
  const item = dto.NowPlayingItem
  const state = dto.PlayState
  const label = item?.Type === 'Episode' ? episodeLabel({ seasonNumber: item.ParentIndexNumber ?? undefined, episodeNumber: item.IndexNumber ?? undefined }) : ''
  return {
    id: dto.Id ?? '',
    userName: dto.UserName ?? undefined,
    client: dto.Client ?? 'Unknown client',
    deviceName: dto.DeviceName ?? 'Unknown device',
    appVersion: dto.ApplicationVersion ?? undefined,
    lastActivity: dto.LastActivityDate ?? undefined,
    mediaControl: !!dto.SupportsMediaControl,
    remoteControl: !!dto.SupportsRemoteControl,
    nowPlaying: item
      ? {
          title: item.Name ?? 'Unknown',
          subtitle: item.SeriesName ? [item.SeriesName, label].filter(Boolean).join(' · ') : undefined,
          positionSeconds: (state?.PositionTicks ?? 0) / TICKS_PER_SECOND,
          durationSeconds: item.RunTimeTicks ? item.RunTimeTicks / TICKS_PER_SECOND : undefined,
          paused: !!state?.IsPaused,
          playMethod: PLAY_METHODS.find((m) => m === state?.PlayMethod),
          transcodeReasons: dto.TranscodingInfo?.TranscodeReasons ?? [],
          hardwareAccel: dto.TranscodingInfo?.HardwareAccelerationType ?? undefined,
        }
      : undefined,
  }
}

/** Sessions active in the last 16 minutes, playing ones first; refreshed every 5 s while shown. */
export function useSessions() {
  const { api, key } = useAdminApi()
  return useQuery({
    queryKey: [...key, 'sessions'],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await getSessionApi(api).getSessions({ activeWithinSeconds: 960 })
      return data
        .map(toSession)
        .sort((a, b) => Number(!!b.nowPlaying) - Number(!!a.nowPlaying) || (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''))
    },
  })
}

export function useStopSession() {
  const { api, key } = useAdminApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => getSessionApi(api).sendPlaystateCommand({ sessionId, command: 'Stop' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...key, 'sessions'] }),
  })
}

export function useMessageSession() {
  const { api } = useAdminApi()
  return useMutation({
    mutationFn: ({ sessionId, text }: { sessionId: string; text: string }) =>
      getSessionApi(api).sendMessageCommand({ sessionId, messageCommand: { Header: 'Message from the server', Text: text, TimeoutMs: 15000 } }),
  })
}

// --- Scheduled tasks ----------------------------------------------------------

const TICKS = TICKS_PER_SECOND

function toTrigger(info: TaskTriggerInfo): TaskTrigger | undefined {
  const seconds = (ticks: number | null | undefined) => (ticks ?? 0) / TICKS
  switch (info.Type) {
    case 'DailyTrigger':
      return { type: 'daily', secondsOfDay: seconds(info.TimeOfDayTicks) }
    case 'WeeklyTrigger':
      return { type: 'weekly', day: info.DayOfWeek ?? 'Sunday', secondsOfDay: seconds(info.TimeOfDayTicks) }
    case 'IntervalTrigger':
      return { type: 'interval', seconds: seconds(info.IntervalTicks) }
    case 'StartupTrigger':
      return { type: 'startup' }
    default:
      return undefined
  }
}

export function fromTrigger(trigger: TaskTrigger): TaskTriggerInfo {
  switch (trigger.type) {
    case 'daily':
      return { Type: 'DailyTrigger', TimeOfDayTicks: trigger.secondsOfDay * TICKS }
    case 'weekly':
      return { Type: 'WeeklyTrigger', DayOfWeek: trigger.day as TaskTriggerInfo['DayOfWeek'], TimeOfDayTicks: trigger.secondsOfDay * TICKS }
    case 'interval':
      return { Type: 'IntervalTrigger', IntervalTicks: trigger.seconds * TICKS }
    case 'startup':
      return { Type: 'StartupTrigger' }
  }
}

function toTask(dto: TaskInfo): ScheduledTask {
  const last = dto.LastExecutionResult
  const state = dto.State === 'Running' || dto.State === 'Cancelling' ? dto.State : 'Idle'
  return {
    id: dto.Id ?? '',
    key: dto.Key ?? '',
    name: dto.Name ?? 'Task',
    description: dto.Description ?? '',
    category: dto.Category ?? 'Other',
    state,
    progress: state === 'Running' ? (dto.CurrentProgressPercentage ?? 0) : undefined,
    lastResult: last
      ? { status: last.Status ?? 'Unknown', start: last.StartTimeUtc ?? undefined, end: last.EndTimeUtc ?? undefined, error: last.ErrorMessage ?? undefined }
      : undefined,
    triggers: (dto.Triggers ?? []).flatMap((t) => toTrigger(t) ?? []),
  }
}

/** Scheduled tasks; polled every 2 s while one runs (progress), every 30 s otherwise. */
export function useScheduledTasks() {
  const { api, key } = useAdminApi()
  return useQuery({
    queryKey: [...key, 'tasks'],
    refetchInterval: (query) => (query.state.data?.some((t) => t.state !== 'Idle') ? 2000 : 30_000),
    queryFn: async () => (await getScheduledTaskApi(api).getTasks({ isHidden: false })).data.map(toTask),
  })
}

export function useTaskAction() {
  const { api, key } = useAdminApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, action }: { taskId: string; action: 'start' | 'stop' }) =>
      action === 'start' ? getScheduledTaskApi(api).startTask({ taskId }) : getScheduledTaskApi(api).stopTask({ taskId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...key, 'tasks'] }),
  })
}

export function useUpdateTaskTriggers() {
  const { api, key } = useAdminApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, triggers }: { taskId: string; triggers: TaskTrigger[] }) =>
      getScheduledTaskApi(api).updateTask({ taskId, taskTriggerInfo: triggers.map(fromTrigger) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...key, 'tasks'] }),
  })
}

// --- Activity & logs ----------------------------------------------------------

const ACTIVITY_PAGE = 50

function toActivity(dto: ActivityLogEntry): ActivityEntry {
  return {
    id: dto.Id ?? 0,
    name: dto.Name ?? '',
    // Jellyfin sometimes sends just a label ("IP address: ") with an empty value.
    overview: [dto.ShortOverview, dto.Overview].find((text) => text && !/:\s*$/.test(text)) ?? undefined,
    type: dto.Type ?? '',
    date: dto.Date ?? '',
    severity: dto.Severity ?? 'Information',
    userId: dto.UserId && dto.UserId !== '00000000000000000000000000000000' ? dto.UserId : undefined,
  }
}

/** Activity log, newest first, in pages of 50. */
export function useActivity() {
  const { api, key } = useAdminApi()
  return useInfiniteQuery({
    queryKey: [...key, 'activity'],
    initialPageParam: 0,
    refetchInterval: 30_000,
    queryFn: async ({ pageParam }) => {
      const { data } = await getSystemApi(api).getLogEntries({ startIndex: pageParam, limit: ACTIVITY_PAGE })
      const items = (data.Items ?? []).map(toActivity)
      const next = pageParam + items.length
      return { items, total: data.TotalRecordCount ?? items.length, next: items.length > 0 && next < (data.TotalRecordCount ?? 0) ? next : undefined }
    },
    getNextPageParam: (last) => last.next,
  })
}

export function useLogFiles() {
  const { api, key } = useAdminApi()
  return useQuery({
    queryKey: [...key, 'logs'],
    staleTime: 30_000,
    queryFn: async (): Promise<LogFile[]> =>
      (await getSystemApi(api).getServerLogs()).data
        .map((f) => ({ name: f.Name ?? '', size: f.Size ?? 0, modified: f.DateModified ?? '' }))
        .sort((a, b) => b.modified.localeCompare(a.modified)),
  })
}

/** One log file as text (plain request: the SDK would hand back a File object). */
export function useLogFile(name: string | null) {
  const { server, api, key } = useAdminApi()
  return useQuery({
    queryKey: [...key, 'log', name],
    enabled: !!name,
    staleTime: 10_000,
    queryFn: async () => {
      const { data } = await api.axiosInstance.get<string>(`${server.url}/System/Logs/Log`, {
        params: { name },
        responseType: 'text',
        headers: { Authorization: api.authorizationHeader },
      })
      return data
    },
  })
}
