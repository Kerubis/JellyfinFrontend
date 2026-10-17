import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'

// Time picker in the style of Android's (Material) clock dial: pick the hour on the dial, it switches to the
// minutes and closes after them. Every change goes straight to the field (no OK / Cancel).
// 24-hour mode has two rings like Android: 12, 1–11 outside, 00, 13–23 inside.
// Opens as a popup centered above its field (below when there's no room), rendered into <body> with fixed position.

// Compact popup (188 px wide, 2 px padding); the dial fills its width.
const SIZE = 184
const CENTER = SIZE / 2
const OUTER = 75
const INNER = 47
const KNOB = 15

const pad = (n: number) => String(n).padStart(2, '0')

type Mode = 'hour' | 'minute'

/** Position of a value on the dial (angle 0 = top, clockwise). */
function point(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: CENTER + radius * Math.sin(a), y: CENTER - radius * Math.cos(a) }
}

/** Where the hand points for the current value. */
function handFor(mode: Mode, hour: number, minute: number, hour12: boolean) {
  if (mode === 'minute') return { angle: minute * 6, radius: OUTER }
  const inner = !hour12 && (hour === 0 || hour > 12)
  return { angle: (hour % 12) * 30, radius: inner ? INNER : OUTER }
}

export function ClockDialog({
  anchor,
  value,
  hour12,
  title,
  onChange,
  onClose,
}: {
  /** The field the popup belongs to. */
  anchor: RefObject<HTMLElement | null>
  /** "HH:MM", 24 h. */
  value: string
  hour12: boolean
  title: string
  /** Every pick, right away ("HH:MM", 24 h); the field shows it immediately. */
  onChange: (value: string) => void
  onClose: () => void
}) {
  // Controlled by the field's value: no local copy, so field and dial never disagree.
  const [hour = 0, minute = 0] = value.split(':').map(Number)
  const set = (h: number, m: number) => onChange(`${pad(h)}:${pad(m)}`)
  const setHour = (h: number) => set(h, minute)
  const setMinute = (m: number) => set(hour, m)
  const [mode, setMode] = useState<Mode>('hour')
  const dragging = useRef(false)
  const dial = useRef<HTMLDivElement>(null)
  const pm = hour >= 12

  const card = useRef<HTMLDivElement | null>(null)

  // Escape, a click outside (the field included, it has its own button) or scrolling close it like a menu;
  // what was picked stays.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) => {
      if (!card.current?.contains(e.target as Node)) onClose()
    }
    const onScroll = (e: Event) => {
      if (!card.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  // Placed once it's in the DOM and measurable, before the browser paints it.
  const place = useCallback(
    (element: HTMLDivElement | null) => {
      card.current = element
      if (!element || !anchor.current) return
      const field = anchor.current.getBoundingClientRect()
      const { width, height } = element.getBoundingClientRect()
      const margin = 8
      const above = field.top - height - margin
      const top = above >= margin ? above : Math.min(field.bottom + margin, window.innerHeight - height - margin)
      const centered = field.left + field.width / 2 - width / 2
      const left = Math.max(margin, Math.min(centered, document.documentElement.clientWidth - width - margin))
      element.style.top = `${Math.max(margin, top)}px`
      element.style.left = `${left}px`
      element.style.visibility = 'visible'
    },
    [anchor],
  )

  /** Value under the pointer: angle picks the number, distance the ring (24 h hours). */
  const pickAt = (clientX: number, clientY: number) => {
    const box = dial.current?.getBoundingClientRect()
    if (!box) return
    const dx = clientX - (box.left + box.width / 2)
    const dy = clientY - (box.top + box.height / 2)
    const angle = (Math.atan2(dx, -dy) * 180) / Math.PI + 360
    if (mode === 'minute') {
      setMinute(Math.round(angle / 6) % 60)
      return
    }
    const step = Math.round(angle / 30) % 12
    if (hour12) setHour(step + (pm ? 12 : 0))
    else if (Math.hypot(dx, dy) < (OUTER + INNER) / 2) setHour(step === 0 ? 0 : step + 12)
    else setHour(step === 0 ? 12 : step)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    pickAt(e.clientX, e.clientY)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => dragging.current && pickAt(e.clientX, e.clientY)
  const onPointerUp = () => {
    dragging.current = false
    // Like Android: after the hour comes the minute; after the minute it's done.
    if (mode === 'hour') setMode('minute')
    else onClose()
  }

  // Keyboard on the dial: arrows change the value by one (wrapping).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0
    if (delta) {
      e.preventDefault()
      if (mode === 'hour') setHour((hour + delta + 24) % 24)
      else setMinute((minute + delta + 60) % 60)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (mode === 'hour') setMode('minute')
      else onClose()
    }
  }

  const hand = handFor(mode, hour, minute, hour12)
  const tip = point(hand.angle, hand.radius)

  // Numbers on the dial: [label, angle, radius, selected].
  const labels: [string, number, number, boolean][] =
    mode === 'minute'
      ? Array.from({ length: 12 }, (_, i) => [pad(i * 5), i * 30, OUTER, minute === i * 5])
      : hour12
        ? Array.from({ length: 12 }, (_, i) => [String(i || 12), i * 30, OUTER, hour % 12 === i])
        : [
            ...Array.from({ length: 12 }, (_, i): [string, number, number, boolean] => [String(i || 12), i * 30, OUTER, hour === (i || 12)]),
            ...Array.from({ length: 12 }, (_, i): [string, number, number, boolean] => [i ? String(i + 12) : '00', i * 30, INNER, hour === (i ? i + 12 : 0)]),
          ]

  const segment = (active: boolean) =>
    `rounded-md px-1.5 py-0.5 text-[28px] leading-tight font-light tabular-nums transition-colors ${active ? 'bg-accent-700/50 text-accent-300' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`

  return createPortal(
    <div
      ref={place}
      role="dialog"
      aria-label={title}
      className="invisible fixed z-50 flex w-[188px] flex-col gap-2 rounded-2xl border border-neutral-700 bg-neutral-900 p-0.5 shadow-2xl"
    >
        <p className="px-2.5 pt-2 text-[11px] font-medium text-neutral-400">{title}</p>

        <div className="flex items-center justify-center gap-0.5">
          <button type="button" className={segment(mode === 'hour')} onClick={() => setMode('hour')} aria-label="Hour">
            {hour12 ? pad(hour % 12 || 12) : pad(hour)}
          </button>
          <span className="text-[28px] leading-tight font-light text-neutral-400">:</span>
          <button type="button" className={segment(mode === 'minute')} onClick={() => setMode('minute')} aria-label="Minute">
            {pad(minute)}
          </button>
          {hour12 && (
            <div className="ml-1 flex flex-col overflow-hidden rounded-md border border-neutral-700 text-[10px] font-medium">
              {(['AM', 'PM'] as const).map((half) => {
                const active = (half === 'PM') === pm
                return (
                  <button
                    key={half}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setHour((hour % 12) + (half === 'PM' ? 12 : 0))}
                    className={`px-1 py-0.5 ${active ? 'bg-accent-700/50 text-accent-300' : 'text-neutral-400 hover:bg-neutral-800'}`}
                  >
                    {half}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div
          ref={dial}
          role="slider"
          tabIndex={0}
          aria-label={mode === 'hour' ? 'Hour' : 'Minute'}
          aria-valuemin={0}
          aria-valuemax={mode === 'hour' ? 23 : 59}
          aria-valuenow={mode === 'hour' ? hour : minute}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
          className="relative mx-auto cursor-pointer touch-none rounded-full bg-neutral-800 select-none focus-visible:outline-2 focus-visible:outline-accent-400"
          style={{ width: SIZE, height: SIZE }}
        >
          <svg width={SIZE} height={SIZE} className="pointer-events-none absolute inset-0" aria-hidden>
            <line x1={CENTER} y1={CENTER} x2={tip.x} y2={tip.y} className="stroke-accent-600" strokeWidth={2} />
            <circle cx={CENTER} cy={CENTER} r={3.5} className="fill-accent-600" />
            <circle cx={tip.x} cy={tip.y} r={KNOB} className="fill-accent-600" />
            {/* A minute between the labels: a dot in the knob, like Android. */}
            {mode === 'minute' && minute % 5 !== 0 && <circle cx={tip.x} cy={tip.y} r={2.5} className="fill-white" />}
          </svg>
          {labels.map(([label, angle, radius, selected]) => {
            const p = point(angle, radius)
            return (
              <span
                key={`${label}-${radius}`}
                className={`pointer-events-none absolute flex size-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center leading-none tabular-nums ${
                  radius === INNER ? 'text-[11px]' : 'text-sm'
                } ${selected ? 'font-medium text-white' : radius === INNER ? 'text-neutral-400' : 'text-neutral-200'}`}
                style={{ left: p.x, top: p.y }}
              >
                {label}
              </span>
            )
          })}
        </div>
    </div>,
    document.body,
  )
}
