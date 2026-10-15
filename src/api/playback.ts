import {
  CodecType,
  DlnaProfileType,
  EncodingContext,
  MediaStreamProtocol,
  PlayMethod as SdkPlayMethod,
  ProfileConditionType,
  ProfileConditionValue,
  SubtitleDeliveryMethod,
  type DeviceProfile,
  type MediaSourceInfo,
  type PlaybackProgressInfo,
} from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi, getMediaInfoApi, getMediaSegmentApi, getSessionApi, getShowApi, getUserApi } from '@jellyfin/sdk/lib/utils/api'
import type { Server, SignedInAccount } from '@/domain/auth'
import {
  TICKS_PER_SECOND,
  type DevicePlaybackSettings,
  type NowPlaying,
  type PlaybackReport,
  type PlaybackSource,
  type PlayMethod,
  type SourceRequest,
  type TextTrack,
} from '@/domain/player'
import { fromChapters, fromServerSegments, type Chapter, type Segment } from '@/domain/segments'
import { ruleFromJellyfin, type MediaTracks, type PartialRule } from '@/domain/tracks'
import { codecList, type BrowserCapabilities } from '@/lib/codecs'
import { apiFor, itemImageUrl, jellyfin } from './client'

// --- Device profile ----------------------------------------------------------------

/** Tells the server what this browser can play, so it only transcodes when needed. */
export function buildDeviceProfile(caps: BrowserCapabilities, settings: DevicePlaybackSettings): DeviceProfile {
  const maxBitrate = settings.maxBitrateMbps > 0 ? settings.maxBitrateMbps * 1_000_000 : 120_000_000
  const mp4Video = codecList({ h264: caps.video.h264, hevc: caps.video.hevc, av1: caps.video.av1, vp9: caps.video.vp9 })
  const audio = codecList(caps.audio)
  // Chromium's Matroska support goes through its WebM pipeline: no AC-3/E-AC-3 there.
  const mkvAudio = codecList({ ...caps.audio, ac3: false, eac3: false })
  const hlsVideo = codecList(caps.hlsVideo)
  const hlsAudio = codecList(caps.hlsAudio)

  const directPlay: DeviceProfile['DirectPlayProfiles'] = settings.forceTranscode
    ? []
    : [
        caps.containers.mp4 && { Container: 'mp4,m4v', Type: DlnaProfileType.Video, VideoCodec: mp4Video, AudioCodec: audio },
        caps.containers.webm && {
          Container: 'webm',
          Type: DlnaProfileType.Video,
          VideoCodec: codecList({ vp9: caps.video.vp9, av1: caps.video.av1 }) + ',vp8',
          AudioCodec: codecList({ opus: caps.audio.opus, vorbis: caps.audio.vorbis }),
        },
        caps.containers.mkv &&
          settings.allowMkvDirectPlay && { Container: 'mkv', Type: DlnaProfileType.Video, VideoCodec: mp4Video, AudioCodec: mkvAudio },
      ].filter((p) => !!p)

  return {
    Name: `${jellyfin.clientInfo.name} (${jellyfin.deviceInfo.name})`,
    MaxStreamingBitrate: maxBitrate,
    MaxStaticBitrate: maxBitrate,
    DirectPlayProfiles: directPlay,
    TranscodingProfiles: [
      {
        Container: 'mp4',
        Type: DlnaProfileType.Video,
        Protocol: MediaStreamProtocol.Hls,
        Context: EncodingContext.Streaming,
        VideoCodec: hlsVideo || 'h264',
        AudioCodec: hlsAudio || 'aac',
        MaxAudioChannels: '2',
        MinSegments: 1,
        BreakOnNonKeyFrames: true,
      },
    ],
    CodecProfiles: [
      // Browsers can't decode 10-bit H.264 (Hi10P, common in older anime releases): transcode it.
      {
        Type: CodecType.Video,
        Codec: 'h264',
        Conditions: [
          { Condition: ProfileConditionType.LessThanEqual, Property: ProfileConditionValue.VideoBitDepth, Value: '8', IsRequired: false },
        ],
      },
    ],
    // Text subtitles are delivered as files (rendered by us, so no burn-in); image subtitles are burned in.
    SubtitleProfiles: [
      ...['vtt', 'srt', 'subrip', 'ass', 'ssa'].map((Format) => ({ Format, Method: SubtitleDeliveryMethod.External })),
      ...['pgssub', 'dvdsub', 'dvbsub'].map((Format) => ({ Format, Method: SubtitleDeliveryMethod.Encode })),
    ],
    ContainerProfiles: [],
  }
}

// --- Item + PlaybackInfo ------------------------------------------------------------

export function toMediaTracks(source: MediaSourceInfo): MediaTracks {
  const streams = source.MediaStreams ?? []
  return {
    mediaSourceId: source.Id ?? '',
    defaultAudioIndex: source.DefaultAudioStreamIndex ?? undefined,
    defaultSubtitleIndex: source.DefaultSubtitleStreamIndex ?? undefined,
    audio: streams
      .filter((s) => s.Type === 'Audio')
      .map((s) => ({
        index: s.Index ?? 0,
        language: s.Language ?? undefined,
        title: s.Title ?? undefined,
        codec: s.Codec ?? undefined,
        channels: s.Channels ?? undefined,
        isDefault: !!s.IsDefault,
      })),
    subtitles: streams
      .filter((s) => s.Type === 'Subtitle')
      .map((s) => ({
        index: s.Index ?? 0,
        language: s.Language ?? undefined,
        title: s.Title ?? undefined,
        codec: s.Codec ?? undefined,
        isForced: !!s.IsForced,
        isDefault: !!s.IsDefault,
        isText: !!s.IsTextSubtitleStream,
        isExternal: !!s.IsExternal,
      })),
  }
}

/**
 * Item metadata, the saved resume position (the item endpoint's UserData is reliable, D15), its
 * audio/subtitle streams and the library it lives in.
 */
export async function loadPlayableItem(
  server: Server,
  account: SignedInAccount,
  itemId: string,
): Promise<{ item: NowPlaying; resumeSeconds: number; tracks: MediaTracks; chapters: Chapter[] }> {
  const library = getLibraryApi(apiFor(server.url, account.accessToken))
  const [{ data }, ancestors] = await Promise.all([
    library.getItem({ itemId, userId: account.userId }),
    library.getAncestors({ itemId, userId: account.userId }).then(
      (r) => r.data,
      () => [],
    ),
  ])
  const kind = data.Type === 'Episode' ? 'episode' : data.Type === 'Movie' ? 'movie' : 'other'
  const posterUrl =
    kind === 'episode' && data.SeriesId
      ? itemImageUrl(server.url, data.SeriesId, data.SeriesPrimaryImageTag, { maxWidth: 300 })
      : itemImageUrl(server.url, itemId, data.ImageTags?.Primary, { maxWidth: 300 })
  const source = data.MediaSources?.[0]
  return {
    item: {
      id: itemId,
      kind,
      name: data.Name ?? 'Untitled',
      seriesId: data.SeriesId ?? undefined,
      seriesName: data.SeriesName ?? undefined,
      seasonNumber: data.ParentIndexNumber ?? undefined,
      episodeNumber: data.IndexNumber ?? undefined,
      posterUrl,
      durationSeconds: data.RunTimeTicks ? data.RunTimeTicks / TICKS_PER_SECOND : undefined,
      libraryId: ancestors.find((a) => a.Type === 'CollectionFolder')?.Id ?? undefined,
    },
    resumeSeconds: (data.UserData?.PlaybackPositionTicks ?? 0) / TICKS_PER_SECOND,
    tracks: source ? toMediaTracks(source) : { mediaSourceId: itemId, audio: [], subtitles: [] },
    chapters: (data.Chapters ?? []).map((c) => ({ name: c.Name ?? '', start: (c.StartPositionTicks ?? 0) / TICKS_PER_SECOND })),
  }
}

/**
 * Intro/outro/recap/preview: Jellyfin's media segments when a provider plugin supplies them,
 * otherwise derived from chapter names ("OP", "ED", ...).
 */
export async function getSegments(
  server: Server,
  account: SignedInAccount,
  itemId: string,
  chapters: readonly Chapter[],
  durationSeconds: number,
): Promise<Segment[]> {
  try {
    const { data } = await getMediaSegmentApi(apiFor(server.url, account.accessToken)).getItemSegments({ itemId })
    const segments = fromServerSegments(data.Items ?? [])
    if (segments.length > 0) return segments
  } catch {
    // No segment support on the server: fall through to chapters.
  }
  return fromChapters(chapters, durationSeconds)
}

function textTracks(server: Server, account: SignedInAccount, itemId: string, source: MediaSourceInfo): TextTrack[] {
  return (source.MediaStreams ?? [])
    .filter((s) => s.Type === 'Subtitle' && s.IsTextSubtitleStream)
    .map((s) => ({
      index: s.Index ?? 0,
      label: s.DisplayTitle ?? s.Title ?? s.Language ?? `Subtitle ${s.Index}`,
      language: s.Language ?? undefined,
      // Jellyfin converts any text format to WebVTT on request.
      url: `${server.url}/Videos/${itemId}/${source.Id}/Subtitles/${s.Index}/0/Stream.vtt?api_key=${account.accessToken}`,
      assUrl: ASS_CODECS.has(s.Codec?.toLowerCase() ?? '')
        ? `${server.url}/Videos/${itemId}/${source.Id}/Subtitles/${s.Index}/0/Stream.${s.Codec?.toLowerCase()}?api_key=${account.accessToken}`
        : undefined,
      isDefault: s.Index === source.DefaultSubtitleStreamIndex,
    }))
}

const ASS_CODECS = new Set(['ass', 'ssa'])
const FONT_FILE = /\.(ttf|otf|ttc|woff2?)$/i

/** Fonts embedded in the file (MKV attachments), served by Jellyfin per attachment index. */
function fontUrls(server: Server, account: SignedInAccount, itemId: string, source: MediaSourceInfo): string[] {
  return (source.MediaAttachments ?? [])
    .filter((a) => /font|opentype|truetype/i.test(a.MimeType ?? '') || FONT_FILE.test(a.FileName ?? ''))
    .map((a) => `${server.url}/Videos/${itemId}/${source.Id}/Attachments/${a.Index}?api_key=${account.accessToken}`)
}

/**
 * Asks the server how to play the item with the chosen tracks (direct play vs. HLS) and builds the
 * stream URL. Track indices only take effect together with MediaSourceId (verified on 12.2).
 */
export async function getPlaybackSource(
  server: Server,
  account: SignedInAccount,
  itemId: string,
  profile: DeviceProfile,
  settings: DevicePlaybackSettings,
  request: SourceRequest,
): Promise<PlaybackSource> {
  const subtitleIndex = request.subtitleIndex ?? -1
  const directPlay = request.allowDirectPlay && !settings.forceTranscode
  const { data } = await getMediaInfoApi(apiFor(server.url, account.accessToken)).getPostedPlaybackInfo({
    itemId,
    userId: account.userId,
    mediaSourceId: request.mediaSourceId,
    audioStreamIndex: request.audioIndex,
    subtitleStreamIndex: subtitleIndex,
    playbackInfoDto: {
      UserId: account.userId,
      DeviceProfile: profile,
      MaxStreamingBitrate: profile.MaxStreamingBitrate,
      MediaSourceId: request.mediaSourceId,
      AudioStreamIndex: request.audioIndex,
      SubtitleStreamIndex: subtitleIndex,
      EnableDirectPlay: directPlay,
      EnableDirectStream: directPlay,
      EnableTranscoding: true,
      AutoOpenLiveStream: true,
    },
  })
  if (data.ErrorCode) throw new Error(`Playback not possible: ${data.ErrorCode}`)
  const source = data.MediaSources?.find((s) => s.Id === request.mediaSourceId) ?? data.MediaSources?.[0]
  const playSessionId = data.PlaySessionId ?? ''
  if (!source?.Id) throw new Error('The server returned no playable source.')

  const chosenSubtitle = source.MediaStreams?.find((s) => s.Type === 'Subtitle' && s.Index === request.subtitleIndex)
  const common = {
    itemId,
    mediaSourceId: source.Id,
    playSessionId,
    audioStreamIndex: request.audioIndex,
    subtitleStreamIndex: request.subtitleIndex ?? undefined,
    burnedIn: !!chosenSubtitle && !chosenSubtitle.IsTextSubtitleStream,
    textTracks: textTracks(server, account, itemId, source),
    fontUrls: fontUrls(server, account, itemId, source),
  }
  const staticUrl = () =>
    `${server.url}/Videos/${itemId}/stream?${new URLSearchParams({
      static: 'true',
      mediaSourceId: source.Id ?? '',
      deviceId: jellyfin.deviceInfo.id,
      playSessionId,
      api_key: account.accessToken,
      ...(source.ETag ? { Tag: source.ETag } : {}),
    })}`

  if (source.SupportsDirectPlay && directPlay) {
    return { ...common, url: staticUrl(), kind: 'direct', playMethod: 'DirectPlay' }
  }
  if (source.TranscodingUrl) {
    const method: PlayMethod = source.SupportsDirectStream ? 'DirectStream' : 'Transcode'
    return { ...common, url: `${server.url}${source.TranscodingUrl}`, kind: 'hls', playMethod: method }
  }
  if (source.SupportsDirectStream && directPlay) {
    return { ...common, url: staticUrl(), kind: 'direct', playMethod: 'DirectStream' }
  }
  throw new Error('This file can neither be played directly nor transcoded.')
}

/** Jellyfin's own audio/subtitle language settings for the user (the lowest rule layer). */
export async function getUserLanguageRule(server: Server, account: SignedInAccount): Promise<PartialRule> {
  const { data } = await getUserApi(apiFor(server.url, account.accessToken)).getCurrentUser()
  return ruleFromJellyfin(data.Configuration ?? {})
}

/**
 * The episode after this one in series order. From a regular episode, specials (season 0) in
 * between are skipped; from a special, the next item in order is taken as is.
 */
export async function getNextEpisodeId(server: Server, account: SignedInAccount, item: NowPlaying): Promise<string | undefined> {
  if (item.kind !== 'episode' || !item.seriesId) return undefined
  const shows = getShowApi(apiFor(server.url, account.accessToken))
  const skipSpecials = item.seasonNumber !== 0
  let currentId = item.id
  for (let hop = 0; hop < 10; hop++) {
    const { data } = await shows.getEpisodes({
      seriesId: item.seriesId,
      userId: account.userId,
      adjacentTo: currentId,
      isMissing: false,
      enableImages: false,
      enableUserData: false,
    })
    const items = data.Items ?? []
    const index = items.findIndex((e) => e.Id === currentId)
    const next = index >= 0 ? items[index + 1] : undefined
    if (!next?.Id) return undefined
    if (!(skipSpecials && next.ParentIndexNumber === 0)) return next.Id
    currentId = next.Id
  }
  return undefined
}

// --- Reporting (keeps watch state + "now playing" on the server correct) ---------------------

function toProgressInfo({ source, positionSeconds, isPaused, isMuted, volume }: PlaybackReport): PlaybackProgressInfo {
  return {
    ItemId: source.itemId,
    MediaSourceId: source.mediaSourceId,
    PlaySessionId: source.playSessionId,
    PositionTicks: Math.round(positionSeconds * TICKS_PER_SECOND),
    IsPaused: isPaused,
    IsMuted: isMuted,
    VolumeLevel: Math.round(volume * 100),
    PlayMethod: SdkPlayMethod[source.playMethod],
    AudioStreamIndex: source.audioStreamIndex,
    SubtitleStreamIndex: source.subtitleStreamIndex,
    CanSeek: true,
  }
}

export async function reportStart(server: Server, account: SignedInAccount, report: PlaybackReport) {
  await getSessionApi(apiFor(server.url, account.accessToken)).reportPlaybackStart({ playbackStartInfo: toProgressInfo(report) })
}

export async function reportProgress(server: Server, account: SignedInAccount, report: PlaybackReport) {
  await getSessionApi(apiFor(server.url, account.accessToken)).reportPlaybackProgress({ playbackProgressInfo: toProgressInfo(report) })
}

/** Also ends the server-side transcode for this play session. */
export async function reportStopped(server: Server, account: SignedInAccount, report: PlaybackReport) {
  const info = toProgressInfo(report)
  await getSessionApi(apiFor(server.url, account.accessToken)).reportPlaybackStopped({
    playbackStopInfo: {
      ItemId: info.ItemId,
      MediaSourceId: info.MediaSourceId,
      PlaySessionId: info.PlaySessionId,
      PositionTicks: info.PositionTicks,
    },
  })
}

/** Best-effort "stopped" while the page unloads (normal requests get cancelled there). */
export function reportStoppedOnUnload(server: Server, account: SignedInAccount, report: PlaybackReport) {
  const info = toProgressInfo(report)
  const body = JSON.stringify({
    ItemId: info.ItemId,
    MediaSourceId: info.MediaSourceId,
    PlaySessionId: info.PlaySessionId,
    PositionTicks: info.PositionTicks,
  })
  navigator.sendBeacon(
    `${server.url}/Sessions/Playing/Stopped?api_key=${encodeURIComponent(account.accessToken)}`,
    new Blob([body], { type: 'application/json' }),
  )
}
