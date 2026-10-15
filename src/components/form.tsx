import { useId, useState, type ReactNode } from 'react'

type Option<T extends string> = { value: T; label: string }

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm focus:border-accent-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <span className="flex items-center gap-1.5 text-sm text-neutral-400">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = e.target.valueAsNumber
            if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, Math.round(n))))
          }}
          className="w-16 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-right text-neutral-100 focus:border-accent-500 focus:outline-none"
        />
        {suffix}
      </span>
    </div>
  )
}

export function CheckboxField({
  label,
  checked,
  onChange,
  children,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  children?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-accent-500"
      />
      {label}
      {children}
    </label>
  )
}

/** Number input that may be left empty (= use the default, shown as placeholder); saved on blur / Enter. */
export function OptionalNumberField({
  label,
  value,
  placeholder,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string
  value: number | undefined
  placeholder: string
  min: number
  max: number
  suffix?: string
  onChange: (value: number | undefined) => void
}) {
  const [text, setText] = useState(value?.toString() ?? '')
  const commit = () => {
    const n = Number(text)
    const next = text.trim() === '' || !Number.isFinite(n) ? undefined : Math.min(max, Math.max(min, Math.round(n)))
    setText(next?.toString() ?? '')
    if (next !== value) onChange(next)
  }
  return (
    <label className="flex items-center gap-1.5 text-xs text-neutral-400">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="w-16 rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-right text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-accent-500 focus:outline-none"
      />
      {suffix}
    </label>
  )
}
