import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  /** Stream index of the selected text track, or null when subtitles are off. */
  trackIndex: number | null
  /** Bumped when the source changes, so the track lookup runs again. */
  sourceKey: string | undefined
  /** Subtitle delay in seconds (positive = later). */
  offset: number
  fontSize: number
  /** Opacity of the box behind each line (0 = text shadow only). */
  background: number
  /** Distance from the bottom in % while the controls are hidden. */
  position: number
  /** Lift the text above the visible control bar. */
  raised: boolean
}

/**
 * Draws the active cues of the selected text track ourselves (the browser only parses them, mode
 * "hidden"), so we control line spacing, size, position and delay.
 */
export function SubtitleOverlay({ videoRef, trackIndex, sourceKey, offset, fontSize, background, position, raised }: Props) {
  const [cues, setCues] = useState<VTTCue[]>([])

  useEffect(() => {
    const video = videoRef.current
    if (!video || trackIndex === null) {
      setCues([])
      return
    }
    // Poll per frame instead of "cuechange", so a delay can shift the timing.
    let frame = 0
    let shown = ''
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const element = Array.from(video.querySelectorAll('track')).find((el) => Number(el.dataset.index) === trackIndex)
      const all = element?.track.cues
      const time = video.currentTime - offset
      const active: VTTCue[] = []
      if (all) {
        for (let i = 0; i < all.length; i++) {
          const cue = all[i] as VTTCue
          if (cue.startTime <= time && time < cue.endTime) active.push(cue)
        }
      }
      const key = active.map((c) => `${c.startTime}:${c.text}`).join('|')
      if (key !== shown) {
        shown = key
        setCues(active)
      }
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [videoRef, trackIndex, sourceKey, offset])

  if (cues.length === 0) return null
  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1 px-[5%] text-center transition-[bottom] duration-200"
      style={{ bottom: raised ? '7rem' : `${position}%`, fontSize }}
    >
      {cues.map((cue, i) => (
        <CueText key={`${cue.startTime}-${i}`} cue={cue} background={background} />
      ))}
    </div>
  )
}

/** One cue; the browser's own VTT parser builds the (sanitized) markup, e.g. <i> and <b>. */
function CueText({ cue, background }: { cue: VTTCue; background: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    ref.current?.replaceChildren(cue.getCueAsHTML())
  }, [cue])
  return (
    <p className="max-w-full leading-[1.2] font-medium whitespace-pre-line text-white">
      {/* Inline background with box-decoration-break: tight boxes per line, no gaps of their own. */}
      <span
        ref={ref}
        className="rounded-sm px-[0.35em] py-[0.05em] [box-decoration-break:clone] [-webkit-box-decoration-break:clone] [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]"
        style={{ backgroundColor: `rgb(0 0 0 / ${background})` }}
      />
    </p>
  )
}
