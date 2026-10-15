import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  buildDeviceProfile,
  getNextEpisodeId,
  getPlaybackSource,
  getUserLanguageRule,
  loadPlayableItem,
  reportProgress,
  reportStart,
  reportStopped,
  reportStoppedOnUnload,
} from '@/api/playback'
import { usePref } from '@/api/prefs-context'
import { watchKeys } from '@/api/queries/home'
import { useSignedIn } from '@/api/session-context'
import { chooseTracks, memoryFor, resolveRule } from '@/domain/tracks'
import { useHiddenFromWatching } from '@/hooks/useHiddenFromWatching'
import { detectCapabilities } from '@/lib/codecs'
import { getDevicePlaybackSettings } from './deviceSettings'
import { PlayerEngine } from './engine'
import { PlayerContext } from './player-context'

/** Keeps the synced prefs entry small. */
const MAX_REMEMBERED_SERIES = 300

/** One player per signed-in profile; mounted above the router so navigation never stops playback. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { server, account } = useSignedIn()
  const queryClient = useQueryClient()
  const playback = usePref('playback').value
  const languages = usePref('languages').value
  const seriesTracks = usePref('seriesTracks')
  const hidden = useHiddenFromWatching()

  // The engine is created once; these refs give it the latest prefs without recreating it.
  const resumeMode = useRef(playback.resume)
  const hiddenRef = useRef(hidden)
  const languagesRef = useRef(languages)
  const seriesTracksRef = useRef(seriesTracks)
  useEffect(() => {
    resumeMode.current = playback.resume
    hiddenRef.current = hidden
    languagesRef.current = languages
    seriesTracksRef.current = seriesTracks
  })

  const [engine] = useState(() => {
    const caps = detectCapabilities()
    return new PlayerEngine({
      loadItem: (itemId) => loadPlayableItem(server, account, itemId),
      getSource: (itemId, request) => {
        const settings = getDevicePlaybackSettings()
        return getPlaybackSource(server, account, itemId, buildDeviceProfile(caps, settings), settings, request)
      },
      resolveTracks: async (item, tracks) => {
        const userRule = await queryClient
          .fetchQuery({
            queryKey: ['user', account.userId, 'languageConfig'],
            queryFn: () => getUserLanguageRule(server, account),
            staleTime: 10 * 60_000,
          })
          .catch(() => ({}))
        const { global, libraries } = languagesRef.current
        const rule = resolveRule([item.libraryId ? libraries[item.libraryId] : undefined, global, userRule])
        const memory = item.seriesId ? seriesTracksRef.current.profile.entries[item.seriesId] : undefined
        return chooseTracks(tracks, rule, memory)
      },
      onTracksChosen: (item, tracks, choice) => {
        // Remember per series (by language + title), so the next episodes get the same tracks.
        if (!item.seriesId) return
        const pref = seriesTracksRef.current
        const entries = { ...pref.profile.entries, [item.seriesId]: { ...memoryFor(tracks, choice), at: new Date().toISOString() } }
        const newest = Object.entries(entries)
          .sort(([, a], [, b]) => b.at.localeCompare(a.at))
          .slice(0, MAX_REMEMBERED_SERIES)
        pref.update({ entries: Object.fromEntries(newest) })
      },
      nextEpisodeId: (item) => getNextEpisodeId(server, account, item),
      resumeMode: () => resumeMode.current,
      report: {
        start: (r) => reportStart(server, account, r),
        progress: (r) => reportProgress(server, account, r),
        stopped: (r) => reportStopped(server, account, r),
        stoppedOnUnload: (r) => reportStoppedOnUnload(server, account, r),
      },
      onStarted: (item) => {
        // Watching something hidden brings it back to Currently Watching right away.
        const id = item.seriesId ?? item.id
        if (hiddenRef.current.hiddenIds.includes(id)) hiddenRef.current.unhide(id)
      },
      onStopped: (item) => {
        const keys = watchKeys(account.userId)
        for (const key of Object.values(keys)) void queryClient.invalidateQueries({ queryKey: key })
        if (item.seriesId) void queryClient.invalidateQueries({ queryKey: ['user', account.userId, 'series', item.seriesId] })
      },
    })
  })

  // Stop (and report) when the profile switches or the app unmounts.
  useEffect(() => () => engine.dispatch({ type: 'stop' }), [engine])

  return <PlayerContext.Provider value={engine}>{children}</PlayerContext.Provider>
}
