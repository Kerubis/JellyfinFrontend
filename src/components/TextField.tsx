import { useId, type ComponentProps } from 'react'

type Props = ComponentProps<'input'> & { label: string; hint?: string }

export function TextField({ label, hint, className = '', ...props }: Props) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-neutral-400">
        {label}
      </label>
      <input
        id={id}
        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-accent-500 focus:outline-none"
        {...props}
      />
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  )
}
