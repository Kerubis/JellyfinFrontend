import { useId } from 'react'

// Paths from the official Jellyfin logo (https://jellyfin.org/images/logo.svg, wordmark removed).
// Jellyfin logo © Jellyfin contributors, CC BY-SA 4.0. Same as public/favicon.svg.
const INNER = 'M24.711 49.158c-1.552-3.116 8.626-21.57 11.788-21.57 3.167.002 13.323 18.488 11.788 21.57-1.535 3.081-22.025 3.115-23.577 0z'
const OUTER = 'M.98 64.996C-3.695 55.606 26.977.001 36.5.001c9.533 0 40.153 55.713 35.527 64.995s-66.368 9.391-71.045 0m12.255-8.148c3.065 6.152 43.518 6.084 46.548 0 3.03-6.086-17.033-42.587-23.275-42.587S10.17 50.695 13.234 56.848z'

/** The Jellyfin icon with its gradient (violet #AA5CC3 → blue #00A4DC). */
export function JellyfinIcon({ className = 'size-6' }: { className?: string }) {
  // useId() contains characters like « » / : that don't belong in url(#…) references.
  const gradient = `jf-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg viewBox="0 0 73 72" aria-hidden className={className}>
      <defs>
        <linearGradient
          id={gradient}
          x1="47"
          x2="107"
          y1="84"
          y2="117"
          gradientTransform="translate(-34.501 -54)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#AA5CC3" />
          <stop offset="1" stopColor="#00A4DC" />
        </linearGradient>
      </defs>
      <path fill={`url(#${gradient})`} d={INNER} />
      <path fill={`url(#${gradient})`} fillRule="evenodd" clipRule="evenodd" d={OUTER} />
    </svg>
  )
}
