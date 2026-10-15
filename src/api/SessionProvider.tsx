import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Account, Server, SignedInAccount } from '@/domain/auth'
import { readJson, writeJson } from '@/lib/storage'
import { endSession, registerCapabilities } from './auth'
import { onUnauthorized } from './client'
import { SessionContext, type Session } from './session-context'

const SERVER_KEY = 'jff.server'
const ACCOUNTS_KEY = 'jff.accounts'
const ACTIVE_KEY = 'jff.activeUserId'
const PICKER_LOCK_KEY = 'jff.pickerLocked'

function isSignedIn(account: Account | undefined): account is SignedInAccount {
  return !!account?.accessToken
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [server, setServerState] = useState<Server | null>(() => readJson<Server | null>(SERVER_KEY, null))
  const [allAccounts, setAllAccounts] = useState<Account[]>(() => readJson<Account[]>(ACCOUNTS_KEY, []))
  const [activeUserId, setActiveUserId] = useState<string | null>(() => readJson<string | null>(ACTIVE_KEY, null))
  const [pickerLocked, setPickerLocked] = useState(() => readJson<boolean>(PICKER_LOCK_KEY, false))

  useEffect(() => writeJson(SERVER_KEY, server), [server])
  useEffect(() => writeJson(ACCOUNTS_KEY, allAccounts), [allAccounts])
  useEffect(() => writeJson(ACTIVE_KEY, activeUserId), [activeUserId])
  useEffect(() => writeJson(PICKER_LOCK_KEY, pickerLocked || null), [pickerLocked])

  const accounts = useMemo(
    () => (server ? allAccounts.filter((a) => a.serverId === server.id) : []),
    [allAccounts, server],
  )
  const active = accounts.find((a) => a.userId === activeUserId)
  const account = isSignedIn(active) ? active : null

  // A rejected token (revoked, expired, user deleted) sends that profile back to login.
  useEffect(
    () =>
      onUnauthorized((token) => {
        setAllAccounts((list) => list.map((a) => (a.accessToken === token ? { ...a, accessToken: null } : a)))
      }),
    [],
  )

  useEffect(() => {
    if (!server || !account) return
    registerCapabilities(server, account).catch((error: unknown) => console.warn('Capabilities not registered', error))
  }, [server, account])

  const setServer = useCallback((next: Server) => setServerState(next), [])

  const forgetServer = useCallback(() => {
    setAllAccounts((list) => list.filter((a) => a.serverId !== server?.id))
    setActiveUserId(null)
    setServerState(null)
    queryClient.clear()
  }, [server, queryClient])

  const signIn = useCallback((next: SignedInAccount) => {
    setPickerLocked(false)
    setAllAccounts((list) => [
      ...list.filter((a) => !(a.serverId === next.serverId && a.userId === next.userId)),
      next,
    ])
    setActiveUserId(next.userId)
  }, [])

  const switchAccount = useCallback((userId: string | null) => setActiveUserId(userId), [])

  const signOut = useCallback(
    async (userId: string, options?: { lockPicker?: boolean }) => {
      if (options?.lockPicker) setPickerLocked(true)
      const target = accounts.find((a) => a.userId === userId)
      if (server && isSignedIn(target)) {
        await endSession(server, target).catch((error: unknown) => console.warn('Session end failed', error))
      }
      setAllAccounts((list) => list.filter((a) => !(a.serverId === server?.id && a.userId === userId)))
      if (userId === activeUserId) setActiveUserId(null)
      queryClient.removeQueries({ queryKey: ['user', userId] })
    },
    [accounts, server, activeUserId, queryClient],
  )

  const session = useMemo<Session>(
    () => ({ server, accounts, account, setServer, forgetServer, signIn, switchAccount, signOut, pickerLocked }),
    [server, accounts, account, setServer, forgetServer, signIn, switchAccount, signOut, pickerLocked],
  )

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
