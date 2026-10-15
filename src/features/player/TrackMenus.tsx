import { useState, type ReactNode } from 'react'
import { AudioTrackIcon, SubtitlesIcon } from '@/components/icons'
import type { PlayerCommand, PlayerState } from '@/domain/player'
import type { AudioStream, SubtitleStream } from '@/domain/tracks'
import { languageName } from '@/lib/languages'

type MenuProps = { state: PlayerState; dispatch: (command: PlayerCommand) => void }

export const ICON_BUTTON =
  'flex size-10 items-center justify-center rounded-full text-neutral-100 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-accent-400 disabled:opacity-40'

function audioLabel(a: AudioStream): string {
  const details = [a.title || a.codec?.toUpperCase(), a.channels ? `${a.channels} ch` : ''].filter(Boolean).join(' · ')
  return `${languageName(a.language)}${details ? ` · ${details}` : ''}`
}

const SUBTITLE_FORMATS: Record<string, string> = {
  ass: 'ASS',
  ssa: 'SSA',
  subrip: 'SRT',
  srt: 'SRT',
  webvtt: 'VTT',
  vtt: 'VTT',
  pgssub: 'PGS',
  hdmv_pgs_subtitle: 'PGS',
  dvdsub: 'VobSub',
  dvd_subtitle: 'VobSub',
  dvbsub: 'DVB',
  mov_text: 'TX3G',
}

/** "ASS", "SRT", "PGS", ... (unknown codecs in upper case). */
function subtitleFormat(s: SubtitleStream): string | undefined {
  const codec = s.codec?.toLowerCase()
  return codec ? (SUBTITLE_FORMATS[codec] ?? codec.toUpperCase()) : undefined
}

function subtitleLabel(s: SubtitleStream): string {
  const parts = [languageName(s.language), s.title, s.isForced && !/forced/i.test(s.title ?? '') ? 'forced' : '']
  return parts.filter(Boolean).join(' · ')
}

/** Popover anchored above a control-bar button. */
function Menu({ button, title, active, children }: { button: ReactNode; title: string; active: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        className={`${ICON_BUTTON} ${active ? 'text-accent-400' : ''}`}
        title={title}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {button}
      </button>
      {open && (
        <div className="absolute right-0 bottom-12 max-h-[60vh] w-80 overflow-y-auto rounded border border-white/10 bg-neutral-900/95 p-1 shadow-xl">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

function Option({ selected, onClick, children, hint }: { selected: boolean; onClick: () => void; children: ReactNode; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-baseline gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-white/10 ${selected ? 'text-accent-400' : ''}`}
    >
      <span className="w-3 shrink-0">{selected ? '✓' : ''}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[11px] text-neutral-500">{hint}</span>}
    </button>
  )
}

export function AudioMenu({ state, dispatch }: MenuProps) {
  const audio = state.tracks?.audio ?? []
  if (audio.length <= 1) return null
  const current = state.source?.audioStreamIndex
  return (
    <Menu title="Audio track" active={false} button={<AudioTrackIcon className="size-6" />}>
      {(close) =>
        audio.map((a) => (
          <Option
            key={a.index}
            selected={a.index === current}
            onClick={() => {
              dispatch({ type: 'setAudioTrack', index: a.index })
              close()
            }}
          >
            {audioLabel(a)}
          </Option>
        ))
      }
    </Menu>
  )
}

export function SubtitleMenu({ state, dispatch }: MenuProps) {
  const subtitles = state.tracks?.subtitles ?? []
  if (subtitles.length === 0) return null
  const current = state.subtitleIndex
  const choose = (index: number | null, close: () => void) => {
    dispatch({ type: 'setSubtitleTrack', index })
    close()
  }
  const offset = state.subtitleOffset
  return (
    <Menu title="Subtitles" active={current !== null} button={<SubtitlesIcon className="size-6" />}>
      {(close) => (
        <>
          <Option selected={current === null} onClick={() => choose(null, close)}>
            Off
          </Option>
          {subtitles.map((s) => (
            <Option key={s.index} selected={s.index === current} onClick={() => choose(s.index, close)} hint={s.isText ? undefined : 'burned in'}>
              {subtitleLabel(s)}
              {subtitleFormat(s) && <span className="ml-1.5 text-xs text-neutral-500">{subtitleFormat(s)}</span>}
            </Option>
          ))}
          <div className="mt-1 flex items-center gap-2 border-t border-white/10 px-3 pt-2 pb-1 text-sm">
            <span className="text-neutral-400">Delay</span>
            <button type="button" className="rounded bg-white/10 px-2 hover:bg-white/20" title="Earlier (G)" onClick={() => dispatch({ type: 'adjustSubtitleOffset', seconds: -0.1 })}>
              −0.1
            </button>
            <span className="w-14 text-center tabular-nums">{offset > 0 ? '+' : ''}{offset.toFixed(1)} s</span>
            <button type="button" className="rounded bg-white/10 px-2 hover:bg-white/20" title="Later (H)" onClick={() => dispatch({ type: 'adjustSubtitleOffset', seconds: 0.1 })}>
              +0.1
            </button>
            {offset !== 0 && (
              <button type="button" className="ml-auto text-xs text-accent-400 hover:underline" onClick={() => dispatch({ type: 'resetSubtitleOffset' })}>
                Reset
              </button>
            )}
          </div>
        </>
      )}
    </Menu>
  )
}
