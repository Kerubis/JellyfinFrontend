import { usePref } from '@/api/prefs-context'
import { useWriteThrough } from '@/api/queries/account'
import { CheckboxField, NumberField, SelectField } from '@/components/form'
import { SKIP_LIMITS, type CardSize, type PlaybackPrefs, type SkipMode } from '@/domain/prefs'
import type { TimeFormat } from '@/lib/time'
import { LibrarySkipTimes } from './LibrarySkipTimes'

const SKIP_OPTIONS: { value: SkipMode; label: string }[] = [
  { value: 'auto', label: 'Skip automatically' },
  { value: 'button', label: 'Show button' },
  { value: 'off', label: 'Off' },
]

const RESUME_OPTIONS: { value: PlaybackPrefs['resume']; label: string }[] = [
  { value: 'always', label: 'Always resume' },
  { value: 'ask', label: 'Ask' },
  { value: 'startOver', label: 'Start over' },
]

const CARD_SIZES: { value: CardSize; label: string }[] = [
  { value: 'xs', label: 'Extra small' },
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Extra large' },
]

const TIME_FORMATS: { value: TimeFormat; label: string }[] = [
  { value: 'auto', label: 'Automatic (browser language)' },
  { value: '24', label: '24-hour (20:30)' },
  { value: '12', label: '12-hour (8:30 PM)' },
]

const BACKGROUNDS = [
  { value: '0', label: 'None (shadow only)' },
  { value: '0.4', label: 'Light' },
  { value: '0.65', label: 'Medium' },
  { value: '0.85', label: 'Dark' },
]

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">{children}</h2>
}

export function PlaybackPrefsSection() {
  const playback = usePref('playback')
  const writeThrough = useWriteThrough()
  const p = playback.value

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Playback</SectionTitle>
      <CheckboxField
        label="Autoplay next episode"
        checked={p.autoplayNext}
        onChange={(v) => {
          playback.update({ autoplayNext: v })
          writeThrough({ EnableNextEpisodeAutoPlay: v })
        }}
      />
      <NumberField
        label="Countdown before next episode"
        value={p.autoplayCountdownSeconds}
        min={0}
        max={60}
        suffix="s"
        onChange={(v) => playback.update({ autoplayCountdownSeconds: v })}
      />
      <NumberField
        label={'Ask "Still watching?" after'}
        value={p.stillWatchingAfterEpisodes}
        min={0}
        max={20}
        suffix="episodes (0 = never)"
        onChange={(v) => playback.update({ stillWatchingAfterEpisodes: v })}
      />
      <SelectField
        label="Partly watched"
        value={p.resume}
        options={RESUME_OPTIONS}
        onChange={(v) => playback.update({ resume: v })}
      />
      <NumberField
        label="Skip back (← and button)"
        value={p.skipBack}
        min={SKIP_LIMITS.min}
        max={SKIP_LIMITS.max}
        suffix="s"
        onChange={(v) => playback.update({ skipBack: v })}
      />
      <NumberField
        label="Skip forward (→ and button)"
        value={p.skipForward}
        min={SKIP_LIMITS.min}
        max={SKIP_LIMITS.max}
        suffix="s"
        onChange={(v) => playback.update({ skipForward: v })}
      />
      <LibrarySkipTimes />
      <SelectField label="Intro" value={p.skipIntro} options={SKIP_OPTIONS} onChange={(v) => playback.update({ skipIntro: v })} />
      <SelectField label="Outro / credits" value={p.skipOutro} options={SKIP_OPTIONS} onChange={(v) => playback.update({ skipOutro: v })} />
    </section>
  )
}

export function SubtitlePrefsSection() {
  const subtitles = usePref('subtitles')
  const onDevice = subtitles.override?.fontSize !== undefined
  const setSize = (fontSize: number) =>
    onDevice ? subtitles.setOverride({ ...subtitles.override, fontSize }) : subtitles.update({ fontSize })

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Subtitles</SectionTitle>
      <NumberField
        label={onDevice ? 'Font size (this device)' : 'Font size'}
        value={subtitles.value.fontSize}
        min={12}
        max={72}
        suffix="px"
        onChange={setSize}
      />
      <CheckboxField
        label="Use a different font size on this device"
        checked={onDevice}
        onChange={(on) => {
          const { fontSize: _removed, ...rest } = subtitles.override ?? {}
          subtitles.setOverride(on ? { ...rest, fontSize: subtitles.profile.fontSize } : rest)
        }}
      />
      <SelectField
        label="Background"
        value={String(subtitles.value.background)}
        options={BACKGROUNDS}
        onChange={(v) => subtitles.update({ background: Number(v) })}
      />
      <NumberField
        label="Distance from the bottom"
        value={subtitles.value.position}
        min={0}
        max={40}
        suffix="%"
        onChange={(position) => subtitles.update({ position })}
      />
      <p className="text-[11px] text-neutral-500">
        Default 28 px. The mini player shows subtitles at half size; while the controls are visible they move above them.
      </p>
    </section>
  )
}

export function DisplayPrefsSection() {
  const ui = usePref('ui')
  const cardSizeOnDevice = ui.override?.cardSize !== undefined

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Display</SectionTitle>
      <SelectField
        label={cardSizeOnDevice ? 'Card size (this device)' : 'Card size'}
        value={ui.value.cardSize}
        options={CARD_SIZES}
        onChange={(v) => (cardSizeOnDevice ? ui.setOverride({ ...ui.override, cardSize: v }) : ui.update({ cardSize: v }))}
      />
      <CheckboxField
        label="Use a different card size on this device"
        checked={cardSizeOnDevice}
        onChange={(on) => {
          const { cardSize: _removed, ...rest } = ui.override ?? {}
          ui.setOverride(on ? { ...rest, cardSize: ui.profile.cardSize } : rest)
        }}
      />
      <SelectField
        label="Time format"
        value={ui.value.timeFormat}
        options={TIME_FORMATS}
        onChange={(timeFormat) => ui.update({ timeFormat })}
      />
      <CheckboxField
        label="Show spoilers (thumbnails and descriptions of unwatched episodes)"
        checked={ui.value.showSpoilers}
        onChange={(v) => ui.update({ showSpoilers: v })}
      />
    </section>
  )
}
