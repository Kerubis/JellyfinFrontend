import { MediaType } from '@jellyfin/sdk/lib/generated-client/models'
import { getAuthenticationApi, getSessionApi, getSystemApi, getUserApi } from '@jellyfin/sdk/lib/utils/api'
import type { Server, SignedInAccount, User } from '@/domain/auth'
import { apiFor, normalizeServerUrl } from './client'
import { toAccount, toUser } from './mappers'

/** Checks that the URL points at a Jellyfin server and returns its public info. */
export async function connectToServer(input: string): Promise<Server> {
  const url = normalizeServerUrl(input)
  const { data } = await getSystemApi(apiFor(url)).getPublicSystemInfo({ timeout: 8000 })
  if (!data.Id || data.ProductName !== 'Jellyfin Server') {
    throw new Error('That address answered, but it is not a Jellyfin server.')
  }
  return { id: data.Id, name: data.ServerName ?? 'Jellyfin', version: data.Version ?? 'unknown', url }
}

export async function getPublicUsers(server: Server): Promise<User[]> {
  const { data } = await getUserApi(apiFor(server.url)).getPublicUsers()
  return data.map((dto) => toUser(server, dto))
}

export async function loginWithPassword(server: Server, username: string, password: string): Promise<SignedInAccount> {
  const { data } = await getAuthenticationApi(apiFor(server.url)).authenticateUserByName({
    authenticateUserByName: { Username: username, Pw: password },
  })
  return toAccount(server, data)
}

// --- Quick Connect: show a code here, approve it in another signed-in client ---

export async function isQuickConnectEnabled(server: Server): Promise<boolean> {
  const { data } = await getAuthenticationApi(apiFor(server.url)).getQuickConnectEnabled()
  return data
}

export async function startQuickConnect(server: Server): Promise<{ code: string; secret: string }> {
  const { data } = await getAuthenticationApi(apiFor(server.url)).initiateQuickConnect()
  if (!data.Code || !data.Secret) throw new Error('Quick Connect did not return a code.')
  return { code: data.Code, secret: data.Secret }
}

export async function isQuickConnectApproved(server: Server, secret: string): Promise<boolean> {
  const { data } = await getAuthenticationApi(apiFor(server.url)).getQuickConnectState({ secret })
  return data.Authenticated ?? false
}

export async function finishQuickConnect(server: Server, secret: string): Promise<SignedInAccount> {
  const { data } = await getAuthenticationApi(apiFor(server.url)).authenticateWithQuickConnect({
    quickConnectDto: { Secret: secret },
  })
  return toAccount(server, data)
}

// --- Session ---------------------------------------------------------------

/** Ends the server session, which revokes the access token. */
export async function endSession(server: Server, account: SignedInAccount): Promise<void> {
  await getSessionApi(apiFor(server.url, account.accessToken)).reportSessionEnded()
}

/**
 * Registers what this client can do. Remote control (SupportsMediaControl + commands)
 * is switched on once the WebSocket bridge exists (M11); until then we only declare playback.
 */
export async function registerCapabilities(server: Server, account: SignedInAccount): Promise<void> {
  await getSessionApi(apiFor(server.url, account.accessToken)).postFullCapabilities({
    clientCapabilitiesDto: {
      PlayableMediaTypes: [MediaType.Video, MediaType.Audio],
      SupportedCommands: [],
      SupportsMediaControl: false,
      SupportsPersistentIdentifier: true,
    },
  })
}
