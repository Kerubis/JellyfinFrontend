import type { ReactNode } from 'react'

/** Centered panel used by the server setup and login screens. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-neutral-400">{subtitle}</div>}
        <div className="mt-5 flex flex-col gap-5">{children}</div>
      </div>
    </main>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-red-400">
      {children}
    </p>
  )
}
