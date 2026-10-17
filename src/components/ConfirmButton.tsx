import { useEffect, useState, type ReactNode } from 'react'
import { Button } from './Button'

/**
 * A button for actions that are hard to undo (restart, shutdown, delete): the first click asks inline,
 * the second one runs it. The question goes away again after a few seconds.
 */
export function ConfirmButton({
  children,
  question,
  onConfirm,
  disabled,
  danger = false,
}: {
  children: ReactNode
  /** e.g. "Restart the server?" */
  question: string
  onConfirm: () => void
  disabled?: boolean
  danger?: boolean
}) {
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!asking) return
    const timer = window.setTimeout(() => setAsking(false), 6000)
    return () => window.clearTimeout(timer)
  }, [asking])

  if (!asking) {
    return (
      <Button disabled={disabled} onClick={() => setAsking(true)} className={danger ? 'text-red-300' : ''}>
        {children}
      </Button>
    )
  }
  return (
    <span role="group" aria-label={question} className="inline-flex items-center gap-2 rounded border border-neutral-700 px-2 py-1 text-sm">
      <span className={danger ? 'text-red-300' : ''}>{question}</span>
      <Button
        variant={danger ? 'danger' : 'primary'}
        autoFocus
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
      >
        Yes
      </Button>
      <Button variant="ghost" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </span>
  )
}
