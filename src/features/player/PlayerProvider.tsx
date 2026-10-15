import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  buildDeviceProfile,
  getNextEpisodeId,
  getPlaybackSource,
  getSegments,
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
import { skipSeconds } from '@/domain/prefs'
import { hasLimits, localDate, playbackBlock, usedSecondsToday, type SafetyUsage } from '@/domain/safety'
import { chooseTracks, memoryFor, resolveRule } from '@/domain/tracks'
import { useHiddenFromWatching } from '@/hooks/useHiddenFromWatching'
import { detectCapabilities } from '@/lib/codecs'
import { getDevicePlaybackSettings } from './deviceSettings'
import { PlayerEngine } from './engine'
import { PlayerContext } from './player-context'

/** Keeps the synced prefs entry small. */
const MAX_REMEMBERED_SERIES = 300
const USAGE_TICK_S = 15
const USAGE_SAVE_S = 60

/** One player per signed-in profile; mounted above the router so navigation never stops playback. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { server, account } = useSignedIn()
  const queryClient = useQueryClient()
  const playback = usePref('playback').value
  const languages = usePref('languages').value
  const seriesTracks = usePref('seriesTracks')
  const safety = usePref('safety').value
  const safetyUsage = usePref('safetyUsage')
  const hidden = useHiddenFromWatching()

  // The engine is created once; these refs give it the latest prefs without recreating it.
  const resumeMode = useRef(playback.resume)
  const playbackRef = useRef(playback)
  const hiddenRef = useRef(hidden)
  const languagesRef = useRef(languages)
  const seriesTracksRef = useRef(seriesTracks)
  const safetyRef = useRef(safety)
  /** Today's usage incl. seconds not yet written to the prefs. */
  const usageRef = useRef(safetyUsage.value)
  useEffect(() => {
    resumeMode.current = playback.resume
    playbackRef.current = playback
    hiddenRef.current = hidden
    languagesRef.current = languages
    seriesTracksRef.current = seriesTracks
    safetyRef.current = safety
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
      getSegments: (item, chapters) => getSegments(server, account, item.id, chapters, item.durationSeconds ?? 0),
      playbackBlock: () => playbackBlock(safetyRef.current, usageRef.current, new Date()),
      autoplay: () => {
        const p = playbackRef.current
        return {
          enabled: p.autoplayNext,
          countdownSeconds: p.autoplayCountdownSeconds,
          stillWatchingAfter: p.stillWatchingAfterEpisodes,
          skipIntro: p.skipIntro,
          skipOutro: p.skipOutro,
        }
      },
      resumeMode: () => resumeMode.current,
      skipSeconds: (item) => skipSeconds(playbackRef.current, item?.libraryId),
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

  // Soft limits: count watch time (only for profiles with limits) and stop when the daily budget runs out.
  const limited = hasLimits(safety)
  const usageUpdateRef = useRef(safetyUsage.update)
  const storedUsage = safetyUsage.value
  useEffect(() => {
    usageUpdateRef.current = safetyUsage.update
  })
  // Usage counted on another device (synced) wins when it is further along.
  useEffect(() => {
    const local = usageRef.current
    if (storedUsage.date > local.date || (storedUsage.date === local.date && storedUsage.seconds > local.seconds)) {
      usageRef.current = storedUsage
    }
  }, [storedUsage])
  useEffect(() => {
    const updateUsage = (usage: SafetyUsage) => usageUpdateRef.current(usage)
    if (!limited) return
    let unsaved = 0
    const timer = window.setInterval(() => {
      const now = new Date()
      const today = localDate(now)
      if (engine.getState().status === 'playing') {
        const used = usedSecondsToday(usageRef.current, now) + USAGE_TICK_S
        usageRef.current = { date: today, seconds: used }
        unsaved += USAGE_TICK_S
        if (unsaved >= USAGE_SAVE_S) {
          unsaved = 0
          updateUsage(usageRef.current)
        }
      }
      const budgetUsed =
        safetyRef.current.dailyMinutes > 0 && usedSecondsToday(usageRef.current, now) >= safetyRef.current.dailyMinutes * 60
      if (budgetUsed) {
        if (unsaved > 0) updateUsage(usageRef.current)
        unsaved = 0
        engine.enforceLimit(playbackBlock(safetyRef.current, usageRef.current, now) ?? 'Time is up for today.')
      }
    }, USAGE_TICK_S * 1000)
    return () => {
      window.clearInterval(timer)
      if (unsaved > 0) updateUsage(usageRef.current)
    }
  }, [engine, limited])

  // Stop (and report) when the profile switches or the app unmounts.
  useEffect(() => () => engine.dispatch({ type: 'stop' }), [engine])

  return <PlayerContext.Provider value={engine}>{children}</PlayerContext.Provider>
}
