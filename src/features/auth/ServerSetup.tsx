import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { connectToServer } from '@/api/auth'
import { devProxyUrl, normalizeServerUrl } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { useResetServerCheck } from '@/api/queries/server'
import { presetServerUrl } from '@/api/runtimeConfig'
import { useSession } from '@/api/session-context'
import { AuthCard, ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import type { Server } from '@/domain/auth'

/**
 * Server address form. `unreachable`: the saved server stopped answering (e.g. new IP); the form starts with
 * its address so it can be retried or changed. Profiles stay: they belong to the server id, not its address.
 */
export function ServerSetup({ unreachable }: { unreachable?: Server }) {
  const { setServer } = useSession()
  const resetServerCheck = useResetServerCheck()
  // Container with a preset server (JELLYFIN_URL): connect right away, unless that is the address that just failed.
  const autoUrl = presetServerUrl && normalizeServerUrl(presetServerUrl) !== unreachable?.url ? presetServerUrl : null
  const [url, setUrl] = useState(autoUrl ?? unreachable?.url ?? devProxyUrl ?? '')
  const connect = useMutation({
    mutationFn: connectToServer,
    onSuccess: (next) => {
      void resetServerCheck()
      setServer(next)
    },
  })

  const autoConnected = useRef(false)
  useEffect(() => {
    if (!autoUrl || autoConnected.current) return
    autoConnected.current = true
    connect.mutate(autoUrl)
  }, [autoUrl, connect])

  if (autoUrl && !connect.isError) {
    return <AuthCard title="Connecting to Jellyfin…" subtitle={autoUrl}>{null}</AuthCard>
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (url.trim()) connect.mutate(url)
  }

  return (
    <AuthCard
      title={unreachable ? 'Server not reachable' : 'Connect to Jellyfin'}
      subtitle={
        unreachable
          ? `${unreachable.name} doesn't answer at ${unreachable.url}. Check that Jellyfin is running, or enter its new address. Your profiles stay signed in.`
          : 'Enter the address of your Jellyfin server.'
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Server address"
          placeholder="http://192.168.1.10:8096"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
          hint={
            devProxyUrl
              ? 'Dev mode: /jellyfin goes through the Vite proxy to JELLYFIN_URL from .env.local. A direct address (http://…:8096) works too.'
              : undefined
          }
        />
        {connect.isError && <ErrorText>{errorMessage(connect.error)}</ErrorText>}
        <Button type="submit" variant="primary" disabled={connect.isPending || !url.trim()}>
          {connect.isPending ? 'Connecting…' : unreachable && normalizeServerUrl(url) === unreachable.url ? 'Retry' : 'Connect'}
        </Button>
      </form>
    </AuthCard>
  )
}
