import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, type Variant } from './buttonClass'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export function Button({ variant = 'secondary', className = '', type = 'button', ...props }: Props) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />
}
