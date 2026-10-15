import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { defaultPrefs, PREF_DEFS, PREF_KEYS, type DeviceOverrides, type PrefKey, type PrefsSchema, type PrefsValues } from '@/domain/prefs'
import { readJson, writeJson } from '@/lib/storage'
import { fetchProfilePrefs, writeProfilePrefs } from './prefs'
import { PrefsContext, type PrefsContextValue, type SaveState } from './prefs-context'
import { useSignedIn } from './session-context'

const WRITE_DELAY_MS = 1000
const RETRY_DELAY_MS = 10_000
// Jellyfin sends no event when DisplayPreferences change, so poll (one small GET, only while visible).
const POLL_MS = 15_000
const DEVICE_KEY = 'jff.deviceOverrides'

type Pending = Partial<PrefsValues>

/** Loads the signed-in profile's prefs before rendering children. Mount with key={userId}. */
export function PrefsProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { server, account } = useSignedIn()
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => ['user', account.userId, 'prefs'], [account.userId])
  const query = useQuery({
    queryKey,
    queryFn: () => fetchProfilePrefs(server, account),
    // Picks up changes made on another device: on focus, and periodically while visible.
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    refetchInterval: POLL_MS,
  })

  // Local edits not yet confirmed by the server; they win over fetched data until written.
  // State drives rendering, the ref gives async code the latest value.
  const [pending, setPendingState] = useState<Pending>({})
  const pendingRef = useRef<Pending>({})
  const setPending = useCallback((next: Pending) => {
    pendingRef.current = next
    setPendingState(next)
  }, [])

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timer = useRef<number | undefined>(undefined)
  const inFlight = useRef(false)
  const flushAgain = useRef(false)
  const flushRef = useRef<() => Promise<void>>(async () => {})

  const schedule = useCallback((delay: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flushRef.current(), delay)
  }, [])

  const flush = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current)
    const changes = pendingRef.current
    if (Object.keys(changes).length === 0) return
    if (inFlight.current) {
      flushAgain.current = true
      return
    }
    inFlight.current = true
    setSaveState('saving')
    try {
      const saved = await writeProfilePrefs(server, account, changes)
      const rest = { ...pendingRef.current }
      for (const key of PREF_KEYS) if (rest[key] === changes[key]) delete rest[key]
      // A poll that started before the write would otherwise land afterwards with old data.
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData(queryKey, saved)
      setPending(rest)
      setSaveState(Object.keys(rest).length > 0 ? 'saving' : 'idle')
    } catch (error) {
      console.warn('Saving prefs failed, retrying', error)
      setSaveState('error')
      schedule(RETRY_DELAY_MS)
    } finally {
      inFlight.current = false
      if (flushAgain.current) {
        flushAgain.current = false
        void flushRef.current()
      }
    }
  }, [server, account, queryClient, queryKey, setPending, schedule])

  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  const update = useCallback(
    <K extends PrefKey>(key: K, patch: Partial<PrefsSchema[K]>) => {
      const current: PrefsSchema[K] =
        pendingRef.current[key] ?? queryClient.getQueryData<PrefsValues>(queryKey)?.[key] ?? PREF_DEFS[key].defaults
      const next: Pending = { ...pendingRef.current }
      next[key] = { ...current, ...patch }
      setPending(next)
      setSaveState('saving')
      schedule(WRITE_DELAY_MS)
    },
    [queryClient, queryKey, setPending, schedule],
  )

  // Don't lose edits when the tab is hidden/closed or the profile switches (unmount).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flushRef.current()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void flushRef.current()
    }
  }, [])

  const [device, setDevice] = useState<DeviceOverrides>(() => readJson<DeviceOverrides>(DEVICE_KEY, {}))
  useEffect(() => writeJson(DEVICE_KEY, device), [device])

  const setDeviceOverride = useCallback(<K extends PrefKey>(key: K, override: Partial<PrefsSchema[K]> | null) => {
    setDevice((prev) => {
      const next: DeviceOverrides = { ...prev }
      if (override && Object.keys(override).length > 0) next[key] = override
      else delete next[key]
      return next
    })
  }, [])

  const synced = useMemo<PrefsValues>(() => ({ ...(query.data ?? defaultPrefs()), ...pending }), [query.data, pending])

  const refresh = useCallback(() => void queryClient.invalidateQueries({ queryKey }), [queryClient, queryKey])

  const value = useMemo<PrefsContextValue>(
    () => ({ synced, device, saveState, update, setDeviceOverride, refresh }),
    [synced, device, saveState, update, setDeviceOverride, refresh],
  )

  // On a load error we continue with defaults; writes still do a fresh read first, so nothing is clobbered.
  if (query.isPending) return fallback
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}
