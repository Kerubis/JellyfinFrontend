import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import { useCreateUser, useDeleteUser, useSetUserPassword, useUpdateUserAccount, useUsers } from '@/api/queries/users'
import { useSignedIn } from '@/api/session-context'
import { ErrorText } from '@/components/AuthCard'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { ConfirmButton } from '@/components/ConfirmButton'
import { CheckboxField } from '@/components/form'
import { TextField } from '@/components/TextField'
import { hasHardLimits, type ManagedUser, type UserAccess } from '@/domain/users'
import { formatRelative } from '@/lib/format'
import { LimitsEditor } from '../LimitsEditor'
import { SafetyEditor } from '../SafetyEditor'
import { SectionTitle } from './parts'

/** User management: the list, or one user's details (`?user=`). */
export function UsersSection() {
  const [params, setParams] = useSearchParams()
  const users = useUsers(true)
  const selected = users.data?.find((u) => u.id === params.get('user'))
  if (selected) return <UserDetails key={selected.id} user={selected} onBack={() => setParams({})} />
  return (
    <>
      <UserList users={users.data ?? []} error={users.error} onOpen={(id) => setParams({ user: id })} />
      <AddUserSection onCreated={(id) => setParams({ user: id })} />
    </>
  )
}

function Badge({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'accent' | 'warn' }) {
  const tones = { neutral: 'bg-neutral-800 text-neutral-300', accent: 'bg-accent-700/40 text-accent-300', warn: 'bg-amber-500/20 text-amber-300' }
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tones[tone]}`}>{children}</span>
}

function UserList({ users, error, onOpen }: { users: ManagedUser[]; error: unknown; onOpen: (id: string) => void }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Users</SectionTitle>
      {error ? <ErrorText>{errorMessage(error)}</ErrorText> : null}
      <ul className="flex flex-col divide-y divide-neutral-800">
        {[...users]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((user) => (
            <li key={user.id}>
              <button type="button" onClick={() => onOpen(user.id)} className="flex w-full items-center gap-3 py-2 text-left hover:text-accent-400">
                <Avatar name={user.name} url={user.avatarUrl} />
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm">
                  <span className="font-medium">{user.name}</span>
                  {user.isAdmin && <Badge tone="accent">admin</Badge>}
                  {user.access.disabled && <Badge tone="warn">disabled</Badge>}
                  {user.access.hidden && <Badge>hidden</Badge>}
                  {!user.isAdmin && hasHardLimits(user.limits) && <Badge>limited</Badge>}
                  {!user.hasPassword && <Badge tone="warn">no password</Badge>}
                </span>
                <span className="shrink-0 text-xs text-neutral-500">{user.lastActivity ? `active ${formatRelative(user.lastActivity)}` : 'never active'}</span>
              </button>
            </li>
          ))}
      </ul>
    </section>
  )
}

function AddUserSection({ onCreated }: { onCreated: (id: string) => void }) {
  const create = useCreateUser()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim()) create.mutate({ name, password }, { onSuccess: (id) => id && onCreated(id) })
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Add user</SectionTitle>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <TextField label="Name" className="w-48" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <TextField label="Password" className="w-48" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <Button type="submit" variant="primary" disabled={create.isPending || !name.trim()}>
          {create.isPending ? 'Adding…' : 'Add user'}
        </Button>
      </form>
      <p className="text-xs text-neutral-500">New users can see all libraries; set limits on their page afterwards.</p>
      {create.isError && <ErrorText>{errorMessage(create.error)}</ErrorText>}
    </section>
  )
}

function UserDetails({ user, onBack }: { user: ManagedUser; onBack: () => void }) {
  const { account } = useSignedIn()
  const isMe = user.id === account.userId
  const remove = useDeleteUser()

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={user.name} url={user.avatarUrl} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg font-semibold">{user.name}</span>
          <span className="text-xs text-neutral-500">{user.lastActivity ? `Last active ${formatRelative(user.lastActivity)}` : 'Never active'}</span>
        </div>
        <Button variant="ghost" onClick={onBack}>
          All users
        </Button>
      </div>

      <AccountSection user={user} isMe={isMe} />
      <PasswordSection user={user} />

      <section className="flex flex-col gap-3">
        <SectionTitle>Library access & limits</SectionTitle>
        {user.isAdmin ? <p className="text-xs text-neutral-500">Administrators see every library and can't be limited.</p> : <LimitsEditor user={user} />}
        {!user.isAdmin && <SafetyEditor userId={user.id} />}
      </section>

      {!isMe && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Delete user</SectionTitle>
          <p className="text-xs text-neutral-500">Removes the user and their watch history, favorites and settings from the server.</p>
          <div>
            <ConfirmButton danger question={`Delete ${user.name}?`} disabled={remove.isPending} onConfirm={() => remove.mutate(user.id, { onSuccess: onBack })}>
              Delete user
            </ConfirmButton>
          </div>
          {remove.isError && <ErrorText>{errorMessage(remove.error)}</ErrorText>}
        </section>
      )}
    </>
  )
}

const ACCESS_FIELDS: { key: keyof UserAccess; label: string }[] = [
  { key: 'isAdmin', label: 'Administrator (manages the server and all users)' },
  { key: 'disabled', label: 'Disabled (can’t sign in)' },
  { key: 'hidden', label: 'Hidden from login screens (sign in by typing the name)' },
  { key: 'remoteAccess', label: 'Allow access from outside the home network' },
  { key: 'downloads', label: 'Allow downloads' },
  { key: 'transcoding', label: 'Allow transcoding (off: only files the device can play directly)' },
]

function AccountSection({ user, isMe }: { user: ManagedUser; isMe: boolean }) {
  const update = useUpdateUserAccount()
  const [name, setName] = useState(user.name)
  const [access, setAccess] = useState<UserAccess>(user.access)
  const dirty = name.trim() !== user.name || ACCESS_FIELDS.some(({ key }) => access[key] !== user.access[key])

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Account</SectionTitle>
      <TextField label="Name" className="max-w-xs" value={name} onChange={(e) => setName(e.target.value)} />
      {ACCESS_FIELDS.map(({ key, label }) => (
        <CheckboxField
          key={key}
          label={label}
          checked={access[key]}
          // You can't take away your own admin rights or lock yourself out.
          onChange={(v) => (isMe && (key === 'isAdmin' || key === 'disabled') ? undefined : setAccess((a) => ({ ...a, [key]: v })))}
        />
      ))}
      {isMe && <p className="text-xs text-neutral-500">Your own admin and disabled switches can't be changed here.</p>}
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={!dirty || update.isPending || !name.trim()} onClick={() => update.mutate({ userId: user.id, name, access })}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
        {update.isSuccess && !dirty && <span className="text-sm text-emerald-400">Saved.</span>}
      </div>
      {update.isError && <ErrorText>{errorMessage(update.error)}</ErrorText>}
    </section>
  )
}

function PasswordSection({ user }: { user: ManagedUser }) {
  const setPassword = useSetUserPassword()
  const [password, setValue] = useState('')
  const [message, setMessage] = useState<string>()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!password) return
    setPassword.mutate({ userId: user.id, password }, { onSuccess: () => (setValue(''), setMessage('Password set.')) })
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Password</SectionTitle>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <TextField label="New password" className="w-56" type="password" autoComplete="new-password" value={password} onChange={(e) => setValue(e.target.value)} />
        <Button type="submit" variant="primary" disabled={setPassword.isPending || !password}>
          Set password
        </Button>
        {user.hasPassword && (
          <ConfirmButton
            question="Remove the password?"
            disabled={setPassword.isPending}
            onConfirm={() => setPassword.mutate({ userId: user.id, password: '' }, { onSuccess: () => setMessage('Password removed: signing in needs only the name.') })}
          >
            Remove password
          </ConfirmButton>
        )}
      </form>
      {!user.hasPassword && <p className="text-xs text-amber-300">This user has no password.</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {setPassword.isError && <ErrorText>{errorMessage(setPassword.error)}</ErrorText>}
    </section>
  )
}
