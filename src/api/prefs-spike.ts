// Dev-only M2 spike: checks how the server stores DisplayPreferences.CustomPrefs.
// Uses a scratch DisplayPreferences id so real profile prefs are never touched.
import { getDisplayPreferenceApi, getUserApi } from '@jellyfin/sdk/lib/utils/api'
import type { Server, SignedInAccount } from '@/domain/auth'
import { apiFor } from './client'
import { errorMessage } from './errors'
import { PREFS_CLIENT, readCustomPrefs } from './prefs'

const SCRATCH_ID = 'jff-spike'
const SIZES = [1_000, 10_000, 100_000, 1_000_000, 4_000_000]

export type SpikeResult = { check: string; ok: boolean; detail: string }

export async function runPrefsSpike(server: Server, account: SignedInAccount): Promise<SpikeResult[]> {
  const api = apiFor(server.url, account.accessToken)
  const prefsApi = getDisplayPreferenceApi(api)
  const results: SpikeResult[] = []

  async function put(userId: string, custom: Record<string, string>) {
    const dto = await readCustomPrefs(api, userId, SCRATCH_ID)
    await prefsApi.updateDisplayPreferences({
      displayPreferencesId: SCRATCH_ID,
      client: PREFS_CLIENT,
      userId,
      displayPreferencesDto: { ...dto, CustomPrefs: custom },
    })
  }
  const get = async (userId: string) => (await readCustomPrefs(api, userId, SCRATCH_ID)).CustomPrefs ?? {}

  // 1. Does a PUT with only some keys keep the others (merge) or drop them (replace)?
  try {
    await put(account.userId, { a: '1' })
    await put(account.userId, { b: '2' })
    const after = await get(account.userId)
    const merged = after.a === '1'
    results.push({
      check: 'PUT semantics',
      ok: true,
      detail: merged ? 'merges keys (keys not sent are kept)' : 'replaces CustomPrefs (keys not sent are dropped)',
    })
  } catch (error) {
    results.push({ check: 'PUT semantics', ok: false, detail: errorMessage(error) })
  }

  // 2. How large may a single value be?
  for (const size of SIZES) {
    const value = 'x'.repeat(size)
    try {
      await put(account.userId, { big: value })
      const back = (await get(account.userId)).big ?? ''
      const intact = back === value
      results.push({
        check: `Value of ${size.toLocaleString()} chars`,
        ok: intact,
        detail: intact ? 'stored and read back intact' : `read back ${back.length.toLocaleString()} chars`,
      })
      if (!intact) break
    } catch (error) {
      results.push({ check: `Value of ${size.toLocaleString()} chars`, ok: false, detail: errorMessage(error) })
      break
    }
  }

  // 3. Can this user write another user's prefs (needed for admin-managed kid profiles)?
  try {
    const { data: users } = await getUserApi(api).getUsers()
    const other = users.find((u) => u.Id && u.Id !== account.userId)
    if (!other?.Id) {
      results.push({ check: "Write another user's prefs", ok: true, detail: 'no other user on the server to test with' })
    } else {
      try {
        await put(other.Id, { probe: 'admin-write' })
        const back = await get(other.Id)
        await put(other.Id, { probe: '' })
        results.push({
          check: "Write another user's prefs",
          ok: back.probe === 'admin-write',
          detail: back.probe === 'admin-write' ? `works (tested on "${other.Name}")` : 'request accepted but value not stored',
        })
      } catch (error) {
        results.push({ check: "Write another user's prefs", ok: false, detail: errorMessage(error) })
      }
    }
  } catch (error) {
    results.push({ check: "Write another user's prefs", ok: false, detail: `cannot list users: ${errorMessage(error)}` })
  }

  // Leave the scratch entry small.
  await put(account.userId, { a: '', b: '', big: '' }).catch(() => undefined)
  return results
}
