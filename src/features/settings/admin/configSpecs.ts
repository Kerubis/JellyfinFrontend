import type { FormSpec, Option } from '@/domain/adminSettings'

// The server settings pages, as data (rendered by ConfigForm). Field names are Jellyfin's configuration keys.

const SYSTEM = { kind: 'system' } as const
const named = (key: string) => ({ kind: 'named', key }) as const
const opts = (...values: string[]): Option[] => values.map((value) => ({ value, label: value }))

const HW_ACCEL: Option[] = [
  { value: 'none', label: 'None (software)' },
  { value: 'vaapi', label: 'VAAPI (Intel / AMD on Linux)' },
  { value: 'qsv', label: 'Intel Quick Sync (QSV)' },
  { value: 'nvenc', label: 'NVIDIA NVENC' },
  { value: 'amf', label: 'AMD AMF (Windows)' },
  { value: 'videotoolbox', label: 'Apple VideoToolbox' },
  { value: 'rkmpp', label: 'Rockchip MPP' },
  { value: 'v4l2m2m', label: 'Video4Linux2 (V4L2)' },
]
const hw = (v: Record<string, unknown>) => v.HardwareAccelerationType !== 'none'

export const GENERAL: FormSpec = {
  title: 'Server',
  source: SYSTEM,
  fields: [
    { kind: 'text', key: 'ServerName', label: 'Server name', hint: 'Shown in apps and on the login screen' },
    { kind: 'text', key: 'PreferredMetadataLanguage', label: 'Metadata language', placeholder: 'en', hint: 'Default for libraries without their own' },
    { kind: 'text', key: 'MetadataCountryCode', label: 'Metadata country', placeholder: 'US' },
    { kind: 'bool', key: 'QuickConnectAvailable', label: 'Allow Quick Connect', hint: 'Sign in a device by approving a code from a signed-in one' },
    { kind: 'number', key: 'LibraryMonitorDelay', label: 'Wait after a file change', min: 0, suffix: 's', hint: 'Before real-time monitoring rescans the folder' },
    { kind: 'number', key: 'ActivityLogRetentionDays', label: 'Keep activity log', min: 0, suffix: 'days' },
    { kind: 'number', key: 'LogFileRetentionDays', label: 'Keep log files', min: 1, suffix: 'days' },
    { kind: 'number', key: 'ParallelImageEncodingLimit', label: 'Parallel image encodings', min: 0, hint: '0 = automatic' },
  ],
}

export const BRANDING: FormSpec = {
  title: 'Branding',
  source: named('branding'),
  fields: [
    { kind: 'text', key: 'LoginDisclaimer', label: 'Login disclaimer', multiline: true, hint: 'Shown under the login form of the official apps' },
    { kind: 'text', key: 'CustomCss', label: 'Custom CSS', multiline: true, hint: 'For the official web client only' },
    { kind: 'bool', key: 'SplashscreenEnabled', label: 'Show a splash screen in the official apps' },
  ],
}

export const TRANSCODING: FormSpec = {
  title: 'Transcoding',
  source: named('encoding'),
  fields: [
    { kind: 'select', key: 'HardwareAccelerationType', label: 'Hardware acceleration', options: HW_ACCEL },
    { kind: 'text', key: 'VaapiDevice', label: 'VAAPI device', placeholder: '/dev/dri/renderD128', showIf: (v) => v.HardwareAccelerationType === 'vaapi' },
    { kind: 'text', key: 'QsvDevice', label: 'QSV device', placeholder: 'automatic', showIf: (v) => v.HardwareAccelerationType === 'qsv' },
    {
      kind: 'multi',
      key: 'HardwareDecodingCodecs',
      label: 'Decode in hardware',
      options: opts('h264', 'hevc', 'mpeg2video', 'mpeg4', 'vc1', 'vp8', 'vp9', 'av1'),
      hint: 'Only what the GPU can decode',
      showIf: hw,
    },
    { kind: 'bool', key: 'EnableDecodingColorDepth10Hevc', label: '10-bit HEVC decoding', showIf: hw },
    { kind: 'bool', key: 'EnableDecodingColorDepth10Vp9', label: '10-bit VP9 decoding', showIf: hw },
    { kind: 'bool', key: 'EnableHardwareEncoding', label: 'Encode in hardware', showIf: hw },
    { kind: 'bool', key: 'AllowHevcEncoding', label: 'Allow HEVC encoding', hint: 'Smaller streams for clients that support HEVC' },
    { kind: 'bool', key: 'AllowAv1Encoding', label: 'Allow AV1 encoding' },
    { kind: 'bool', key: 'EnableTonemapping', label: 'Tone mapping (HDR → SDR)' },
    {
      kind: 'select',
      key: 'TonemappingAlgorithm',
      label: 'Tone mapping algorithm',
      options: opts('bt2390', 'hable', 'mobius', 'reinhard', 'gamma', 'linear', 'clip', 'none'),
      showIf: (v) => v.EnableTonemapping === true,
    },
    { kind: 'select', key: 'EncoderPreset', label: 'Encoder preset', options: opts('auto', 'veryslow', 'slower', 'slow', 'medium', 'fast', 'faster', 'veryfast', 'superfast', 'ultrafast'), hint: 'Faster = less CPU, larger files' },
    { kind: 'number', key: 'H264Crf', label: 'H.264 quality (CRF)', min: 0, max: 51, hint: 'Lower = better quality, larger' },
    { kind: 'number', key: 'H265Crf', label: 'HEVC quality (CRF)', min: 0, max: 51 },
    { kind: 'number', key: 'EncodingThreadCount', label: 'Encoding threads', min: -1, hint: '-1 = automatic' },
    { kind: 'select', key: 'DeinterlaceMethod', label: 'Deinterlacing', options: opts('yadif', 'bwdif') },
    { kind: 'bool', key: 'EnableThrottling', label: 'Throttle transcodes', hint: 'Slow down once far enough ahead of playback (saves CPU)' },
    { kind: 'number', key: 'ThrottleDelaySeconds', label: 'Throttle after', min: 0, suffix: 's ahead', showIf: (v) => v.EnableThrottling === true },
    { kind: 'bool', key: 'EnableSegmentDeletion', label: 'Delete old segments', hint: 'Keeps the transcode folder small' },
    { kind: 'number', key: 'SegmentKeepSeconds', label: 'Keep segments for', min: 0, suffix: 's', showIf: (v) => v.EnableSegmentDeletion === true },
    { kind: 'bool', key: 'EnableSubtitleExtraction', label: 'Extract embedded subtitles on the fly' },
    { kind: 'number', key: 'DownMixAudioBoost', label: 'Down-mix volume boost', min: 0.5, max: 3, step: 0.1, hint: 'When surround sound is mixed to stereo' },
  ],
}

export const RESUME: FormSpec = {
  title: 'Resume',
  source: SYSTEM,
  fields: [
    { kind: 'number', key: 'MinResumePct', label: 'Remember the position from', min: 0, max: 100, suffix: '% watched', hint: 'Below this, stopping starts over next time' },
    { kind: 'number', key: 'MaxResumePct', label: 'Count as watched from', min: 1, max: 100, suffix: '% watched' },
    { kind: 'number', key: 'MinResumeDurationSeconds', label: 'Only for items longer than', min: 0, suffix: 's' },
  ],
}

export const STREAMING: FormSpec = {
  title: 'Streaming',
  source: SYSTEM,
  fields: [
    {
      kind: 'number',
      key: 'RemoteClientBitrateLimit',
      label: 'Bitrate limit outside the home network',
      min: 0,
      step: 0.5,
      scale: 1_000_000,
      suffix: 'Mbit/s (0 = none)',
      hint: 'Per stream; higher bitrates get transcoded down',
    },
  ],
}

export const TRICKPLAY: FormSpec = {
  title: 'Seek-bar previews (trickplay)',
  source: SYSTEM,
  note: 'Previews are only created for libraries where they are switched on (Libraries → options).',
  fields: [
    { kind: 'number', key: 'TrickplayOptions.Interval', label: 'One image every', min: 1, scale: 1000, suffix: 's' },
    { kind: 'numberList', key: 'TrickplayOptions.WidthResolutions', label: 'Image widths', placeholder: '320', hint: 'Pixels, comma-separated' },
    { kind: 'number', key: 'TrickplayOptions.TileWidth', label: 'Images per row in a sheet', min: 1 },
    { kind: 'number', key: 'TrickplayOptions.TileHeight', label: 'Rows per sheet', min: 1 },
    { kind: 'number', key: 'TrickplayOptions.JpegQuality', label: 'JPEG quality', min: 1, max: 100 },
    { kind: 'bool', key: 'TrickplayOptions.EnableHwAcceleration', label: 'Decode in hardware' },
    { kind: 'bool', key: 'TrickplayOptions.EnableHwEncoding', label: 'Encode in hardware' },
    { kind: 'bool', key: 'TrickplayOptions.EnableKeyFrameOnlyExtraction', label: 'Key frames only', hint: 'Much faster, less exact' },
    { kind: 'number', key: 'TrickplayOptions.ProcessThreads', label: 'Threads', min: 0 },
    { kind: 'select', key: 'TrickplayOptions.ProcessPriority', label: 'Process priority', options: opts('High', 'AboveNormal', 'Normal', 'BelowNormal', 'Idle') },
    { kind: 'select', key: 'TrickplayOptions.ScanBehavior', label: 'During library scans', options: [{ value: 'NonBlocking', label: "Don't wait for previews" }, { value: 'Blocking', label: 'Wait for previews' }] },
  ],
}

export const NETWORKING: FormSpec = {
  title: 'Networking',
  source: named('network'),
  note: 'Wrong values here can make the server unreachable (also for this app). Most changes need a restart.',
  savedNote: 'Restart the server to apply.',
  fields: [
    { kind: 'number', key: 'InternalHttpPort', label: 'HTTP port', min: 1, max: 65535 },
    { kind: 'number', key: 'PublicHttpPort', label: 'Public HTTP port', min: 1, max: 65535, hint: 'As seen from outside (port forwarding)' },
    { kind: 'text', key: 'BaseUrl', label: 'Base URL', placeholder: '/jellyfin', hint: 'Path prefix behind a reverse proxy' },
    { kind: 'bool', key: 'EnableHttps', label: 'Enable HTTPS' },
    { kind: 'number', key: 'InternalHttpsPort', label: 'HTTPS port', min: 1, max: 65535, showIf: (v) => v.EnableHttps === true },
    { kind: 'text', key: 'CertificatePath', label: 'Certificate (.pfx) path', showIf: (v) => v.EnableHttps === true },
    { kind: 'bool', key: 'RequireHttps', label: 'Require HTTPS for remote connections', showIf: (v) => v.EnableHttps === true },
    { kind: 'list', key: 'LocalNetworkSubnets', label: 'Home network subnets', placeholder: '172.16.100.0/24', hint: 'Empty = private address ranges' },
    { kind: 'list', key: 'KnownProxies', label: 'Known proxies', hint: 'Reverse proxies whose forwarded addresses are trusted' },
    { kind: 'bool', key: 'EnableRemoteAccess', label: 'Allow connections from outside the home network' },
    { kind: 'list', key: 'RemoteIPFilter', label: 'Remote address filter', showIf: (v) => v.EnableRemoteAccess === true },
    { kind: 'bool', key: 'IsRemoteIPFilterBlacklist', label: 'Filter is a block list (otherwise an allow list)', showIf: (v) => v.EnableRemoteAccess === true },
    { kind: 'bool', key: 'AutoDiscovery', label: 'Let apps find this server on the network' },
    { kind: 'bool', key: 'EnableUPnP', label: 'Automatic port forwarding (UPnP)' },
    { kind: 'bool', key: 'EnableIPv6', label: 'IPv6' },
  ],
}

export const LIBRARY_DISPLAY: FormSpec = {
  title: 'Library display',
  source: SYSTEM,
  fields: [
    { kind: 'bool', key: 'DisplaySpecialsWithinSeasons', label: 'Show specials within the seasons they aired in' },
    { kind: 'bool', key: 'EnableGroupingMoviesIntoCollections', label: 'Group movies into their collections' },
    { kind: 'bool', key: 'EnableGroupingShowsIntoCollections', label: 'Group shows into their collections' },
    { kind: 'bool', key: 'EnableFolderView', label: 'Folder view in the official apps' },
    { kind: 'bool', key: 'EnableExternalContentInSuggestions', label: 'External content in suggestions' },
  ],
}

export const METADATA_DEFAULTS: FormSpec = {
  title: 'Metadata',
  source: named('metadata'),
  fields: [{ kind: 'bool', key: 'UseFileCreationTimeForDateAdded', label: "Use the file's creation time as \"date added\"", hint: 'Otherwise the time the server found it' }],
}

export const METADATA_SAVING: FormSpec = {
  title: 'Saved artwork & metadata',
  source: SYSTEM,
  fields: [
    { kind: 'select', key: 'ImageSavingConvention', label: 'Artwork file names', options: [{ value: 'Legacy', label: 'Legacy (Jellyfin)' }, { value: 'Compatible', label: 'Compatible (Kodi / Emby)' }] },
    { kind: 'bool', key: 'SaveMetadataHidden', label: 'Save metadata files as hidden files' },
  ],
}

export const NFO: FormSpec = {
  title: 'NFO files',
  source: named('xbmcmetadata'),
  note: 'Only used for libraries that save NFO files (Libraries → options).',
  fields: [
    { kind: 'text', key: 'ReleaseDateFormat', label: 'Release date format', placeholder: 'yyyy-MM-dd' },
    { kind: 'bool', key: 'SaveImagePathsInNfo', label: 'Save image paths in NFO files' },
    { kind: 'bool', key: 'EnablePathSubstitution', label: 'Path substitution for image paths' },
    { kind: 'bool', key: 'EnableExtraThumbsDuplication', label: 'Copy extra fanart into extrathumbs' },
  ],
}
