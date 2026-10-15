import axios from 'axios'

export function isUnauthorized(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401
}

/** A short, user-facing message for a failed request. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (status === undefined) return 'Server not reachable. Check the address and that Jellyfin is running.'
    // Jellyfin access schedules: the server refuses the user outside the allowed times.
    const body = typeof error.response?.data === 'string' ? error.response.data : ''
    if ((status === 401 || status === 403) && /not allowed|at this time|schedule/i.test(body)) {
      return 'Not allowed right now (outside the allowed times for this profile).'
    }
    if (status === 401) return 'Wrong username or password.'
    if (status === 403) return 'Not allowed for this user (or not allowed right now).'
    if (status === 404) return 'Not found on the server.'
    if (status >= 500) return `Server error (${status}).`
    return `Request failed (${status}).`
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}

/** TanStack Query retry policy: never retry auth failures. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !isUnauthorized(error) && failureCount < 2
}
