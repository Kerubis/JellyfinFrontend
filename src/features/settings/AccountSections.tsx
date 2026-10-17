import { useQuery } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { isQuickConnectEnabled } from '@/api/auth'
import { errorMessage, httpStatus } from '@/api/errors'
import { useAuthorizeQuickConnect, useChangePassword, useDeleteAvatar, useUploadAvatar } from '@/api/queries/account'
import { useSignedIn } from '@/api/session-context'
import { ErrorText } from '@/components/AuthCard'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'

const TITLE = 'text-sm font-semibold tracking-wide text-neutral-400 uppercase'

/** Profile picture: upload a new one or remove it (shown in the header and the profile picker). */
export function AvatarSection() {
  const { account } = useSignedIn()
  const upload = useUploadAvatar()
  const remove = useDeleteAvatar()
  const input = useRef<HTMLInputElement>(null)
  const busy = upload.isPending || remove.isPending
  const error = upload.error ?? remove.error

  return (
    <section className="flex flex-col gap-2">
      <h2 className={TITLE}>Profile picture</h2>
      <div className="flex items-center gap-4">
        <Avatar name={account.name} url={account.avatarUrl} size="lg" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{account.name}</span>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => input.current?.click()}>
              {upload.isPending ? 'Uploading…' : 'Change picture'}
            </Button>
            {account.avatarUrl && (
              <Button variant="ghost" disabled={busy} onClick={() => remove.mutate()}>
                Remove
              </Button>
            )}
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload.mutate(file)
            e.target.value = ''
          }}
        />
      </div>
      {error && <ErrorText>{errorMessage(error)}</ErrorText>}
    </section>
  )
}

export function PasswordSection() {
  const change = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const mismatch = repeat !== '' && next !== repeat

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mismatch) return
    change.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setRepeat('')
        },
      },
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className={TITLE}>Password</h2>
      <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          hint="Leave empty if the profile has no password yet."
        />
        <TextField label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <TextField
          label="Repeat new password"
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
        {mismatch && <ErrorText>The new passwords don't match.</ErrorText>}
        {change.isError && (
          // Jellyfin answers a wrong current password with 403 ("Invalid user or password entered").
          <ErrorText>{httpStatus(change.error) === 403 ? 'The current password is wrong.' : errorMessage(change.error)}</ErrorText>
        )}
        {change.isSuccess && <p className="text-sm text-emerald-400">Password changed.</p>}
        <Button type="submit" variant="primary" className="self-start" disabled={change.isPending || mismatch || next === ''}>
          {change.isPending ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </section>
  )
}

/** Approves the code another device shows on its Quick Connect screen (e.g. sign in the TV from the phone). */
export function QuickConnectSection() {
  const { server } = useSignedIn()
  const enabled = useQuery({ queryKey: ['quickConnectEnabled', server.url], queryFn: () => isQuickConnectEnabled(server), staleTime: 60_000 })
  const authorize = useAuthorizeQuickConnect()
  const [code, setCode] = useState('')
  if (enabled.data === false) return null

  function submit(event: FormEvent) {
    event.preventDefault()
    if (code.trim()) authorize.mutate(code, { onSuccess: () => setCode('') })
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className={TITLE}>Quick Connect</h2>
      <p className="text-xs text-neutral-500">Sign in another device without typing a password: choose Quick Connect there and enter its code here.</p>
      <form onSubmit={submit} className="flex items-end gap-2">
        <TextField
          label="Code"
          className="w-40"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={authorize.isPending || !code.trim()}>
          {authorize.isPending ? 'Approving…' : 'Approve'}
        </Button>
      </form>
      {authorize.isError && <ErrorText>{errorMessage(authorize.error)}</ErrorText>}
      {authorize.isSuccess && <p className="text-sm text-emerald-400">Approved: the other device signs in now.</p>}
    </section>
  )
}
