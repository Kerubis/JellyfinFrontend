import type { MouseEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { PlayerCommand, PlayerState } from '@/domain/player'
import { episodePath, seasonPath, seriesPath } from '@/features/home/links'

const LINK = 'rounded hover:text-accent-300 hover:underline focus-visible:outline-2 focus-visible:outline-accent-400'
const pad = (n: number) => String(n).padStart(2, '0')

/** Series / season / episode title in the control bar; a click shrinks to the mini player and opens the page. */
export function NowPlayingLinks({ state, dispatch }: { state: PlayerState; dispatch: (command: PlayerCommand) => void }) {
  const navigate = useNavigate()
  const item = state.item
  if (!item) return null

  const go = (path: string) => (e: MouseEvent) => {
    e.preventDefault()
    dispatch({ type: 'setView', view: 'mini' })
    navigate(path)
  }
  const link = (path: string, children: ReactNode, title?: string) => (
    <a href={path} onClick={go(path)} className={LINK} title={title}>
      {children}
    </a>
  )

  if (item.kind !== 'episode' || !item.seriesId) {
    return <div className="truncate text-sm font-semibold">{link(`/item/${item.id}`, item.name)}</div>
  }
  const { seriesId, seasonNumber, episodeNumber } = item
  return (
    <>
      <div className="truncate text-sm font-semibold">{link(seriesPath(seriesId), item.seriesName ?? 'Series', 'Open series')}</div>
      <div className="truncate text-xs text-neutral-300">
        {seasonNumber !== undefined && link(seasonPath(seriesId, { number: seasonNumber }), `S${pad(seasonNumber)}`, 'Open season')}
        {seasonNumber !== undefined && ' '}
        {link(episodePath(item.id, seriesId), episodeNumber !== undefined ? `E${pad(episodeNumber)} · ${item.name}` : item.name, 'Open episode')}
      </div>
    </>
  )
}
