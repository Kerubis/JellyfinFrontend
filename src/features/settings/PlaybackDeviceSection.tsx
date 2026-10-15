import { useState } from 'react'
import { CheckboxField, SelectField } from '@/components/form'
import { useDevicePlaybackSettings } from '@/features/player/deviceSettings'
import { codecList, detectCapabilities } from '@/lib/codecs'

const BITRATES = [
  { value: '0', label: 'Automatic (no limit)' },
  { value: '80', label: '80 Mbps' },
  { value: '40', label: '40 Mbps' },
  { value: '20', label: '20 Mbps' },
  { value: '10', label: '10 Mbps' },
  { value: '4', label: '4 Mbps' },
]

/** Playback settings stored only on this device (they depend on the screen, browser and network). */
export function PlaybackDeviceSection() {
  const [settings, update] = useDevicePlaybackSettings()
  const [caps] = useState(detectCapabilities)
  const containers = codecList(caps.containers).replaceAll(',', ', ')
  const video = codecList(caps.video).replaceAll(',', ', ')
  const audio = codecList(caps.audio).replaceAll(',', ', ')

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">Playback on this device</h2>
      <SelectField
        label="Max streaming bitrate"
        value={String(settings.maxBitrateMbps)}
        options={BITRATES}
        onChange={(v) => update({ maxBitrateMbps: Number(v) })}
      />
      <CheckboxField
        label="Play MKV files directly (Chromium-based browsers)"
        checked={settings.allowMkvDirectPlay}
        onChange={(v) => update({ allowMkvDirectPlay: v })}
      />
      <CheckboxField label="Always transcode" checked={settings.forceTranscode} onChange={(v) => update({ forceTranscode: v })} />
      <CheckboxField
        label="Styled ASS/SSA subtitles (fonts, positions, effects)"
        checked={settings.styledAss}
        onChange={(v) => update({ styledAss: v })}
      />
      <p className="text-xs text-neutral-500">
        Detected: {containers} · video {video} · audio {audio} · HLS {caps.hls || 'no'}
      </p>
    </section>
  )
}
