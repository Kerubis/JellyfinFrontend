import { usePref } from '@/api/prefs-context'
import { PlayIcon } from '@/components/PlayOverlay'
import {
  BackIcon,
  CastIcon,
  CloseIcon,
  ExpandIcon,
  ForwardIcon,
  FullscreenIcon,
  MinimizeIcon,
  NextIcon,
  PipIcon,
  PauseIcon,
  StopIcon,
  VolumeIcon,
} from '@/components/icons'
import { skipSeconds } from '@/domain/prefs'
import { formatTime, nowPlayingTitle, type PlayerCommand, type PlayerState } from '@/domain/player'
import { NowPlayingLinks } from './NowPlayingLinks'
import { SeekBar } from './SeekBar'
import { AudioMenu, ICON_BUTTON, SubtitleMenu } from './TrackMenus'
import type { RemoteState } from './useRemotePlayback'

type Props = {
  state: PlayerState
  dispatch: (command: PlayerCommand) => void
}

/** Skip times for the playing item's library (for labels; the engine resolves the same values). */
function useSkipSeconds(state: PlayerState) {
  return skipSeconds(usePref('playback').value, state.item?.libraryId)
}

/** Thin vertical divider between groups of control-bar buttons. */
function Separator() {
  return <span aria-hidden className="mx-1.5 h-6 w-px shrink-0 bg-white/25" />
}

type CastProps = {
  cast?: { state: RemoteState; prompt: () => void }
  pip?: { supported: boolean; active: boolean; toggle: () => void }
}

export function BottomBar({ state, dispatch, cast, pip }: Props & CastProps) {
  const skip = useSkipSeconds(state)
  const playing = state.status === 'playing'
  const ready = !!state.source
  const method = state.source?.playMethod
  return (
    <div className="flex flex-col gap-1 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pt-12 pb-3">
      <SeekBar state={state} dispatch={dispatch} />
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center gap-1">
          <button type="button" className={ICON_BUTTON} title={`Back ${skip.back} s (←)`} disabled={!ready} onClick={() => dispatch({ type: 'skipBack' })}>
            <BackIcon seconds={skip.back} className="size-6" />
          </button>
          <button
            type="button"
            className={`${ICON_BUTTON} size-12`}
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
            disabled={!ready}
            onClick={() => dispatch({ type: 'togglePause' })}
          >
            {playing ? <PauseIcon className="size-7" /> : <PlayIcon className="size-7" />}
          </button>
          <button type="button" className={ICON_BUTTON} title={`Forward ${skip.forward} s (→)`} disabled={!ready} onClick={() => dispatch({ type: 'skipForward' })}>
            <ForwardIcon seconds={skip.forward} className="size-6" />
          </button>
          <button type="button" className={ICON_BUTTON} title="Next episode (N)" disabled={!state.nextItemId} onClick={() => dispatch({ type: 'next' })}>
            <NextIcon className="size-6" />
          </button>
          <button type="button" className={ICON_BUTTON} title="Stop" onClick={() => dispatch({ type: 'stop' })}>
            <StopIcon className="size-6" />
          </button>
          <Separator />
          <span className="ml-2 text-sm whitespace-nowrap text-neutral-200 tabular-nums">
            {formatTime(state.position)} <span className="text-neutral-500">/ {formatTime(state.duration)}</span>
          </span>
        </div>

        <div className="min-w-0 max-w-[40vw] text-center">
          <NowPlayingLinks state={state} dispatch={dispatch} />
        </div>

        <div className="flex items-center justify-end gap-1">
          {method && (
            <span className="mr-2 hidden text-xs text-neutral-500 lg:inline">
              {method === 'DirectPlay' ? 'Direct play' : method === 'DirectStream' ? 'Remux' : 'Transcode'}
            </span>
          )}
          <button type="button" className={ICON_BUTTON} title="Mute (M)" onClick={() => dispatch({ type: 'toggleMute' })}>
            <VolumeIcon muted={state.muted || state.volume === 0} className="size-6" />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={state.muted ? 0 : state.volume}
            onChange={(e) => dispatch({ type: 'setVolume', volume: e.target.valueAsNumber })}
            aria-label="Volume"
            className="mr-1 w-24 accent-accent-500"
          />
          <AudioMenu state={state} dispatch={dispatch} />
          <SubtitleMenu state={state} dispatch={dispatch} />
          <Separator />
          <button type="button" className={ICON_BUTTON} title="Mini player (Esc)" onClick={() => dispatch({ type: 'setView', view: 'mini' })}>
            <MinimizeIcon className="size-6" />
          </button>
          {pip?.supported && (
            <button
              type="button"
              className={`${ICON_BUTTON} ${pip.active ? 'text-accent-400' : ''}`}
              title={pip.active ? 'Back from picture-in-picture (P)' : 'Picture-in-picture (P)'}
              disabled={!state.source}
              onClick={pip.toggle}
            >
              <PipIcon active={pip.active} className="size-6" />
            </button>
          )}
          {cast && cast.state !== 'unavailable' && (
            <button
              type="button"
              className={`${ICON_BUTTON} ${cast.state === 'connected' ? 'text-accent-400' : ''} ${cast.state === 'connecting' ? 'animate-pulse' : ''}`}
              title={cast.state === 'connected' ? 'Casting – click to stop or switch' : 'Cast to a device'}
              onClick={cast.prompt}
            >
              <CastIcon active={cast.state === 'connected'} className="size-6" />
            </button>
          )}
          <button type="button" className={ICON_BUTTON} title="Fullscreen (F)" onClick={() => dispatch({ type: 'toggleFullscreen' })}>
            <FullscreenIcon active={state.fullscreen} className="size-6" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function MiniControls({ state, dispatch }: Pick<Props, 'state' | 'dispatch'>) {
  const skip = useSkipSeconds(state)
  const playing = state.status === 'playing'
  const { title, subtitle } = nowPlayingTitle(state.item)
  const progress = state.duration > 0 ? state.position / state.duration : 0
  return (
    <>
      {/* Clicking the picture (not a button) expands the player. */}
      <div
        className="absolute inset-0 flex cursor-pointer flex-col justify-between bg-black/50 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
        onClick={(e) => e.target === e.currentTarget && dispatch({ type: 'setView', view: 'full' })}
      >
        <div className="flex items-start gap-1 p-1">
          <div className="min-w-0 flex-1 px-1 pt-1">
            <div className="truncate text-xs font-semibold">{title}</div>
            {subtitle && <div className="truncate text-[11px] text-neutral-300">{subtitle}</div>}
          </div>
          <button type="button" className={`${ICON_BUTTON} size-8`} title="Expand" onClick={() => dispatch({ type: 'setView', view: 'full' })}>
            <ExpandIcon />
          </button>
          <button type="button" className={`${ICON_BUTTON} size-8`} title="Stop" onClick={() => dispatch({ type: 'stop' })}>
            <CloseIcon />
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 pb-3">
          <button type="button" className={ICON_BUTTON} title={`Back ${skip.back} s`} onClick={() => dispatch({ type: 'skipBack' })}>
            <BackIcon seconds={skip.back} />
          </button>
          <button type="button" className={`${ICON_BUTTON} size-12 bg-accent-600/90 text-black hover:bg-accent-500`} title={playing ? 'Pause' : 'Play'} onClick={() => dispatch({ type: 'togglePause' })}>
            {playing ? <PauseIcon className="size-6" /> : <PlayIcon className="size-6" />}
          </button>
          <button type="button" className={ICON_BUTTON} title="Next episode" disabled={!state.nextItemId} onClick={() => dispatch({ type: 'next' })}>
            <NextIcon />
          </button>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
        <div className="h-full bg-accent-500" style={{ width: `${progress * 100}%` }} />
      </div>
    </>
  )
}
