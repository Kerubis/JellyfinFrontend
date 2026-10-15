import { createContext, useContext } from 'react'
import type { Account, Server, SignedInAccount } from '@/domain/auth'

export type Session = {
  server: Server | null
  /** Profiles remembered on this device for the current server. */
  accounts: Account[]
  /** The active, signed-in profile, or null when the login screen should show. */
  account: SignedInAccount | null
  setServer: (server: Server) => void
  /** Forgets the server and every profile stored for it. */
  forgetServer: () => void
  signIn: (account: SignedInAccount) => void
  /** Switches to a stored profile; null returns to the profile picker. */
  switchAccount: (userId: string | null) => void
  /** `lockPicker`: remembered profiles need their password again (used when a kid profile signs out). */
  signOut: (userId: string, options?: { lockPicker?: boolean }) => Promise<void>
  /** Remembered profiles can't be switched to without signing in again (until the next sign-in). */
  pickerLocked: boolean
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside <SessionProvider>')
  return session
}

/** For components that only render when signed in. */
export function useSignedIn(): { server: Server; account: SignedInAccount } {
  const { server, account } = useSession()
  if (!server || !account) throw new Error('useSignedIn used while signed out')
  return { server, account }
}
