import { useCallback, useSyncExternalStore } from 'react'
import { DEFAULT_DEVICE_PLAYBACK, type DevicePlaybackSettings } from '@/domain/player'
import { readJson, writeJson } from '@/lib/storage'

// Playback settings for this device only (screen, network, browser codecs): not synced.

const KEY = 'jff.playbackDevice'
const listeners = new Set<() => void>()
let cached: DevicePlaybackSettings = { ...DEFAULT_DEVICE_PLAYBACK, ...readJson<Partial<DevicePlaybackSettings>>(KEY, {}) }

export function getDevicePlaybackSettings(): DevicePlaybackSettings {
  return cached
}

export function useDevicePlaybackSettings() {
  const settings = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getDevicePlaybackSettings,
  )
  const update = useCallback((patch: Partial<DevicePlaybackSettings>) => {
    cached = { ...cached, ...patch }
    writeJson(KEY, cached)
    listeners.forEach((l) => l())
  }, [])
  return [settings, update] as const
}
