import { Link } from 'react-router'

/** Placeholder for routes whose page lands in a later milestone. */
export function ComingSoon({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-neutral-400">This page arrives in {milestone}.</p>
      <Link to="/" className="text-sm text-accent-400 hover:underline">
        ← Home
      </Link>
    </div>
  )
}
