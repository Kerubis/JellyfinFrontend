import { createContext, useContext, useEffect, useMemo } from 'react'
import type { DeviceOverrides, PrefKey, PrefsSchema, PrefsValues } from '@/domain/prefs'

export type SaveState = 'idle' | 'saving' | 'error'

export type PrefsContextValue = {
  synced: PrefsValues
  device: DeviceOverrides
  saveState: SaveState
  update: <K extends PrefKey>(key: K, patch: Partial<PrefsSchema[K]>) => void
  /** Replaces this device's override for a key; null removes it. */
  setDeviceOverride: <K extends PrefKey>(key: K, override: Partial<PrefsSchema[K]> | null) => void
  /** Reloads the synced prefs from the server now. */
  refresh: () => void
}

export const PrefsContext = createContext<PrefsContextValue | null>(null)

function usePrefsContext(): PrefsContextValue {
  const prefs = useContext(PrefsContext)
  if (!prefs) throw new Error('usePref must be used inside <PrefsProvider>')
  return prefs
}

/**
 * One preference group. `value` is what the app should use: the synced profile value with this
 * device's overrides on top. `update` changes the synced value (optimistic, debounced write).
 */
export function usePref<K extends PrefKey>(key: K) {
  const { synced, device, update, setDeviceOverride } = usePrefsContext()
  const profile = synced[key]
  const override = device[key]
  const value = useMemo<PrefsSchema[K]>(() => (override ? { ...profile, ...override } : profile), [profile, override])

  return {
    value,
    /** The synced profile value, without device overrides. */
    profile,
    override,
    update: (patch: Partial<PrefsSchema[K]>) => update(key, patch),
    setOverride: (next: Partial<PrefsSchema[K]> | null) => setDeviceOverride(key, next),
  }
}

export function usePrefsSaveState(): SaveState {
  return usePrefsContext().saveState
}

/** Reloads prefs when the calling component mounts (e.g. opening the settings page). */
export function useRefreshPrefsOnMount(): void {
  const { refresh } = usePrefsContext()
  useEffect(() => refresh(), [refresh])
}
