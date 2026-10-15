import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useLocation } from 'react-router'
import { usePref } from '@/api/prefs-context'
import { Button } from '@/components/Button'
import { formatTime, type PlayerCommand, type PlayerState } from '@/domain/player'
import { BottomBar, MiniControls } from './PlayerControls'
import { usePlayerDispatch, usePlayerEngine, usePlayerState } from './player-context'
import { SubtitleOverlay } from './SubtitleOverlay'
import { useIdle } from './useIdle'
import { usePlayerShortcuts } from './usePlayerShortcuts'

/**
 * The persistent player, mounted outside the router outlet. There is exactly one <video> element;
 * switching between full view and mini player only changes CSS, so playback is never interrupted.
 */
export function PlayerOverlay() {
  const engine = usePlayerEngine()
  const state = usePlayerState()
  const dispatch = usePlayerDispatch()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const active = state.status !== 'idle'
  const full = state.view === 'full'
  const { idle, poke } = useIdle(3000, active && full && state.status === 'playing')

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return
    return engine.attach(video, container)
  }, [engine])

  usePlayerShortcuts(state, dispatch)
  useMinimizeOnNavigation(state, dispatch)
  const textTrack = useTextTrackModes(state, videoRef)
  const subtitleStyle = usePref('subtitles').value

  const containerClass = !active
    ? 'hidden'
    : full
      ? 'fixed inset-0 z-50 bg-black'
      : 'group fixed right-4 bottom-4 z-50 aspect-video w-96 overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/10'

  return (
    <div ref={containerRef} className={`${containerClass} ${full && idle ? 'cursor-none' : ''}`} onMouseMove={poke}>
      <video
        ref={videoRef}
        className="size-full object-contain"
        crossOrigin="anonymous"
        playsInline
        onClick={() => (full ? dispatch({ type: 'togglePause' }) : dispatch({ type: 'setView', view: 'full' }))}
        onDoubleClick={() => full && dispatch({ type: 'toggleFullscreen' })}
      >
        {state.source?.textTracks.map((t) => (
          <track key={`${state.source?.playSessionId}-${t.index}`} kind="subtitles" src={t.url} label={t.label} srcLang={t.language} data-index={t.index} />
        ))}
      </video>

      <SubtitleOverlay
        videoRef={videoRef}
        trackIndex={active ? textTrack : null}
        sourceKey={state.source?.playSessionId}
        offset={state.subtitleOffset}
        fontSize={full ? subtitleStyle.fontSize : Math.round(subtitleStyle.fontSize * 0.5)}
        background={subtitleStyle.background}
        position={subtitleStyle.position}
        raised={full && !idle}
      />

      <StatusLayer state={state} dispatch={dispatch} compact={!full} />

      {active && full && (
        <div className={`pointer-events-none absolute inset-0 flex flex-col justify-end transition-opacity ${idle ? 'opacity-0' : 'opacity-100'}`}>
          <div className="pointer-events-auto">
            <BottomBar state={state} dispatch={dispatch} />
          </div>
        </div>
      )}
      {active && !full && state.source && <MiniControls state={state} dispatch={dispatch} />}
    </div>
  )
}

/** Loading spinner, errors, the resume question and the "ended" screen. */
function StatusLayer({ state, dispatch, compact }: { state: PlayerState; dispatch: (c: PlayerCommand) => void; compact: boolean }) {
  const box = 'pointer-events-auto flex flex-col items-center gap-3 rounded-lg bg-black/80 p-5 text-center'
  let content: ReactNode = null

  if (state.resumePrompt) {
    content = (
      <div className={box}>
        <p className="text-sm">Resume where you stopped?</p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => dispatch({ type: 'resolveResume', resume: true })} autoFocus>
            Resume from {formatTime(state.resumePrompt.positionSeconds)}
          </Button>
          <Button onClick={() => dispatch({ type: 'resolveResume', resume: false })}>Start over</Button>
        </div>
      </div>
    )
  } else if (state.status === 'error') {
    content = (
      <div className={box}>
        <p className="max-w-sm text-sm text-red-300">{state.error}</p>
        <Button onClick={() => dispatch({ type: 'stop' })}>Close</Button>
      </div>
    )
  } else if (state.status === 'ended') {
    content = (
      <div className={box}>
        <p className="text-sm">Finished</p>
        <div className="flex gap-2">
          {state.nextItemId && (
            <Button variant="primary" onClick={() => dispatch({ type: 'next' })} autoFocus>
              Next episode
            </Button>
          )}
          <Button onClick={() => dispatch({ type: 'stop' })}>Close</Button>
        </div>
      </div>
    )
  } else if (state.status === 'loading') {
    content = <span className="size-12 animate-spin rounded-full border-4 border-white/20 border-t-accent-500" aria-label="Loading" />
  }

  if (!content) return null
  return (
    <div className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center ${compact ? 'scale-75' : ''}`}>
      {content}
    </div>
  )
}

/** Browsing elsewhere while something plays shrinks the player to the mini player. */
function useMinimizeOnNavigation(state: PlayerState, dispatch: (c: PlayerCommand) => void) {
  const { pathname } = useLocation()
  const previous = useRef(pathname)
  const shouldMinimize = state.status !== 'idle' && state.view === 'full'
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    if (shouldMinimize) dispatch({ type: 'setView', view: 'mini' })
  }, [pathname, shouldMinimize, dispatch])
}

/** Only the selected text track is loaded ("hidden": parsed and timed by the browser, drawn by us). */
function useTextTrackModes(state: PlayerState, videoRef: RefObject<HTMLVideoElement | null>) {
  const selected = state.source?.burnedIn ? null : state.subtitleIndex
  const source = state.source
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const apply = () => {
      video.querySelectorAll('track').forEach((el) => {
        el.track.mode = selected !== null && Number(el.dataset.index) === selected ? 'hidden' : 'disabled'
      })
    }
    apply()
    video.textTracks.addEventListener('addtrack', apply)
    return () => video.textTracks.removeEventListener('addtrack', apply)
  }, [selected, source, videoRef])
  return selected
}
