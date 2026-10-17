import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi, getLocalizationApi, getUserApi } from '@jellyfin/sdk/lib/utils/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Server, SignedInAccount } from '@/domain/auth'
import { DEFAULT_SAFETY, grantExtra, type SafetyPrefs, type SafetyUsage } from '@/domain/safety'
import { SCHEDULE_DAYS, type ManagedUser, type RatingLevel, type ScheduleDay, type UserAccess, type UserLimits } from '@/domain/users'
import { apiFor, userImageUrl } from '../client'
import { fetchProfilePrefs, writeProfilePrefs } from '../prefs'
import { useSignedIn } from '../session-context'

const MINUTE = 60_000

function toManagedUser(server: Server, dto: UserDto): ManagedUser {
  const p = dto.Policy
  return {
    id: dto.Id ?? '',
    name: dto.Name ?? 'User',
    isAdmin: !!p?.IsAdministrator,
    avatarUrl: userImageUrl(server.url, dto.Id ?? '', dto.PrimaryImageTag),
    hasPassword: dto.HasPassword ?? true,
    lastActivity: dto.LastActivityDate ?? undefined,
    access: {
      isAdmin: !!p?.IsAdministrator,
      disabled: !!p?.IsDisabled,
      hidden: !!p?.IsHidden,
      remoteAccess: p?.EnableRemoteAccess ?? true,
      downloads: p?.EnableContentDownloading ?? true,
      transcoding: p?.EnableVideoPlaybackTranscoding ?? true,
    },
    limits: {
      maxParentalRating: p?.MaxParentalRating ?? null,
      blockedTags: p?.BlockedTags ?? [],
      allFolders: p?.EnableAllFolders ?? true,
      folders: p?.EnabledFolders ?? [],
      schedules: (p?.AccessSchedules ?? []).map((s) => ({
        day: (SCHEDULE_DAYS as readonly string[]).includes(s.DayOfWeek ?? '') ? (s.DayOfWeek as ScheduleDay) : 'Everyday',
        startHour: s.StartHour ?? 0,
        endHour: s.EndHour ?? 24,
      })),
    },
  }
}

const api = (server: Server, account: SignedInAccount) => apiFor(server.url, account.accessToken)

/** The signed-in user (admin flag, own limits). */
export function useCurrentUser() {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'me'],
    staleTime: 5 * MINUTE,
    queryFn: async () => toManagedUser(server, (await getUserApi(api(server, account)).getCurrentUser()).data),
  })
}

/** All users on the server (admins only). */
export function useUsers(enabled: boolean) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'users'],
    enabled,
    staleTime: MINUTE,
    queryFn: async () => (await getUserApi(api(server, account)).getUsers()).data.map((dto) => toManagedUser(server, dto)),
  })
}

/** Rating levels with example names (e.g. 7: TV-Y7, …), for the max-rating picker. */
export function useRatingLevels() {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['server', server.id, 'ratingLevels'],
    staleTime: Infinity,
    queryFn: async (): Promise<RatingLevel[]> => {
      const { data } = await getLocalizationApi(api(server, account)).getParentalRatings()
      const levels = new Map<number, string[]>()
      for (const r of data) {
        if (r.Value === null || r.Value === undefined || !r.Name) continue
        levels.set(r.Value, [...(levels.get(r.Value) ?? []), r.Name])
      }
      return [...levels].sort(([a], [b]) => a - b).map(([value, names]) => ({ value, names }))
    },
  })
}

/** Library folders (ids match the user views). */
export function useMediaFolders() {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['server', server.id, 'mediaFolders'],
    staleTime: 10 * MINUTE,
    queryFn: async () =>
      ((await getLibraryApi(api(server, account)).getMediaFolders()).data.Items ?? [])
        .filter((f) => f.Id && f.CollectionType !== 'playlists')
        .map((f) => ({ id: f.Id ?? '', name: f.Name ?? 'Library' })),
  })
}

/** Saves a user's Jellyfin limits: the full policy is read fresh, patched and written back. */
export function useUpdateLimits() {
  const { server, account } = useSignedIn()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, limits }: { userId: string; limits: UserLimits }) => {
      const users = getUserApi(api(server, account))
      const { data } = await users.getUserById({ userId })
      if (!data.Policy) throw new Error('This user has no policy to edit.')
      await users.updateUserPolicy({
        userId,
        userPolicy: {
          ...data.Policy,
          MaxParentalRating: limits.maxParentalRating,
          BlockedTags: limits.blockedTags,
          EnableAllFolders: limits.allFolders,
          EnabledFolders: limits.allFolders ? [] : limits.folders,
          AccessSchedules: limits.schedules.map((s) => ({ DayOfWeek: s.day, StartHour: s.startHour, EndHour: s.endHour, UserId: userId })),
        },
      })
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['user', account.userId, 'users'] }),
  })
}

/** Another user's soft limits (stored in that user's synced prefs; admins only). */
export function useUserSafety(userId: string | undefined) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'safetyOf', userId],
    enabled: !!userId,
    staleTime: MINUTE,
    queryFn: async (): Promise<SafetyPrefs> => (userId ? (await fetchProfilePrefs(server, account, userId)).safety : DEFAULT_SAFETY),
  })
}

/**
 * Saves some of another user's soft limits: the stored limits are read fresh and only `patch` is applied, so
 * forms editing different fields (app limits, account section) and granted extra time never overwrite each other.
 */
export function useSaveUserSafety() {
  const { server, account } = useSignedIn()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, patch }: { userId: string; patch: Partial<SafetyPrefs> }) => {
      const next = { ...(await fetchProfilePrefs(server, account, userId)).safety, ...patch }
      await writeProfilePrefs(server, account, { safety: next }, userId)
      return next
    },
    onSuccess: (next, { userId }) => queryClient.setQueryData(['user', account.userId, 'safetyOf', userId], next),
  })
}

/** Another user's watch time today (synced by their player about once a minute). */
export function useUserUsage(userId: string) {
  const { server, account } = useSignedIn()
  return useQuery({
    queryKey: ['user', account.userId, 'usageOf', userId],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<SafetyUsage> => (await fetchProfilePrefs(server, account, userId)).safetyUsage,
  })
}

/** Grants extra minutes for today (on top of the daily limit; gone tomorrow). */
export function useGrantExtraTime() {
  const { server, account } = useSignedIn()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, minutes }: { userId: string; minutes: number }) => {
      const next = grantExtra((await fetchProfilePrefs(server, account, userId)).safety, minutes, new Date())
      await writeProfilePrefs(server, account, { safety: next }, userId)
      return next
    },
    onSuccess: (next, { userId }) => queryClient.setQueryData(['user', account.userId, 'safetyOf', userId], next),
  })
}

// --- User management (admins) --------------------------------------------------

function useUsersChanged() {
  const { account } = useSignedIn()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['user', account.userId, 'users'] })
}

/** Creates a user; resolves with the new user's id. */
export function useCreateUser() {
  const { server, account } = useSignedIn()
  const changed = useUsersChanged()
  return useMutation({
    mutationFn: async ({ name, password }: { name: string; password: string }) => {
      const { data } = await getUserApi(api(server, account)).createUserByName({ createUserByName: { Name: name.trim(), Password: password } })
      return data.Id ?? ''
    },
    onSuccess: changed,
  })
}

export function useDeleteUser() {
  const { server, account } = useSignedIn()
  const changed = useUsersChanged()
  return useMutation({
    mutationFn: (userId: string) => getUserApi(api(server, account)).deleteUser({ userId }).then(() => undefined),
    onSuccess: changed,
  })
}

/** Name and account switches. Name via the user record, switches via the policy (each read fresh, patched, written back). */
export function useUpdateUserAccount() {
  const { server, account } = useSignedIn()
  const changed = useUsersChanged()
  return useMutation({
    mutationFn: async ({ userId, name, access }: { userId: string; name: string; access: UserAccess }) => {
      const users = getUserApi(api(server, account))
      const { data } = await users.getUserById({ userId })
      if (name.trim() && name.trim() !== data.Name) await users.updateUser({ userId, userDto: { ...data, Name: name.trim() } })
      if (!data.Policy) throw new Error('This user has no policy to edit.')
      await users.updateUserPolicy({
        userId,
        userPolicy: {
          ...data.Policy,
          IsAdministrator: access.isAdmin,
          IsDisabled: access.disabled,
          IsHidden: access.hidden,
          EnableRemoteAccess: access.remoteAccess,
          EnableContentDownloading: access.downloads,
          EnableVideoPlaybackTranscoding: access.transcoding,
          EnableAudioPlaybackTranscoding: access.transcoding,
        },
      })
    },
    onSettled: changed,
  })
}

/** Sets another user's password (admins need no current password); empty = remove the password. */
export function useSetUserPassword() {
  const { server, account } = useSignedIn()
  const changed = useUsersChanged()
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      getUserApi(api(server, account))
        .updateUserPassword({ userId, updateUserPassword: password ? { NewPw: password } : { ResetPassword: true } })
        .then(() => undefined),
    onSuccess: changed,
  })
}
