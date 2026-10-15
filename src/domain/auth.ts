export type Server = {
  id: string
  name: string
  version: string
  /** Absolute base URL used for API calls (in dev: the Vite proxy path). */
  url: string
}

/** A profile remembered on this device. `accessToken` is null once the server rejected it. */
export type Account = {
  serverId: string
  userId: string
  name: string
  avatarUrl?: string
  accessToken: string | null
}

export type SignedInAccount = Account & { accessToken: string }

export type User = {
  id: string
  name: string
  hasPassword: boolean
  avatarUrl?: string
}
