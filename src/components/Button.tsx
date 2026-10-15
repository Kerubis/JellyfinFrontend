import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-500',
  secondary: 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700',
  ghost: 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export function Button({ variant = 'secondary', className = '', type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-400 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
