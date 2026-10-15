import { useMutation } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { loginWithPassword } from '@/api/auth'
import { errorMessage } from '@/api/errors'
import { useSession } from '@/api/session-context'
import { AuthCard, ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import type { Server } from '@/domain/auth'
import { ProfileGrid } from './ProfileGrid'
import { QuickConnectPanel } from './QuickConnectPanel'

export function LoginPage({ server }: { server: Server }) {
  const { signIn, forgetServer } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const passwordRef = useRef<HTMLInputElement>(null)
  const login = useMutation({
    mutationFn: () => loginWithPassword(server, username.trim(), password),
    onSuccess: signIn,
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (username.trim()) login.mutate()
  }

  function pickUser(name: string) {
    setUsername(name)
    setPassword('')
    passwordRef.current?.focus()
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle={
        <>
          {server.name} · Jellyfin {server.version}{' '}
          <button type="button" onClick={forgetServer} className="text-violet-400 hover:underline">
            Change server
          </button>
        </>
      }
    >
      <ProfileGrid server={server} onPickUser={pickUser} />

      <form onSubmit={submit} className="flex flex-col gap-3">
        <TextField
          label="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <TextField
          ref={passwordRef}
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Leave empty if the user has no password."
        />
        {login.isError && <ErrorText>{errorMessage(login.error)}</ErrorText>}
        <Button type="submit" variant="primary" disabled={login.isPending || !username.trim()}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <QuickConnectPanel server={server} />
    </AuthCard>
  )
}
