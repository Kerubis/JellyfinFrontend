// What this browser can decode, so the server only transcodes when it has to.

export type BrowserCapabilities = {
  /** Containers <video> can play directly. */
  containers: { mp4: boolean; webm: boolean; mkv: boolean }
  video: { h264: boolean; hevc: boolean; av1: boolean; vp9: boolean }
  audio: { aac: boolean; mp3: boolean; opus: boolean; flac: boolean; vorbis: boolean; ac3: boolean; eac3: boolean }
  /** HLS via Media Source Extensions (hls.js) or natively (Safari). */
  hls: 'mse' | 'native' | false
  /** Codecs usable inside HLS fMP4 segments (MSE). */
  hlsVideo: { h264: boolean; hevc: boolean; av1: boolean }
  hlsAudio: { aac: boolean; opus: boolean; flac: boolean }
}

const isChromium = () => /Chrome\//.test(navigator.userAgent)

export function detectCapabilities(): BrowserCapabilities {
  const video = document.createElement('video')
  const can = (type: string) => video.canPlayType(type) !== ''
  const mse = (type: string) => typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(type)

  const h264 = can('video/mp4; codecs="avc1.640029"')
  return {
    containers: {
      mp4: can('video/mp4'),
      webm: can('video/webm'),
      // Chromium plays Matroska through its WebM demuxer even though canPlayType says no.
      mkv: can('video/x-matroska') || can('video/mkv') || isChromium(),
    },
    video: {
      h264,
      // Main10, so 10-bit HEVC (common for anime) qualifies.
      hevc: can('video/mp4; codecs="hvc1.2.4.L120.90"') || can('video/mp4; codecs="hev1.2.4.L120.90"'),
      av1: can('video/mp4; codecs="av01.0.08M.10"'),
      vp9: can('video/webm; codecs="vp9"') || can('video/mp4; codecs="vp09.00.10.08"'),
    },
    audio: {
      aac: can('audio/mp4; codecs="mp4a.40.2"'),
      mp3: can('audio/mpeg'),
      opus: can('audio/webm; codecs="opus"') || can('audio/mp4; codecs="opus"'),
      flac: can('audio/flac') || can('audio/mp4; codecs="flac"'),
      vorbis: can('audio/webm; codecs="vorbis"'),
      ac3: can('audio/mp4; codecs="ac-3"'),
      eac3: can('audio/mp4; codecs="ec-3"'),
    },
    hls: typeof MediaSource !== 'undefined' ? 'mse' : can('application/vnd.apple.mpegurl') ? 'native' : false,
    hlsVideo: {
      h264: mse('video/mp4; codecs="avc1.640029"') || h264,
      hevc: mse('video/mp4; codecs="hvc1.2.4.L120.90"'),
      av1: mse('video/mp4; codecs="av01.0.08M.10"'),
    },
    hlsAudio: {
      aac: mse('audio/mp4; codecs="mp4a.40.2"') || can('audio/mp4; codecs="mp4a.40.2"'),
      opus: mse('audio/mp4; codecs="opus"'),
      flac: mse('audio/mp4; codecs="flac"'),
    },
  }
}

/** "h264,hevc" from { h264: true, hevc: true, av1: false }. */
export function codecList(flags: Record<string, boolean>): string {
  return Object.entries(flags)
    .filter(([, ok]) => ok)
    .map(([codec]) => codec)
    .join(',')
}
