import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi, getLocalizationApi, getUserApi } from '@jellyfin/sdk/lib/utils/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Server, SignedInAccount } from '@/domain/auth'
import { DEFAULT_SAFETY, type SafetyPrefs } from '@/domain/safety'
import { SCHEDULE_DAYS, type ManagedUser, type RatingLevel, type ScheduleDay, type UserLimits } from '@/domain/users'
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

export function useSaveUserSafety() {
  const { server, account } = useSignedIn()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, safety }: { userId: string; safety: SafetyPrefs }) => writeProfilePrefs(server, account, { safety }, userId),
    onSuccess: (_data, { userId, safety }) => queryClient.setQueryData(['user', account.userId, 'safetyOf', userId], safety),
  })
}
