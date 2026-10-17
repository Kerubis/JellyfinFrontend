import { useState, type FormEvent } from 'react'
import { errorMessage } from '@/api/errors'
import { useApiKeys, useCreateApiKey, useDevices, useRemoveDevices, useRevokeApiKey } from '@/api/queries/adminDevices'
import { ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { ConfirmButton } from '@/components/ConfirmButton'
import { TextField } from '@/components/TextField'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { formatRelative } from '@/lib/format'
import { SectionTitle } from './parts'

/** Signed-in devices; removing one signs it out. */
export function DevicesSection() {
  const devices = useDevices()
  const remove = useRemoveDevices()
  const time = useTimeFormat()
  const list = devices.data ?? []
  const others = list.filter((d) => !d.isThisDevice)

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle
        action={
          others.length > 0 && (
            <ConfirmButton danger question={`Sign out ${others.length} devices?`} disabled={remove.isPending} onConfirm={() => remove.mutate(others.map((d) => d.id))}>
              Sign out all other devices
            </ConfirmButton>
          )
        }
      >
        Devices
      </SectionTitle>
      <p className="text-xs text-neutral-500">Every app or browser that signed in. Signing a device out revokes its access; it has to sign in again.</p>
      {devices.isError && <ErrorText>{errorMessage(devices.error)}</ErrorText>}
      {remove.isError && <ErrorText>{errorMessage(remove.error)}</ErrorText>}
      <ul className="flex flex-col divide-y divide-neutral-800">
        {list.map((device) => (
          <li key={device.id} className="flex items-center gap-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{device.name}</span>
                {device.isThisDevice && <span className="rounded bg-accent-700/40 px-1.5 py-0.5 text-[10px] text-accent-300">this device</span>}
              </div>
              <div className="text-xs text-neutral-500">
                {[device.app && `${device.app} ${device.appVersion}`.trim(), device.userName].filter(Boolean).join(' · ')}
              </div>
            </div>
            <span className="shrink-0 text-xs text-neutral-500" title={device.lastActivity ? time.dateTime(device.lastActivity) : undefined}>
              {device.lastActivity ? formatRelative(device.lastActivity) : 'never'}
            </span>
            {!device.isThisDevice && (
              <ConfirmButton question="Sign out?" disabled={remove.isPending} onConfirm={() => remove.mutate([device.id])}>
                Sign out
              </ConfirmButton>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** API keys for other programs (Home Assistant, Sonarr, scripts); full access to the server. */
export function ApiKeysSection() {
  const keys = useApiKeys()
  const create = useCreateApiKey()
  const revoke = useRevokeApiKey()
  const [app, setApp] = useState('')
  const [created, setCreated] = useState<string>()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!app.trim()) return
    create.mutate(app, {
      onSuccess: (token) => {
        setCreated(token)
        setApp('')
      },
    })
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>API keys</SectionTitle>
      <p className="text-xs text-neutral-500">For other programs (Home Assistant, Sonarr, scripts). A key has full admin access; revoke what isn't used.</p>
      {keys.isError && <ErrorText>{errorMessage(keys.error)}</ErrorText>}
      <ul className="flex flex-col divide-y divide-neutral-800">
        {keys.data?.map((key) => (
          <li key={key.token} className="flex items-center gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{key.app || 'Unnamed'}</span>
              <span className="block font-mono text-xs text-neutral-500">{key.token.slice(0, 6)}…</span>
            </span>
            <span className="shrink-0 text-xs text-neutral-500">{key.lastActivity ? `used ${formatRelative(key.lastActivity)}` : 'never used'}</span>
            <ConfirmButton danger question="Revoke?" disabled={revoke.isPending} onConfirm={() => revoke.mutate(key.token)}>
              Revoke
            </ConfirmButton>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex items-end gap-2">
        <TextField label="App name" className="w-56" value={app} onChange={(e) => setApp(e.target.value)} placeholder="Home Assistant" />
        <Button type="submit" disabled={create.isPending || !app.trim()}>
          Create key
        </Button>
      </form>
      {created && (
        <div className="flex flex-col gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
          <span className="text-xs text-emerald-300">New key; copy it now (Ctrl+C), it's only shown in full here:</span>
          {/* Clipboard API needs HTTPS; selecting on click makes copying one keystroke instead. */}
          <input readOnly value={created} onFocus={(e) => e.currentTarget.select()} className="rounded bg-neutral-900 px-2 py-1 font-mono text-xs" />
        </div>
      )}
      {(create.isError || revoke.isError) && <ErrorText>{errorMessage(create.error ?? revoke.error)}</ErrorText>}
    </section>
  )
}
