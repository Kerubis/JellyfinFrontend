import { useEffect } from 'react'
import type { PlayerCommand, PlayerState } from '@/domain/player'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) &&
  !(target instanceof HTMLInputElement && target.type === 'range')

/** Space/K play-pause · ←/→ skip back/forward (per library) · ↑/↓ volume · F fullscreen · M mute · N next · G/H subtitle delay · P picture-in-picture · Esc minimize. */
export function usePlayerShortcuts(state: PlayerState, dispatch: (command: PlayerCommand) => void, togglePip?: () => void) {
  const active = state.status !== 'idle'
  const { volume, view, fullscreen } = state

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
      if (event.key === 'p' && togglePip) {
        event.preventDefault()
        togglePip()
        return
      }
      const command = ((): PlayerCommand | null => {
        switch (event.key) {
          case ' ':
          case 'k':
            return { type: 'togglePause' }
          case 'ArrowLeft':
            return { type: 'skipBack' }
          case 'ArrowRight':
            return { type: 'skipForward' }
          case 'ArrowUp':
            return view === 'full' ? { type: 'setVolume', volume: volume + 0.1 } : null
          case 'ArrowDown':
            return view === 'full' ? { type: 'setVolume', volume: volume - 0.1 } : null
          case 'f':
            return { type: 'toggleFullscreen' }
          case 'm':
            return { type: 'toggleMute' }
          case 'n':
            return { type: 'next' }
          case 'g':
            return { type: 'adjustSubtitleOffset', seconds: -0.1 }
          case 'h':
            return { type: 'adjustSubtitleOffset', seconds: 0.1 }
          case 'Escape':
            // In browser fullscreen, Esc already leaves fullscreen.
            return view === 'full' && !fullscreen ? { type: 'setView', view: 'mini' } : null
          default:
            return null
        }
      })()
      if (!command) return
      event.preventDefault()
      dispatch(command)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, volume, view, fullscreen, dispatch, togglePip])
}
