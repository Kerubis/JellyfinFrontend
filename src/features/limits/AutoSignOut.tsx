import { useEffect, useRef, useState } from 'react'
import { usePref } from '@/api/prefs-context'
import { useSession, useSignedIn } from '@/api/session-context'
import { Button } from '@/components/Button'
import { usePlayerDispatch, usePlayerState } from '@/features/player/player-context'

const WARN_S = 60

/**
 * App limit "sign out after N minutes without watching" (e.g. guests): the timer runs while nothing plays and is
 * reset by playback (browsing doesn't count). The last minute shows a notice with "Stay signed in".
 */
export function AutoSignOut() {
  const { autoSignOutMinutes, kidMode } = usePref('safety').value
  return autoSignOutMinutes > 0 ? <AutoSignOutTimer minutes={autoSignOutMinutes} lockPicker={kidMode} /> : null
}

/** `lockPicker`: like a manual sign-out in kid mode, remembered profiles then need their password again. */
function AutoSignOutTimer({ minutes, lockPicker }: { minutes: number; lockPicker: boolean }) {
  const { account } = useSignedIn()
  const { signOut } = useSession()
  const { status } = usePlayerState()
  const dispatch = usePlayerDispatch()
  const playing = status === 'playing'
  // 0 = not started yet; set when the timer first runs (not during render).
  const lastWatched = useRef(0)
  const [left, setLeft] = useState(minutes * 60)

  useEffect(() => {
    if (lastWatched.current === 0) lastWatched.current = Date.now()
    const tick = () => {
      if (playing) lastWatched.current = Date.now()
      const remaining = Math.ceil((lastWatched.current + minutes * 60_000 - Date.now()) / 1000)
      setLeft(remaining)
      if (remaining <= 0) {
        window.clearInterval(timer)
        dispatch({ type: 'stop' })
        void signOut(account.userId, { lockPicker })
      }
    }
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [playing, minutes, lockPicker, dispatch, signOut, account.userId])

  if (playing || left > WARN_S) return null
  return (
    <div role="alert" className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-amber-500/40 bg-neutral-900/95 px-4 py-2.5 text-sm shadow-2xl">
      <span className="text-amber-200 tabular-nums">Signing out in {Math.max(0, left)} s (nothing watched for {minutes} min)</span>
      <Button
        variant="primary"
        onClick={() => {
          lastWatched.current = Date.now()
          setLeft(minutes * 60)
        }}
      >
        Stay signed in
      </Button>
    </div>
  )
}
