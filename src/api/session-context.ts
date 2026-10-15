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
  signOut: (userId: string) => Promise<void>
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
