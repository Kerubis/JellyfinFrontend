import type { Api } from '@jellyfin/sdk'
import { getDisplayPreferenceApi } from '@jellyfin/sdk/lib/utils/api'
import type { Server, SignedInAccount } from '@/domain/auth'
import { decodeAllPrefs, encodePref, PREF_KEYS, type PrefsValues } from '@/domain/prefs'
import { apiFor } from './client'

/** Profile prefs live in the user's DisplayPreferences under this id/client (PLAN.md D6). */
export const PREFS_ID = 'jff-profile'
export const PREFS_CLIENT = 'jellyfin-frontend'

export async function readCustomPrefs(api: Api, userId: string, displayPreferencesId: string) {
  const { data } = await getDisplayPreferenceApi(api).getDisplayPreferences({
    displayPreferencesId,
    client: PREFS_CLIENT,
    userId,
  })
  return data
}

export async function fetchProfilePrefs(server: Server, account: SignedInAccount): Promise<PrefsValues> {
  const dto = await readCustomPrefs(apiFor(server.url, account.accessToken), account.userId, PREFS_ID)
  return decodeAllPrefs(dto.CustomPrefs ?? {})
}

/**
 * Writes the changed keys. Read-modify-write on a fresh copy, so keys changed on another
 * device in the meantime survive (last write wins per key, not per document).
 */
export async function writeProfilePrefs(
  server: Server,
  account: SignedInAccount,
  changes: Partial<PrefsValues>,
): Promise<PrefsValues> {
  const api = apiFor(server.url, account.accessToken)
  const dto = await readCustomPrefs(api, account.userId, PREFS_ID)
  const custom = { ...dto.CustomPrefs }
  for (const key of PREF_KEYS) {
    if (changes[key] !== undefined) custom[key] = encodePref(key, changes[key])
  }
  await getDisplayPreferenceApi(api).updateDisplayPreferences({
    displayPreferencesId: PREFS_ID,
    client: PREFS_CLIENT,
    userId: account.userId,
    displayPreferencesDto: { ...dto, CustomPrefs: custom },
  })
  return decodeAllPrefs(custom)
}
