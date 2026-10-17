import { useId } from 'react'
import { useScheduledTasks, useServerAction } from '@/api/queries/admin'
import { useCurrentUser } from '@/api/queries/users'

// Material Symbols (Google, Apache License 2.0), 400 weight, viewBox 0 -960 960 960.
const AUTORENEW =
  'M204-318q-22-38-33-78t-11-82q0-134 93-228t227-94h7l-64-64 56-56 160 160-160 160-56-56 64-64h-7q-100 0-170 70.5T240-478q0 26 6 51t18 49l-60 60ZM481-40 321-200l160-160 56 56-64 64h7q100 0 170-70.5T720-482q0-26-6-51t-18-49l60-60q22 38 33 78t11 82q0 134-93 228t-227 94h-7l64 64-56 56Z'
const BOLT = 'm320-80 40-280H160l360-520h80l-40 320h240L400-80h-80Z'

/** Header button for admins: starts "Scan all libraries"; spins in the Jellyfin gradient while a scan runs. */
export function LibraryScanButton() {
  const me = useCurrentUser()
  return me.data?.isAdmin ? <ScanButton /> : null
}

function ScanButton() {
  const tasks = useScheduledTasks()
  const scan = useServerAction()
  const task = tasks.data?.find((t) => t.key === 'RefreshLibrary')
  const running = !!task && task.state !== 'Idle'
  const label = running ? `Scanning libraries… ${Math.round(task.progress ?? 0)}%` : 'Scan all libraries'

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={running || scan.isPending}
      onClick={() => scan.mutate('scan')}
      className="flex size-8 items-center justify-center rounded-full text-neutral-400 ring-accent-400 ring-inset transition hover:text-neutral-100 hover:ring-2 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:hover:ring-0"
    >
      <ScanIcon running={running} />
    </button>
  )
}

/** Autorenew arrows with a bolt inside; grey (currentColor) at rest, gradient + spinning arrows while scanning. */
function ScanIcon({ running }: { running: boolean }) {
  const gradient = useId()
  const fill = running ? `url(#${gradient})` : 'currentColor'
  return (
    <svg viewBox="0 -960 960 960" aria-hidden className="size-6">
      <defs>
        {/* userSpaceOnUse: one violet → blue sweep across the whole icon (it turns with the arrows). */}
        <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="160" y1="-880" x2="800" y2="-80">
          <stop offset="0" stopColor="#AA5CC3" />
          <stop offset="1" stopColor="#00A4DC" />
        </linearGradient>
      </defs>
      <g className={running ? 'origin-center animate-[spin_1.2s_linear_infinite] [transform-box:fill-box] motion-reduce:animate-none' : ''}>
        <path d={AUTORENEW} fill={fill} />
      </g>
      {/* Bolt scaled to ~1/3 and centred in the circle (bolt box 160…720 × -880…-80, centre 440,-480). */}
      <path d={BOLT} fill={fill} transform="translate(480 -480) scale(0.34) translate(-440 480)" />
    </svg>
  )
}
