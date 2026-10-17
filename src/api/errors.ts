import axios from 'axios'

export function isUnauthorized(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401
}

/**
 * Jellyfin itself didn't answer: no response at all (wrong address, server down, timeout), or a proxy in
 * between saying so (502/504: the Vite dev proxy or a reverse proxy can't reach it; 503: Jellyfin starting).
 */
export function isServerUnreachable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const status = error.response?.status
  return status === undefined || status === 502 || status === 503 || status === 504
}

/** A short, user-facing message for a failed request. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (status === undefined || isServerUnreachable(error)) return 'Server not reachable. Check the address and that Jellyfin is running.'
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
