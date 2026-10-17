// Framework-free player engine: owns the <video> element, hls.js, progress reporting and the single
// command dispatcher (PLAN.md D8). React only renders its state (PlayerProvider / PlayerOverlay).

import type Hls from 'hls.js'
import {
  INITIAL_PLAYER_STATE,
  type NowPlaying,
  type PlaybackReport,
  type PlaybackSource,
  type PlayerCommand,
  type PlayerState,
  type SourceRequest,
  type StartAt,
} from '@/domain/player'
import type { SkipMode } from '@/domain/prefs'
import { segmentAt, upNextTime, type Chapter, type Segment } from '@/domain/segments'
import { browserDefaultAudio, type MediaTracks, type TrackChoice } from '@/domain/tracks'
import { readJson, writeJson } from '@/lib/storage'

export type EngineDeps = {
  loadItem: (itemId: string) => Promise<LoadedItem>
  /** Intro/outro/... from the server, or derived from chapters. */
  getSegments: (item: NowPlaying, chapters: Chapter[]) => Promise<Segment[]>
  /** Current autoplay / skip settings (profile prefs). */
  autoplay: () => AutoplaySettings
  /** Soft limits: why new playback isn't allowed right now, or null. */
  playbackBlock: () => string | null
  getSource: (itemId: string, request: SourceRequest) => Promise<PlaybackSource>
  /** Picks audio/subtitle tracks from the language rules (per series, library, profile, Jellyfin). */
  resolveTracks: (item: NowPlaying, tracks: MediaTracks) => Promise<TrackChoice>
  /** The user picked a track by hand (remembered per series). */
  onTracksChosen?: (item: NowPlaying, tracks: MediaTracks, choice: TrackChoice) => void
  nextEpisodeId: (item: NowPlaying) => Promise<string | undefined>
  resumeMode: () => 'always' | 'ask' | 'startOver'
  /** Skip times for an item (per library / profile). */
  skipSeconds: (item: NowPlaying | undefined) => { back: number; forward: number }
  report: {
    start: (r: PlaybackReport) => Promise<void>
    progress: (r: PlaybackReport) => Promise<void>
    stopped: (r: PlaybackReport) => Promise<void>
    stoppedOnUnload: (r: PlaybackReport) => void
  }
  /** Playback actually started (first frame). */
  onStarted?: (item: NowPlaying) => void
  /** Playback of an item ended or was stopped (watch state changed on the server). */
  onStopped?: (item: NowPlaying) => void
}

type LoadedItem = { item: NowPlaying; resumeSeconds: number; tracks: MediaTracks; chapters: Chapter[] }

export type AutoplaySettings = {
  enabled: boolean
  countdownSeconds: number
  /** Ask "Still watching?" after this many autoplays without input; 0 = never. */
  stillWatchingAfter: number
  skipIntro: SkipMode
  skipOutro: SkipMode
}

/** Next episode, fetched while "Up next" counts down so the switch is instant. */
type Prefetched = { itemId: string; loaded: LoadedItem; choice: TrackChoice; source?: PlaybackSource; at: number }

const PROGRESS_INTERVAL_MS = 10_000
const PREFETCH_MAX_AGE_MS = 5 * 60_000
const VOLUME_KEY = 'jff.volume'

const warn = (what: string) => (error: unknown) => console.warn(`Player: ${what} failed`, error)

export class PlayerEngine {
  private state: PlayerState
  private readonly listeners = new Set<() => void>()
  private video: HTMLVideoElement | null = null
  private container: HTMLElement | null = null
  private hls: Hls | null = null
  /** Incremented per play command; async steps of an older command bail out. */
  private loadToken = 0
  /** Start was reported for the current source (so stop must be reported too). */
  private started = false
  private progressTimer: number | undefined
  private pendingResume: { token: number; item: NowPlaying; resumeSeconds: number } | null = null
  /** Tracks requested for the current item. */
  private choice: TrackChoice = { subtitleIndex: null }
  /** Segments already auto-skipped (or skipped by button) for the current item. */
  private handledSegments = new Set<Segment>()
  private upNextTimer: number | undefined
  /** "Up next" was cancelled for the current item. */
  private upNextDismissed = false
  /** Episodes started by autoplay since the last user input. */
  private autoplayStreak = 0
  private prefetched: Prefetched | null = null
  /** PlaybackInfo prefetched for the item being started (used once by startSource). */
  private presetSource: PlaybackSource | undefined

  private readonly deps: EngineDeps

  constructor(deps: EngineDeps) {
    this.deps = deps
    const saved = readJson<{ volume: number; muted: boolean }>(VOLUME_KEY, { volume: 1, muted: false })
    this.state = { ...INITIAL_PLAYER_STATE, volume: saved.volume, muted: saved.muted }
    this.setupMediaSession()
  }

  // --- store (useSyncExternalStore) ---

  getState = (): PlayerState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private set(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  // --- element wiring ---

  /** Connects the (single, persistent) <video> element. Returns a cleanup function. */
  attach(video: HTMLVideoElement, container: HTMLElement): () => void {
    this.video = video
    this.container = container
    video.volume = this.state.volume
    video.muted = this.state.muted

    const on = <K extends keyof HTMLMediaElementEventMap>(type: K, handler: () => void) => {
      video.addEventListener(type, handler)
      return () => video.removeEventListener(type, handler)
    }
    const offs = [
      on('timeupdate', () => {
        this.set({ position: video.currentTime })
        // Safety net: the video is visibly running but no `playing` event switched us out of "loading".
        if (this.state.status === 'loading' && !video.paused && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          this.onPlaying()
        }
        this.onTime(video.currentTime)
      }),
      on('durationchange', () => {
        if (Number.isFinite(video.duration)) this.set({ duration: video.duration })
      }),
      on('progress', () => {
        const ranges = video.buffered
        this.set({ bufferedUntil: ranges.length ? ranges.end(ranges.length - 1) : 0 })
      }),
      on('playing', () => this.onPlaying()),
      on('pause', () => {
        if (this.state.status === 'playing') {
          this.set({ status: 'paused' })
          this.reportProgress()
          this.pauseCountdown()
        }
      }),
      on('seeked', () => this.reportProgress()),
      on('ended', () => void this.onEnded()),
      on('volumechange', () => {
        this.set({ volume: video.volume, muted: video.muted })
        writeJson(VOLUME_KEY, { volume: video.volume, muted: video.muted })
      }),
      on('error', () => {
        if (this.state.status !== 'idle' && !this.hls) this.set({ status: 'error', error: 'The browser could not play this file.' })
      }),
    ]
    const onFullscreen = () => this.set({ fullscreen: document.fullscreenElement === container })
    document.addEventListener('fullscreenchange', onFullscreen)
    const onPageHide = () => {
      const report = this.currentReport()
      if (this.started && report) this.deps.report.stoppedOnUnload(report)
    }
    window.addEventListener('pagehide', onPageHide)

    return () => {
      offs.forEach((off) => off())
      document.removeEventListener('fullscreenchange', onFullscreen)
      window.removeEventListener('pagehide', onPageHide)
      void this.teardown()
      this.video = null
      this.container = null
    }
  }

  // --- commands ---

  dispatch = (command: PlayerCommand): void => {
    const video = this.video
    // Any command is user (or remote) input, which resets the "Still watching?" counter.
    this.autoplayStreak = 0
    switch (command.type) {
      case 'play':
        void this.play(command.itemId, command.startAt ?? 'auto')
        return
      case 'resolveResume':
        void this.resolveResume(command.resume)
        return
      case 'togglePause':
        if (!video || !this.state.source || this.state.limitReached) return
        if (video.paused) void video.play().catch(warn('play'))
        else video.pause()
        return
      case 'pause':
        video?.pause()
        return
      case 'unpause':
        if (video && this.state.source && !this.state.limitReached) void video.play().catch(warn('play'))
        return
      case 'seek':
        if (video && this.state.source) video.currentTime = this.clampTime(command.seconds)
        return
      case 'seekBy':
        if (video && this.state.source) video.currentTime = this.clampTime(video.currentTime + command.seconds)
        return
      case 'skipBack':
        this.dispatch({ type: 'seekBy', seconds: -this.deps.skipSeconds(this.state.item).back })
        return
      case 'skipForward':
        this.dispatch({ type: 'seekBy', seconds: this.deps.skipSeconds(this.state.item).forward })
        return
      case 'next':
        if (this.state.nextItemId) void this.play(this.state.nextItemId, 'auto')
        return
      case 'stop':
        void this.stop()
        return
      case 'setVolume':
        if (video) {
          video.volume = Math.min(1, Math.max(0, command.volume))
          video.muted = false
        }
        return
      case 'toggleMute':
        if (video) video.muted = !video.muted
        return
      case 'setView':
        if (command.view === 'mini' && document.fullscreenElement) void document.exitFullscreen()
        this.set({ view: command.view })
        return
      case 'toggleFullscreen':
        if (document.fullscreenElement) void document.exitFullscreen()
        else {
          this.set({ view: 'full' })
          void this.container?.requestFullscreen().catch(warn('fullscreen'))
        }
        return
      case 'setAudioTrack':
        void this.changeTracks({ ...this.choice, audioIndex: command.index })
        return
      case 'setSubtitleTrack':
        void this.changeTracks({ ...this.choice, subtitleIndex: command.index })
        return
      case 'adjustSubtitleOffset':
        this.set({ subtitleOffset: Math.round((this.state.subtitleOffset + command.seconds) * 10) / 10 })
        return
      case 'resetSubtitleOffset':
        this.set({ subtitleOffset: 0 })
        return
      case 'skipSegment':
        this.skipSegment()
        return
      case 'cancelUpNext':
        this.upNextDismissed = true
        window.clearTimeout(this.upNextTimer)
        this.set({ upNext: undefined })
        return
      case 'confirmStillWatching':
        this.set({ stillWatching: false })
        if (this.state.nextItemId) void this.play(this.state.nextItemId, 'auto')
        return
    }
  }

  // --- segments, "Up next", autoplay ---

  private onTime(time: number) {
    const { source, segments, duration, nextItemId, upNext, activeSegment } = this.state
    if (!source || this.state.status === 'loading') return
    const settings = this.deps.autoplay()

    const segment = segmentAt(segments, time)
    const mode = segment ? (segment.type === 'intro' || segment.type === 'recap' ? settings.skipIntro : settings.skipOutro) : 'off'
    if (segment && mode === 'auto' && !this.handledSegments.has(segment)) {
      this.handledSegments.add(segment)
      this.jumpPast(segment)
      return
    }
    const buttonSegment = segment && mode === 'button' && !this.handledSegments.has(segment) ? segment : undefined
    if (buttonSegment !== activeSegment) this.set({ activeSegment: buttonSegment })

    if (!nextItemId || duration <= 0 || this.upNextDismissed) return
    const showAt = upNextTime(segments, duration, settings.countdownSeconds)
    if (time >= showAt && !upNext) this.showUpNext(nextItemId, settings)
    else if (time < showAt - 1 && upNext) {
      // Seeked back before the credits: hide again (it reappears later).
      window.clearTimeout(this.upNextTimer)
      this.set({ upNext: undefined })
    }
  }

  /** Seeks past a segment; skipping credits that run to the end goes straight to the next episode. */
  private jumpPast(segment: Segment) {
    const { duration, nextItemId } = this.state
    if (segment.end >= duration - 1 && nextItemId && this.deps.autoplay().enabled && !this.upNextDismissed) {
      void this.autoAdvance()
      return
    }
    if (this.video) this.video.currentTime = this.clampTime(segment.end)
  }

  private skipSegment() {
    const segment = this.state.activeSegment
    if (!segment) return
    this.handledSegments.add(segment)
    this.set({ activeSegment: undefined })
    if (segment.end >= this.state.duration - 1 && this.state.nextItemId) {
      void this.play(this.state.nextItemId, 'auto')
      return
    }
    if (this.video) this.video.currentTime = this.clampTime(segment.end)
  }

  private showUpNext(itemId: string, settings: AutoplaySettings) {
    const counting = settings.enabled && this.state.status === 'playing'
    const deadline = counting ? Date.now() + settings.countdownSeconds * 1000 : null
    this.set({ upNext: { itemId, deadline, item: this.prefetched?.itemId === itemId ? this.prefetched.loaded.item : undefined } })
    window.clearTimeout(this.upNextTimer)
    if (deadline !== null) this.upNextTimer = window.setTimeout(() => void this.autoAdvance(), deadline - Date.now())
    void this.prefetch(itemId)
  }

  private pauseCountdown() {
    const upNext = this.state.upNext
    if (!upNext || upNext.deadline === null) return
    window.clearTimeout(this.upNextTimer)
    this.set({ upNext: { ...upNext, deadline: null } })
  }

  /** Countdown finished or the episode ended: start the next one, or ask "Still watching?". */
  private async autoAdvance() {
    window.clearTimeout(this.upNextTimer)
    const next = this.state.nextItemId
    if (!next || this.upNextDismissed) return
    const { stillWatchingAfter } = this.deps.autoplay()
    if (stillWatchingAfter > 0 && this.autoplayStreak >= stillWatchingAfter) {
      const upNext = this.state.upNext
      this.set({ stillWatching: true, upNext: upNext ? { ...upNext, deadline: null } : undefined })
      return
    }
    const blocked = this.deps.playbackBlock()
    if (blocked) {
      this.set({ limitReached: blocked, upNext: undefined })
      return
    }
    const streak = this.autoplayStreak + 1
    await this.play(next, 'auto')
    this.autoplayStreak = streak
  }

  /** Loads the next episode's item, tracks and PlaybackInfo ahead of time. */
  private async prefetch(itemId: string) {
    if (this.prefetched?.itemId === itemId && Date.now() - this.prefetched.at < PREFETCH_MAX_AGE_MS) return
    try {
      const loaded = await this.deps.loadItem(itemId)
      const choice = await this.deps.resolveTracks(loaded.item, loaded.tracks)
      const entry: Prefetched = { itemId, loaded, choice, at: Date.now() }
      this.prefetched = entry
      const upNext = this.state.upNext
      if (upNext?.itemId === itemId) this.set({ upNext: { ...upNext, item: loaded.item } })
      entry.source = await this.deps.getSource(itemId, this.sourceRequest(loaded.item, loaded.tracks, choice))
    } catch (error) {
      warn('prefetching the next episode')(error)
    }
  }

  private sourceRequest(item: NowPlaying, tracks: MediaTracks | undefined, choice: TrackChoice): SourceRequest {
    const audioIndex = choice.audioIndex
    return {
      ...choice,
      mediaSourceId: tracks?.mediaSourceId ?? item.id,
      // <video> can only play a file's default audio track; any other needs a server remux.
      allowDirectPlay: !tracks || audioIndex === undefined || audioIndex === browserDefaultAudio(tracks),
    }
  }

  /**
   * Manual track change. Text subtitles switch in the browser; a different audio track or an
   * image subtitle (burned in by the server) needs a new stream from the current position.
   */
  private async changeTracks(next: TrackChoice) {
    const { item, tracks, source } = this.state
    if (!item || !tracks || !source) return
    if (next.audioIndex === this.choice.audioIndex && next.subtitleIndex === this.choice.subtitleIndex) return
    this.choice = next
    this.deps.onTracksChosen?.(item, tracks, next)

    const subtitle = tracks.subtitles.find((s) => s.index === next.subtitleIndex)
    const needsNewStream =
      next.audioIndex !== source.audioStreamIndex || (subtitle && !subtitle.isText) || source.burnedIn
    this.set({ subtitleIndex: next.subtitleIndex })
    if (!needsNewStream) return

    const token = ++this.loadToken
    const position = this.video?.currentTime ?? this.state.position
    const reported = this.teardown()
    this.set({ status: 'loading', source: undefined })
    await reported
    try {
      await this.startSource(token, item, position)
    } catch (error) {
      if (token === this.loadToken) this.fail(error)
    }
  }

  // --- playback flow ---

  /** A soft limit was reached during playback (e.g. the daily budget): pause and explain. */
  enforceLimit(reason: string) {
    if (this.state.status === 'idle' || this.state.limitReached) return
    this.video?.pause()
    window.clearTimeout(this.upNextTimer)
    this.prefetched = null
    // Stop for real: the position is reported (next time resumes there) and the stream released. The state
    // (item + message) stays so the overlay can show why; its Close button resets the player.
    void this.teardown()
    this.set({ limitReached: reason, upNext: undefined, status: 'paused' })
  }

  private async play(itemId: string, startAt: StartAt) {
    const blocked = this.deps.playbackBlock()
    if (blocked) {
      await this.stop()
      this.set({ status: 'error', limitReached: blocked, view: 'full' })
      return
    }
    const token = ++this.loadToken
    this.pendingResume = null
    const previousSeries = this.state.item?.seriesId
    const previousOffset = this.state.subtitleOffset
    window.clearTimeout(this.upNextTimer)
    this.handledSegments = new Set()
    this.upNextDismissed = false
    const reported = this.teardown()
    this.set({
      status: 'loading',
      item: undefined,
      source: undefined,
      error: undefined,
      resumePrompt: undefined,
      nextItemId: undefined,
      position: 0,
      duration: 0,
      bufferedUntil: 0,
      view: 'full',
      tracks: undefined,
      subtitleIndex: null,
      subtitleOffset: 0,
      chapters: [],
      segments: [],
      activeSegment: undefined,
      upNext: undefined,
      stillWatching: false,
      limitReached: undefined,
    })
    // Spinner shows immediately; the server gets "stopped" for the old item before anything new starts.
    await reported
    try {
      const fresh = this.prefetched?.itemId === itemId && Date.now() - this.prefetched.at < PREFETCH_MAX_AGE_MS
      const prefetched = fresh ? this.prefetched : null
      this.prefetched = null
      const { item, resumeSeconds, tracks, chapters } = prefetched?.loaded ?? (await this.deps.loadItem(itemId))
      if (token !== this.loadToken) return
      this.choice =
        prefetched?.choice ??
        (await this.deps.resolveTracks(item, tracks).catch((error: unknown) => {
          warn('track selection')(error)
          return { audioIndex: tracks.defaultAudioIndex, subtitleIndex: tracks.defaultSubtitleIndex ?? null }
        }))
      if (token !== this.loadToken) return
      this.set({ item, tracks, chapters, subtitleIndex: this.choice.subtitleIndex, duration: item.durationSeconds ?? 0 })
      // A subtitle delay usually fits a whole release, so it carries over within the series.
      if (previousSeries && previousSeries === item.seriesId && previousOffset !== 0) this.set({ subtitleOffset: previousOffset })
      void this.deps
        .getSegments(item, chapters)
        .then((segments) => {
          if (token === this.loadToken) this.set({ segments })
        })
        .catch(warn('loading segments'))
      this.presetSource = prefetched?.source

      let start: number | null
      if (typeof startAt === 'number') start = startAt
      else if (startAt === 'beginning') start = 0
      else if (startAt === 'resume') start = resumeSeconds
      else {
        const mode = this.deps.resumeMode()
        start = mode === 'startOver' || resumeSeconds <= 0 ? 0 : mode === 'always' ? resumeSeconds : null
      }
      if (start === null) {
        this.pendingResume = { token, item, resumeSeconds }
        this.set({ resumePrompt: { positionSeconds: resumeSeconds } })
        return
      }
      await this.startSource(token, item, start)
    } catch (error) {
      if (token === this.loadToken) this.fail(error)
    }
  }

  private async resolveResume(resume: boolean) {
    const pending = this.pendingResume
    if (!pending || pending.token !== this.loadToken) return
    this.pendingResume = null
    this.set({ resumePrompt: undefined })
    try {
      await this.startSource(pending.token, pending.item, resume ? pending.resumeSeconds : 0)
    } catch (error) {
      if (pending.token === this.loadToken) this.fail(error)
    }
  }

  private async startSource(token: number, item: NowPlaying, startSeconds: number) {
    const preset = this.presetSource
    this.presetSource = undefined
    const source = preset ?? (await this.deps.getSource(item.id, this.sourceRequest(item, this.state.tracks, this.choice)))
    if (token !== this.loadToken) return
    const video = this.video
    if (!video) throw new Error('Player is not ready.')
    this.set({ source })
    this.started = false

    const nativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== ''
    if (source.kind === 'hls' && !nativeHls) {
      const { default: HlsJs } = await import('hls.js')
      if (token !== this.loadToken) return
      if (!HlsJs.isSupported()) throw new Error('This browser cannot play HLS streams.')
      const hls = new HlsJs({ startPosition: startSeconds })
      this.hls = hls
      let recoveries = 0
      hls.on(HlsJs.Events.ERROR, (_event, data) => {
        if (!data.fatal) return
        // A few retries for flaky networks; a server that keeps failing (e.g. a broken transcoder) is an error.
        if (recoveries++ < 2) {
          if (data.type === HlsJs.ErrorTypes.NETWORK_ERROR) return hls.startLoad()
          if (data.type === HlsJs.ErrorTypes.MEDIA_ERROR) return hls.recoverMediaError()
        }
        const status = data.response?.code
        this.fail(
          new Error(
            status && status >= 500
              ? `The server failed to prepare this stream (HTTP ${status}). Check the Jellyfin transcoding settings and its FFmpeg log.`
              : `Stream error: ${data.details}`,
          ),
        )
      })
      hls.loadSource(source.url)
      hls.attachMedia(video)
    } else {
      video.src = source.url
      if (startSeconds > 0) {
        video.addEventListener('loadedmetadata', () => (video.currentTime = startSeconds), { once: true })
      }
    }

    try {
      await video.play()
    } catch {
      // Autoplay can be blocked when the click was too long ago; the user presses play.
      if (token === this.loadToken) this.set({ status: 'paused' })
    }
    this.updateMediaSessionMetadata(item)
  }

  private onPlaying() {
    const { item, source, status } = this.state
    if (status === 'idle') return
    // The video runs, so the spinner goes regardless; reporting needs the item and its source.
    this.set({ status: 'playing' })
    if (!item || !source) return
    if (this.started) {
      this.reportProgress()
      return
    }
    this.started = true
    const report = this.currentReport()
    if (report) void this.deps.report.start(report).catch(warn('report start'))
    this.deps.onStarted?.(item)
    window.clearInterval(this.progressTimer)
    this.progressTimer = window.setInterval(() => this.reportProgress(), PROGRESS_INTERVAL_MS)
    const token = this.loadToken
    void this.deps
      .nextEpisodeId(item)
      .then((nextItemId) => {
        if (token === this.loadToken) this.set({ nextItemId })
      })
      .catch(warn('next episode lookup'))
  }

  private async onEnded() {
    const { item, nextItemId } = this.state
    this.set({ status: 'ended' })
    await this.reportStopped()
    if (item) this.deps.onStopped?.(item)
    if (nextItemId && this.deps.autoplay().enabled && !this.upNextDismissed && !this.state.stillWatching) void this.autoAdvance()
  }

  private async stop() {
    this.loadToken++
    this.pendingResume = null
    window.clearTimeout(this.upNextTimer)
    this.prefetched = null
    const { item } = this.state
    const wasStarted = this.started
    if (document.fullscreenElement) void document.exitFullscreen().catch(warn('exit fullscreen'))
    // Close right away; the server can take a while to confirm "stopped" (closing a large stream / transcode).
    const reported = this.teardown()
    this.set({ ...INITIAL_PLAYER_STATE, volume: this.state.volume, muted: this.state.muted })
    await reported
    // After the report, so refreshed lists see the saved position / watched state.
    if (wasStarted && item) this.deps.onStopped?.(item)
  }

  /**
   * Releases the stream right away; the returned promise settles once "stopped" is reported. The report
   * takes the final position synchronously (before its first await), i.e. before the video is unloaded.
   */
  private teardown(): Promise<void> {
    const reported = this.reportStopped()
    this.hls?.destroy()
    this.hls = null
    const video = this.video
    if (video?.getAttribute('src')) {
      video.removeAttribute('src')
      video.load()
    }
    return reported
  }

  private async reportStopped() {
    window.clearInterval(this.progressTimer)
    if (!this.started) return
    this.started = false
    const report = this.currentReport()
    if (report) await this.deps.report.stopped(report).catch(warn('report stopped'))
  }

  private reportProgress() {
    const report = this.started ? this.currentReport() : null
    if (report) void this.deps.report.progress(report).catch(warn('report progress'))
  }

  private currentReport(): PlaybackReport | null {
    const { source } = this.state
    const video = this.video
    if (!source || !video) return null
    return {
      source,
      positionSeconds: video.currentTime,
      isPaused: video.paused,
      isMuted: video.muted,
      volume: video.volume,
    }
  }

  private fail(error: unknown) {
    void this.teardown()
    this.set({ status: 'error', error: error instanceof Error ? error.message : 'Playback failed.' })
  }

  private clampTime(seconds: number): number {
    const max = this.state.duration || this.video?.duration || 0
    return Math.max(0, Math.min(max > 0 ? max - 0.5 : seconds, seconds))
  }

  // --- OS media keys / notifications ---

  private setupMediaSession() {
    if (!('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    const handle = (action: MediaSessionAction, command: PlayerCommand | ((d: MediaSessionActionDetails) => PlayerCommand)) => {
      try {
        session.setActionHandler(action, (details) => this.dispatch(typeof command === 'function' ? command(details) : command))
      } catch {
        // Action not supported by this browser.
      }
    }
    handle('play', { type: 'unpause' })
    handle('pause', { type: 'pause' })
    handle('stop', { type: 'stop' })
    handle('nexttrack', { type: 'next' })
    handle('seekbackward', (d) => (d.seekOffset ? { type: 'seekBy', seconds: -d.seekOffset } : { type: 'skipBack' }))
    handle('seekforward', (d) => (d.seekOffset ? { type: 'seekBy', seconds: d.seekOffset } : { type: 'skipForward' }))
    handle('seekto', (d) => ({ type: 'seek', seconds: d.seekTime ?? 0 }))
  }

  private updateMediaSessionMetadata(item: NowPlaying) {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.name,
      artist: item.seriesName ?? '',
      artwork: item.posterUrl ? [{ src: item.posterUrl }] : [],
    })
  }
}
