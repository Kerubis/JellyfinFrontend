import { useCallback, useRef, useState } from 'react'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { parseClock } from '@/lib/time'
import { ClockDialog } from './ClockDialog'

/**
 * Time input ("HH:MM", stored in 24 h, shown in the profile's time format): type it ("20:30", "8pm"), or pick
 * it on an Android-style clock dial. Replaces <input type="time">, whose format and look follow the browser.
 */
export function TimeField({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  /** Accessible name and dialog title (the field usually sits in a sentence like "Bedtime from … to …"). */
  label: string
  disabled?: boolean
}) {
  const time = useTimeFormat()
  const [text, setText] = useState(time.clock(value))
  const [shown, setShown] = useState(`${value}|${time.hour12}`)
  const [picking, setPicking] = useState(false)
  const field = useRef<HTMLSpanElement>(null)
  // Stable, so the popup doesn't re-register its listeners on every live update while dragging.
  const close = useCallback(() => setPicking(false), [])

  // Follow changes from outside (a reset, another time format): adjust during render instead of in an effect.
  if (`${value}|${time.hour12}` !== shown) {
    setShown(`${value}|${time.hour12}`)
    setText(time.clock(value))
  }

  const commit = () => {
    const parsed = parseClock(text)
    if (parsed) onChange(parsed)
    setText(time.clock(parsed ?? value))
  }

  return (
    <span ref={field} className={`inline-flex items-center rounded border border-neutral-700 bg-neutral-900 focus-within:border-accent-500 ${disabled ? 'opacity-50' : ''}`}>
      <input
        aria-label={label}
        value={text}
        disabled={disabled}
        maxLength={8}
        onChange={(e) => setText(e.target.value)}
        // A click selects the time (type over it right away) and opens the picker. mousedown is swallowed so an
        // open picker doesn't treat it as an outside click and close.
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          // After the browser has placed its caret for this click, or it would undo the selection.
          const input = e.currentTarget
          requestAnimationFrame(() => input.select())
          setPicking(true)
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          commit()
          setPicking(false)
        }}
        className={`${time.hour12 ? 'w-20' : 'w-14'} bg-transparent px-2 py-1 text-sm tabular-nums focus:outline-none`}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={`Pick ${label.toLowerCase()}`}
        // Mouse: toggle on mousedown and swallow it, or the popup's outside-click handler would close and reopen it.
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setPicking((p) => !p)
        }}
        // Keyboard (Enter / Space) only fires click, with detail 0.
        onClick={(e) => e.detail === 0 && setPicking((p) => !p)}
        className="px-1.5 text-neutral-400 hover:text-neutral-100"
      >
        <svg viewBox="0 -960 960 960" className="size-4" aria-hidden>
          {/* Material Symbols "schedule" (Apache License 2.0). */}
          <path
            fill="currentColor"
            d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"
          />
        </svg>
      </button>
      {picking && (
        <ClockDialog
          anchor={field}
          value={value}
          hour12={time.hour12}
          title={label}
          onChange={onChange}
          onClose={close}
        />
      )}
    </span>
  )
}
