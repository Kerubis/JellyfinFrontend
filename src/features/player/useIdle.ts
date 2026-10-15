import { useCallback, useEffect, useRef, useState } from 'react'

/** True after `ms` without pointer/keyboard activity; `poke` resets it. */
export function useIdle(ms: number, enabled: boolean) {
  const [idle, setIdle] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const poke = useCallback(() => {
    setIdle(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setIdle(true), ms)
  }, [ms])

  useEffect(() => {
    if (!enabled) {
      window.clearTimeout(timer.current)
      return
    }
    timer.current = window.setTimeout(() => setIdle(true), ms)
    window.addEventListener('keydown', poke)
    return () => {
      window.removeEventListener('keydown', poke)
      window.clearTimeout(timer.current)
    }
  }, [enabled, ms, poke])

  return { idle: enabled && idle, poke }
}
