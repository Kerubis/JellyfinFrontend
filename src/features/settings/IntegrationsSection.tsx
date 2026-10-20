import { useState } from 'react'
import { usePref } from '@/api/prefs-context'
import { checkScheduleToken } from '@/api/schedule'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'

type Check = { state: 'idle' } | { state: 'checking' } | { state: 'ok' } | { state: 'error'; message: string }

/** The profile's AnimeSchedule.net API application (powers the Schedule page). Synced with the profile. */
export function AnimeScheduleSection() {
  const pref = usePref('animeSchedule')
  const [appId, setAppId] = useState(pref.value.appId)
  const [token, setToken] = useState(pref.value.token)
  const [check, setCheck] = useState<Check>({ state: 'idle' })
  const changed = appId.trim() !== pref.value.appId || token.trim() !== pref.value.token

  const save = async () => {
    const next = { appId: appId.trim(), token: token.trim() }
    if (next.token) {
      setCheck({ state: 'checking' })
      try {
        await checkScheduleToken(next.token)
      } catch (error) {
        setCheck({ state: 'error', message: error instanceof Error ? error.message : 'Check failed.' })
        return
      }
    }
    pref.update(next)
    setCheck(next.token ? { state: 'ok' } : { state: 'idle' })
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">AnimeSchedule.net</h2>
      <p className="text-xs text-neutral-500">
        Weekly airing schedule on the Schedule page. Create an application at{' '}
        <a href="https://animeschedule.net/users/settings/api" target="_blank" rel="noreferrer" className="text-accent-400 hover:underline">
          AnimeSchedule → Settings → API
        </a>{' '}
        and paste its id and token. Saved with this profile (Jellyfin admins can read profile settings).
      </p>
      <TextField label="App id" value={appId} onChange={(e) => setAppId(e.target.value)} autoComplete="off" spellCheck={false} />
      <TextField
        label="App token"
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={!changed || check.state === 'checking'} onClick={() => void save()}>
          {check.state === 'checking' ? 'Checking…' : 'Save'}
        </Button>
        {check.state === 'ok' && <span className="text-xs text-green-400">Token works, saved.</span>}
        {check.state === 'error' && <span className="text-xs text-red-400">{check.message} Not saved.</span>}
      </div>
    </section>
  )
}
