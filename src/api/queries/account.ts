import type { UserConfiguration } from '@jellyfin/sdk/lib/generated-client/models'
import { getAuthenticationApi, getImageApi, getUserApi } from '@jellyfin/sdk/lib/utils/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Server, SignedInAccount } from '@/domain/auth'
import { apiFor, userImageUrl } from '../client'
import { useSession, useSignedIn } from '../session-context'

/** Reads the current Jellyfin user configuration, applies `patch` and writes it back whole. */
export async function patchUserConfiguration(server: Server, account: SignedInAccount, patch: Partial<UserConfiguration>) {
  const users = getUserApi(apiFor(server.url, account.accessToken))
  const { data } = await users.getCurrentUser()
  await users.updateUserConfiguration({ userId: account.userId, userConfiguration: { ...data.Configuration, ...patch } })
}

/**
 * Write-through of profile settings Jellyfin also knows (D32), so other Jellyfin apps follow them.
 * Fire and forget: our own prefs are already saved; a failure only means other apps lag behind.
 */
export function useWriteThrough() {
  const { server, account } = useSignedIn()
  const write = useMutation({
    mutationFn: (patch: Partial<UserConfiguration>) => patchUserConfiguration(server, account, patch),
    onError: (error) => console.warn('Jellyfin user configuration not updated', error),
  })
  return (patch: Partial<UserConfiguration>) => {
    if (Object.keys(patch).length > 0) write.mutate(patch)
  }
}

/** Reloads the signed-in user and puts the new avatar into the session (header, profile picker). */
function useRefreshAvatar() {
  const { server, account } = useSignedIn()
  const { updateAccount } = useSession()
  const queryClient = useQueryClient()
  return async () => {
    const { data } = await getUserApi(apiFor(server.url, account.accessToken)).getCurrentUser()
    updateAccount(account.userId, { avatarUrl: userImageUrl(server.url, account.userId, data.PrimaryImageTag) })
    await queryClient.invalidateQueries({ queryKey: ['user', account.userId, 'me'] })
  }
}

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })

/** New profile picture. Jellyfin expects the image base64-encoded with its image type as Content-Type. */
export function useUploadAvatar() {
  const { server, account } = useSignedIn()
  const refresh = useRefreshAvatar()
  return useMutation({
    mutationFn: async (file: File) => {
      const api = apiFor(server.url, account.accessToken)
      await api.axiosInstance.post(`${server.url}/UserImage`, await readAsBase64(file), {
        params: { userId: account.userId },
        headers: { 'Content-Type': file.type, Authorization: api.authorizationHeader },
      })
    },
    onSuccess: refresh,
  })
}

export function useDeleteAvatar() {
  const { server, account } = useSignedIn()
  const refresh = useRefreshAvatar()
  return useMutation({
    mutationFn: () => getImageApi(apiFor(server.url, account.accessToken)).deleteUserImage({ userId: account.userId }).then(() => undefined),
    onSuccess: refresh,
  })
}

export function useChangePassword() {
  const { server, account } = useSignedIn()
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      getUserApi(apiFor(server.url, account.accessToken))
        .updateUserPassword({ userId: account.userId, updateUserPassword: { CurrentPw: current, NewPw: next } })
        .then(() => undefined),
  })
}

/** Approves a Quick Connect code shown on another device, signing it in as this user. */
export function useAuthorizeQuickConnect() {
  const { server, account } = useSignedIn()
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await getAuthenticationApi(apiFor(server.url, account.accessToken)).authorizeQuickConnect({
        code: code.trim(),
        userId: account.userId,
      })
      if (!data) throw new Error('That code was not accepted. Check it and try again.')
    },
  })
}
