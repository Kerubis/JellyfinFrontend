import { errorMessage } from '@/api/errors'
import { useServerAction, useServerInfo } from '@/api/queries/admin'
import { ErrorText } from '@/components/AuthCard'
import { ConfirmButton } from '@/components/ConfirmButton'

/** Shown while the server waits for a restart (plugin installs, some settings), with the restart button. */
export function RestartNotice() {
  const info = useServerInfo()
  const restart = useServerAction()
  if (restart.isSuccess) return <p className="rounded border border-neutral-700 px-3 py-2 text-sm text-emerald-400">Restarting… the server is back in a minute.</p>
  if (!info.data?.hasPendingRestart) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
      <span className="flex-1 text-amber-200">The server needs a restart to apply recent changes.</span>
      <ConfirmButton question="Restart the server?" disabled={restart.isPending} onConfirm={() => restart.mutate('restart')}>
        Restart now
      </ConfirmButton>
      {restart.isError && <ErrorText>{errorMessage(restart.error)}</ErrorText>}
    </div>
  )
}
