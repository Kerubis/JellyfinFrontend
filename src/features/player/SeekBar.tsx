import { useState, type MouseEvent } from 'react'
import { formatTime, type PlayerCommand, type PlayerState } from '@/domain/player'

const SEGMENT_COLOR: Record<string, string> = {
  intro: 'bg-amber-300/45',
  recap: 'bg-amber-300/30',
  outro: 'bg-rose-300/40',
  preview: 'bg-rose-300/25',
}

/**
 * Seek bar with chapter gaps, intro/outro highlights and a hover tooltip (time + chapter).
 * The visible track is drawn by us; an invisible native range input on top does the seeking
 * (keyboard and screen readers keep working).
 */
export function SeekBar({ state, dispatch }: { state: PlayerState; dispatch: (command: PlayerCommand) => void }) {
  const { position, duration, bufferedUntil, chapters, segments } = state
  const max = duration > 0 ? duration : 1
  const pct = (seconds: number) => `${Math.min(100, Math.max(0, (seconds / max) * 100))}%`
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null)

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHover({ x: ratio * rect.width, time: ratio * max })
  }
  const hoverChapter = hover ? [...chapters].reverse().find((c) => c.start <= hover.time) : undefined
  const boundaries = chapters.filter((c) => c.start > 0.5 && c.start < max - 0.5)

  return (
    <div className="group/seek relative flex h-5 items-center" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      {/* Track */}
      <div className="relative h-1 w-full overflow-hidden rounded bg-white/20 transition-[height] group-hover/seek:h-1.5">
        <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: pct(bufferedUntil) }} />
        {segments.map((s) => (
          <div
            key={`${s.type}-${s.start}`}
            className={`absolute inset-y-0 ${SEGMENT_COLOR[s.type] ?? ''}`}
            style={{ left: pct(s.start), width: `calc(${pct(s.end)} - ${pct(s.start)})` }}
          />
        ))}
        <div className="absolute inset-y-0 left-0 bg-accent-500" style={{ width: pct(position) }} />
        {/* Chapter boundaries as small gaps */}
        {boundaries.map((c) => (
          <div key={c.start} className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-neutral-950/90" style={{ left: pct(c.start) }} />
        ))}
      </div>
      {/* Thumb */}
      <div
        className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-400 opacity-0 shadow transition-opacity group-hover/seek:opacity-100"
        style={{ left: pct(position) }}
      />
      {/* Hover tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute bottom-6 -translate-x-1/2 rounded bg-neutral-900/95 px-2 py-1 text-center text-xs whitespace-nowrap shadow-lg"
          style={{ left: hover.x }}
        >
          <div className="font-semibold tabular-nums">{formatTime(hover.time)}</div>
          {hoverChapter?.name && <div className="max-w-56 truncate text-neutral-300">{hoverChapter.name}</div>}
        </div>
      )}
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={Math.min(position, max)}
        onChange={(e) => dispatch({ type: 'seek', seconds: e.target.valueAsNumber })}
        aria-label="Seek"
        aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`}
        className="absolute inset-0 w-full cursor-pointer opacity-0"
      />
    </div>
  )
}
