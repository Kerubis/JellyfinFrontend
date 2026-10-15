import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import type { PlayerCommand, PlayerState, StartAt } from '@/domain/player'
import type { PlayerEngine } from './engine'

export const PlayerContext = createContext<PlayerEngine | null>(null)

function useEngine(): PlayerEngine {
  const engine = useContext(PlayerContext)
  if (!engine) throw new Error('Player hooks must be used inside <PlayerProvider>')
  return engine
}

export function usePlayerState(): PlayerState {
  const engine = useEngine()
  return useSyncExternalStore(engine.subscribe, engine.getState)
}

/** The single entry point for controlling playback (UI, keyboard, media keys, later remote control). */
export function usePlayerDispatch(): (command: PlayerCommand) => void {
  return useEngine().dispatch
}

/** Convenience: start playing an item. `startAt` defaults to the profile's resume behaviour. */
export function usePlay(): (itemId: string, startAt?: StartAt) => void {
  const dispatch = usePlayerDispatch()
  return useCallback((itemId, startAt) => dispatch({ type: 'play', itemId, startAt }), [dispatch])
}

/** The engine itself, for the overlay that owns the <video> element. */
export function usePlayerEngine(): PlayerEngine {
  return useEngine()
}
