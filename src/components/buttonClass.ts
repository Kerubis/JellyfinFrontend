export type Variant = 'primary' | 'secondary' | 'outlined' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-500',
  secondary: 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700',
  /** Secondary with an inset ring (no size change), for buttons on the dark page background. */
  outlined: 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-600 ring-inset hover:bg-neutral-700',
  ghost: 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100',
  danger: 'bg-red-700 text-white hover:bg-red-600',
}

/** Button look, also for links that act as buttons. */
export const buttonClass = (variant: Variant = 'secondary', className = '') =>
  `rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-400 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`
