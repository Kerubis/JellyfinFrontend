import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useLocation } from 'react-router'
import { usePref } from '@/api/prefs-context'
import { Button } from '@/components/Button'
import { formatTime, type PlayerCommand, type PlayerState } from '@/domain/player'
import { hasLimits, limitWarning, secondsUntilBedtime } from '@/domain/safety'
import { SkipSegmentButton, UpNextCard } from './AutoplayUi'
import { BottomBar, MiniControls } from './PlayerControls'
import { usePlayerDispatch, usePlayerEngine, usePlayerState } from './player-context'
import { SubtitleOverlay } from './SubtitleOverlay'
import { useDevicePlaybackSettings } from './deviceSettings'
import { useAssRenderer } from './useAssRenderer'
import { useIdle } from './useIdle'
import { usePictureInPicture } from './usePictureInPicture'
import { useRemotePlayback } from './useRemotePlayback'
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

  const pip = usePictureInPicture(videoRef)
  usePlayerShortcuts(state, dispatch, pip.toggle)
  useMinimizeOnNavigation(state, dispatch)
  const textTrack = useTextTrackModes(state, videoRef, pip.active)
  const { styledAss } = useDevicePlaybackSettings()[0]
  const assUrl = styledAss && textTrack !== null ? state.source?.textTracks.find((t) => t.index === textTrack)?.assUrl : undefined
  const assActive = useAssRenderer(videoRef, {
    subUrl: active ? assUrl : undefined,
    fontUrls: state.source?.fontUrls ?? [],
    offset: state.subtitleOffset,
  })
  const cast = useRemotePlayback(videoRef, state.source?.playSessionId)
  const subtitleStyle = usePref('subtitles').value
  const playback = usePref('playback').value
  const limitNotice = useLimitNotice(active)
  const { showSpoilers } = usePref('ui').value

  const containerClass = !active
    ? 'hidden'
    : full
      ? 'fixed inset-0 z-50 bg-black'
      : 'group fixed right-4 bottom-4 z-50 aspect-video w-216 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/10'

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
        trackIndex={active && !assActive ? textTrack : null}
        sourceKey={state.source?.playSessionId}
        offset={state.subtitleOffset}
        fontSize={full ? subtitleStyle.fontSize : Math.round(subtitleStyle.fontSize * 0.5)}
        background={subtitleStyle.background}
        position={subtitleStyle.position}
        raised={full && !idle}
      />

      <StatusLayer state={state} dispatch={dispatch} compact={!full} />

      {active && full && limitNotice && !state.limitReached && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/80 px-4 py-1.5 text-sm text-amber-200 shadow-lg">
          {limitNotice}
        </div>
      )}

      {active && full && (
        <>
          <SkipSegmentButton state={state} dispatch={dispatch} raised={!idle} />
          <UpNextCard
            state={state}
            dispatch={dispatch}
            raised={!idle}
            showSpoilers={showSpoilers}
            countdownSeconds={playback.autoplayCountdownSeconds}
          />
        </>
      )}

      {active && full && (
        <div className={`pointer-events-none absolute inset-0 flex flex-col justify-end transition-opacity ${idle ? 'opacity-0' : 'opacity-100'}`}>
          <div className="pointer-events-auto">
            <BottomBar state={state} dispatch={dispatch} cast={cast} pip={pip} />
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

  if (state.limitReached) {
    content = (
      <div className={box}>
        <p className="text-base font-semibold">That's it for now</p>
        <p className="max-w-sm text-sm text-neutral-300">{state.limitReached}</p>
        <Button variant="primary" onClick={() => dispatch({ type: 'stop' })} autoFocus>
          OK
        </Button>
      </div>
    )
  } else if (state.stillWatching) {
    content = (
      <div className={box}>
        <p className="text-base font-semibold">Still watching?</p>
        <p className="text-xs text-neutral-400">Autoplay paused after several episodes without any input.</p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => dispatch({ type: 'confirmStillWatching' })} autoFocus>
            Continue
          </Button>
          <Button onClick={() => dispatch({ type: 'stop' })}>Stop</Button>
        </div>
      </div>
    )
  } else if (state.resumePrompt) {
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

/** Heads-up before a soft limit (bedtime / daily budget): every second in the last 10 minutes before bedtime, else every 30 s. */
function useLimitNotice(active: boolean): string | null {
  const safety = usePref('safety').value
  const usage = usePref('safetyUsage').value
  const [now, setNow] = useState(() => new Date())
  const watched = active && hasLimits(safety)
  useEffect(() => {
    if (!watched) return
    let timer = 0
    const tick = () => {
      const next = new Date()
      setNow(next)
      const untilBed = secondsUntilBedtime(safety.bedtime, next)
      timer = window.setTimeout(tick, untilBed !== null && untilBed <= 11 * 60 ? 1000 : 30_000)
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [watched, safety.bedtime])
  return watched ? limitWarning(safety, usage, now) : null
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

/**
 * Only the selected text track is loaded: "hidden" (parsed and timed by the browser, drawn by our
 * overlay), or "showing" in picture-in-picture, where only the browser's own rendering is visible.
 */
function useTextTrackModes(state: PlayerState, videoRef: RefObject<HTMLVideoElement | null>, nativeRendering: boolean) {
  const selected = state.source?.burnedIn ? null : state.subtitleIndex
  const source = state.source
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const apply = () => {
      video.querySelectorAll('track').forEach((el) => {
        const chosen = selected !== null && Number(el.dataset.index) === selected
        el.track.mode = chosen ? (nativeRendering ? 'showing' : 'hidden') : 'disabled'
      })
    }
    apply()
    video.textTracks.addEventListener('addtrack', apply)
    return () => video.textTracks.removeEventListener('addtrack', apply)
  }, [selected, source, videoRef, nativeRendering])
  return nativeRendering ? null : selected
}
