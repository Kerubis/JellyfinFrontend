import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { connectToServer } from '@/api/auth'
import { devProxyUrl } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { presetServerUrl } from '@/api/runtimeConfig'
import { useSession } from '@/api/session-context'
import { AuthCard, ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'

export function ServerSetup() {
  const { setServer } = useSession()
  const [url, setUrl] = useState(presetServerUrl ?? devProxyUrl ?? '')
  const connect = useMutation({ mutationFn: connectToServer, onSuccess: setServer })

  // Container with a preset server (JELLYFIN_URL): connect right away; the form only shows if that fails.
  const autoConnected = useRef(false)
  useEffect(() => {
    if (!presetServerUrl || autoConnected.current) return
    autoConnected.current = true
    connect.mutate(presetServerUrl)
  }, [connect])

  if (presetServerUrl && !connect.isError) {
    return <AuthCard title="Connecting to Jellyfin…" subtitle={presetServerUrl}>{null}</AuthCard>
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (url.trim()) connect.mutate(url)
  }

  return (
    <AuthCard title="Connect to Jellyfin" subtitle="Enter the address of your Jellyfin server.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Server address"
          placeholder="http://192.168.1.10:8096"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
          hint={devProxyUrl ? 'Dev mode: this goes through the Vite proxy to JELLYFIN_URL from .env.local.' : undefined}
        />
        {connect.isError && <ErrorText>{errorMessage(connect.error)}</ErrorText>}
        <Button type="submit" variant="primary" disabled={connect.isPending || !url.trim()}>
          {connect.isPending ? 'Connecting…' : 'Connect'}
        </Button>
      </form>
    </AuthCard>
  )
}
