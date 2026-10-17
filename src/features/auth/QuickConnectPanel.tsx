import { errorMessage } from '@/api/errors'
import { useSession } from '@/api/session-context'
import { ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import type { Server } from '@/domain/auth'
import { useQuickConnect } from './useQuickConnect'

export function QuickConnectPanel({ server }: { server: Server }) {
  const { signIn } = useSession()
  const qc = useQuickConnect(server, signIn)
  if (!qc.available) return null

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-800 pt-4">
      {qc.code ? (
        <>
          <p className="text-sm text-neutral-400">
            In another Jellyfin app where you're signed in, open <em>Quick Connect</em> and enter:
          </p>
          <p className="text-center font-mono text-3xl tracking-[0.3em] text-accent-300">{qc.code}</p>
          <p role="status" className="flex items-center justify-center gap-2 text-xs text-neutral-400">
            {/* Same spinner as the player's loading state, small; motion-reduce keeps it still. */}
            <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-white/15 border-t-accent-400 motion-reduce:animate-none" />
            Waiting for approval…
          </p>
          <Button variant="ghost" onClick={qc.cancel}>
            Cancel
          </Button>
        </>
      ) : (
        <Button onClick={qc.start} disabled={qc.starting}>
          Sign in with Quick Connect
        </Button>
      )}
      {qc.error && <ErrorText>{errorMessage(qc.error)}</ErrorText>}
    </div>
  )
}
