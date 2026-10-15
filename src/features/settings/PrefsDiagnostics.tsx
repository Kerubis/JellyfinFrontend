import { useMutation } from '@tanstack/react-query'
import { runPrefsSpike } from '@/api/prefs-spike'
import { useSignedIn } from '@/api/session-context'
import { Button } from '@/components/Button'

/** Dev-only: runs the CustomPrefs spike (size limits, PUT semantics, admin writes). */
export function PrefsDiagnostics() {
  const { server, account } = useSignedIn()
  const spike = useMutation({ mutationFn: () => runPrefsSpike(server, account) })

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">Sync diagnostics (dev)</h2>
      <p className="text-xs text-neutral-500">
        Writes test data to a scratch preferences entry (<code>jff-spike</code>), never to your real settings.
      </p>
      <Button onClick={() => spike.mutate()} disabled={spike.isPending} className="self-start">
        {spike.isPending ? 'Running…' : 'Run prefs check'}
      </Button>
      {spike.data && (
        <ul className="text-sm">
          {spike.data.map((r) => (
            <li key={r.check} className="flex gap-2">
              <span className={r.ok ? 'text-emerald-400' : 'text-red-400'}>{r.ok ? '✓' : '✗'}</span>
              <span className="text-neutral-400">{r.check}:</span>
              <span>{r.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
