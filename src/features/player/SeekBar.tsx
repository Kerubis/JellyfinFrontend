import { useState, type MouseEvent } from 'react'
import { formatTime, type PlayerCommand, type PlayerState } from '@/domain/player'
import { trickplayFrame, type Trickplay } from '@/domain/trickplay'

const SEGMENT_COLOR: Record<string, string> = {
  intro: 'bg-amber-300/45',
  recap: 'bg-amber-300/30',
  outro: 'bg-rose-300/40',
  preview: 'bg-rose-300/25',
}

/**
 * Seek bar with chapter gaps, intro/outro highlights and a hover tooltip (preview frame when the server
 * has trickplay images, time, chapter).
 * The visible track is drawn by us; an invisible native range input on top does the seeking
 * (keyboard and screen readers keep working).
 */
export function SeekBar({ state, dispatch }: { state: PlayerState; dispatch: (command: PlayerCommand) => void }) {
  const { position, duration, bufferedUntil, chapters, segments } = state
  const max = duration > 0 ? duration : 1
  const pct = (seconds: number) => `${Math.min(100, Math.max(0, (seconds / max) * 100))}%`
  const [hover, setHover] = useState<{ x: number; width: number; time: number } | null>(null)
  const trickplay = state.item?.trickplay

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHover({ x: ratio * rect.width, width: rect.width, time: ratio * max })
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
          className="pointer-events-none absolute bottom-6 -translate-x-1/2 overflow-hidden rounded bg-neutral-900/95 text-center text-xs whitespace-nowrap shadow-lg"
          // With a preview the tooltip is wide: keep it inside the bar instead of hanging off the screen edge.
          style={{ left: trickplay ? clampCenter(hover.x, PREVIEW_WIDTH / 2, hover.width) : hover.x }}
        >
          {trickplay && <TrickplayPreview trickplay={trickplay} seconds={hover.time} />}
          <div className="px-2 py-1">
            <div className="font-semibold tabular-nums">{formatTime(hover.time)}</div>
            {hoverChapter?.name && <div className="max-w-56 truncate text-neutral-300">{hoverChapter.name}</div>}
          </div>
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

/** Preview frame width in the tooltip (px); frames are scaled from the trickplay resolution. */
const PREVIEW_WIDTH = 208

function clampCenter(x: number, half: number, width: number) {
  return Math.min(Math.max(x, half), Math.max(half, width - half))
}

/** One frame of a trickplay sheet: the sheet as a scaled background, shifted to the frame. */
function TrickplayPreview({ trickplay, seconds }: { trickplay: Trickplay; seconds: number }) {
  const { url, x, y } = trickplayFrame(trickplay, seconds)
  const scale = PREVIEW_WIDTH / trickplay.width
  return (
    <div
      className="bg-black bg-no-repeat"
      style={{
        width: PREVIEW_WIDTH,
        height: Math.round(trickplay.height * scale),
        backgroundImage: `url("${url}")`,
        backgroundSize: `${trickplay.columns * trickplay.width * scale}px ${trickplay.rows * trickplay.height * scale}px`,
        backgroundPosition: `${-x * scale}px ${-y * scale}px`,
      }}
    />
  )
}
