import { useState, type FormEvent } from 'react'
import { defaultDeviceName, getDeviceName, setDeviceName } from '@/api/client'
import { useSession, useSignedIn } from '@/api/session-context'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'

const TITLE = 'text-sm font-semibold tracking-wide text-neutral-400 uppercase'

export function DeviceNameSection() {
  const [name, setName] = useState(getDeviceName)
  const [saved, setSaved] = useState(false)

  function save(event: FormEvent) {
    event.preventDefault()
    setDeviceName(name)
    setName(getDeviceName())
    setSaved(true)
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className={TITLE}>This device</h2>
      <form onSubmit={save} className="flex items-end gap-2">
        <TextField
          label="Device name"
          className="flex-1"
          value={name}
          placeholder={defaultDeviceName()}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
          hint="Shown in the Jellyfin dashboard and Home Assistant. Applies from the next sign-in."
        />
        <Button type="submit" variant="primary" className="mb-5">
          {saved ? 'Saved' : 'Save'}
        </Button>
      </form>
    </section>
  )
}

export function ServerSection() {
  const { server, account } = useSignedIn()
  const { forgetServer, signOut } = useSession()
  return (
    <section className="flex flex-col gap-2">
      <h2 className={TITLE}>Server</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-neutral-500">Name</dt>
        <dd>{server.name}</dd>
        <dt className="text-neutral-500">Version</dt>
        <dd>{server.version}</dd>
        <dt className="text-neutral-500">Address</dt>
        <dd className="break-all">{server.url}</dd>
        <dt className="text-neutral-500">Signed in as</dt>
        <dd>{account.name}</dd>
      </dl>
      <div className="flex gap-2">
        <Button onClick={() => void signOut(account.userId)}>Sign out</Button>
        <Button variant="ghost" onClick={forgetServer}>
          Change server
        </Button>
      </div>
    </section>
  )
}
