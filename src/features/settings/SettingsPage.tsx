import { useState, type FormEvent } from 'react'
import { defaultDeviceName, getDeviceName, setDeviceName } from '@/api/client'
import { useRefreshPrefsOnMount } from '@/api/prefs-context'
import { useSession, useSignedIn } from '@/api/session-context'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { HiddenSection } from './HiddenSection'
import { LanguageSection } from './LanguageSection'
import { PlaybackDeviceSection } from './PlaybackDeviceSection'
import { PrefsDiagnostics } from './PrefsDiagnostics'
import { DisplayPrefsSection, PlaybackPrefsSection, SubtitlePrefsSection } from './ProfilePrefsSection'

export function SettingsPage() {
  const { server, account } = useSignedIn()
  const { forgetServer, signOut } = useSession()
  const [name, setName] = useState(getDeviceName)
  const [saved, setSaved] = useState(false)
  useRefreshPrefsOnMount()

  function saveDeviceName(event: FormEvent) {
    event.preventDefault()
    setDeviceName(name)
    setName(getDeviceName())
    setSaved(true)
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <PlaybackPrefsSection />
      <PlaybackDeviceSection />
      <SubtitlePrefsSection />
      <LanguageSection />
      <DisplayPrefsSection />
      <HiddenSection />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">This device</h2>
        <form onSubmit={saveDeviceName} className="flex items-end gap-2">
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

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">Server</h2>
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
      {import.meta.env.DEV && <PrefsDiagnostics />}
    </div>
  )
}
