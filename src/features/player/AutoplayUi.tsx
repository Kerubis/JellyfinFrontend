import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { NextIcon } from '@/components/icons'
import { PlayIcon } from '@/components/PlayOverlay'
import { episodeLabel } from '@/domain/media'
import type { PlayerCommand, PlayerState } from '@/domain/player'
import { SEGMENT_LABEL } from '@/domain/segments'

type Props = { state: PlayerState; dispatch: (command: PlayerCommand) => void; raised: boolean }

/** Bottom-right offset: above the control bar while it is visible. */
const bottom = (raised: boolean) => (raised ? '8rem' : '2.5rem')

/** "Skip intro" / "Skip credits" … when the skip mode for that segment is "button". */
export function SkipSegmentButton({ state, dispatch, raised }: Props) {
  const segment = state.activeSegment
  if (!segment || state.upNext) return null
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: 'skipSegment' })}
      className="absolute right-6 z-20 flex items-center gap-2 rounded bg-white/90 px-4 py-2 text-sm font-semibold text-black shadow-xl transition-[bottom] duration-200 hover:bg-white"
      style={{ bottom: bottom(raised) }}
    >
      {SEGMENT_LABEL[segment.type]}
      <NextIcon className="size-4" />
    </button>
  )
}

/** Seconds left until `deadline` (ms timestamp), re-rendering while it runs. */
function useSecondsLeft(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline === null) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [deadline])
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
}

/** "Up next" card with countdown, Play now and Cancel. */
export function UpNextCard({ state, dispatch, raised, showSpoilers, countdownSeconds }: Props & { showSpoilers: boolean; countdownSeconds: number }) {
  const upNext = state.upNext
  const left = useSecondsLeft(upNext?.deadline ?? null)
  if (!upNext) return null
  const next = upNext.item
  const label = next ? episodeLabel(next) : ''
  const progress = left === null ? 0 : 1 - left / Math.max(1, countdownSeconds)

  return (
    <div
      className="absolute right-6 z-20 flex w-80 gap-3 overflow-hidden rounded-lg border border-white/10 bg-neutral-900/95 p-3 shadow-2xl transition-[bottom] duration-200"
      style={{ bottom: bottom(raised) }}
    >
      <div className="aspect-[2/3] w-16 shrink-0 overflow-hidden rounded bg-neutral-800">
        {next?.posterUrl && <img src={next.posterUrl} alt="" className="size-full object-cover" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-[11px] font-semibold tracking-wide text-accent-400 uppercase">
          Up next{left !== null && <span className="text-neutral-400 normal-case"> · in {left} s</span>}
        </div>
        <div className="truncate text-sm font-medium">{next?.seriesName ?? next?.name ?? 'Next episode'}</div>
        <div className="truncate text-xs text-neutral-400">{[label, showSpoilers ? next?.name : ''].filter(Boolean).join(' · ')}</div>
        <div className="mt-auto flex gap-2 pt-1">
          <Button variant="primary" className="flex items-center gap-1.5" onClick={() => dispatch({ type: 'next' })} autoFocus>
            <PlayIcon className="size-4" /> Play now
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: 'cancelUpNext' })}>
            Cancel
          </Button>
        </div>
      </div>
      {left !== null && (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
          <span className="block h-full bg-accent-500 transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </span>
      )}
    </div>
  )
}
