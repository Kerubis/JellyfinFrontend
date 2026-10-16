import type { ReactNode } from 'react'

// Small inline SVG icons (text glyphs like ▶ render as colored emoji on some systems).

type IconProps = { className?: string }

function Icon({ className = 'size-5', children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      {children}
    </svg>
  )
}

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </Icon>
)

export const StopIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </Icon>
)

export const NextIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 6.2v11.6a1 1 0 0 0 1.55.83L15 13v4.8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V6.2a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1V11L6.55 5.37A1 1 0 0 0 5 6.2Z" />
  </Icon>
)

export const BackIcon = ({ seconds, ...p }: IconProps & { seconds: number }) => (
  <Icon {...p}>
    <path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8Z" />
    <text x="12" y="16.5" fontSize={seconds >= 100 ? 5 : 6.5} textAnchor="middle" fontWeight="700">{seconds}</text>
  </Icon>
)

export const ForwardIcon = ({ seconds, ...p }: IconProps & { seconds: number }) => (
  <Icon {...p}>
    <path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8Z" />
    <text x="12" y="16.5" fontSize={seconds >= 100 ? 5 : 6.5} textAnchor="middle" fontWeight="700">{seconds}</text>
  </Icon>
)

export const VolumeIcon = ({ muted, ...p }: IconProps & { muted: boolean }) => (
  <Icon {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    {muted ? (
      <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    ) : (
      <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    )}
  </Icon>
)

export const FullscreenIcon = ({ active, ...p }: IconProps & { active: boolean }) => (
  <Icon {...p}>
    <path
      d={active ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'}
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Icon>
)

export const MinimizeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
)

export const ExpandIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 15 6-6 6 6" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
)

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </Icon>
)

export const AudioTrackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path
      d="M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2v-3Zm16 0a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2v-3Z"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinejoin="round"
    />
  </Icon>
)

export const CastIcon = ({ active, ...p }: IconProps & { active: boolean }) => (
  <Icon {...p}>
    <path d="M3 17a4 4 0 0 1 4 4M3 13a8 8 0 0 1 8 8M3 9a12 12 0 0 1 12 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    {active && <path d="M7 7h10v10h-1.5A12 12 0 0 0 7 8.5Z" />}
  </Icon>
)

export const PipIcon = ({ active, ...p }: IconProps & { active: boolean }) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    <rect x="12" y="11" width="7" height="6" rx="1" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" />
  </Icon>
)

export const SubtitlesIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M7 12h4M13 12h4M7 15.5h6M15 15.5h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
)

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z" />
  </Icon>
)
