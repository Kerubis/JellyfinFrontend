import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { Server } from '@/domain/auth'
import { connectToServer } from '../auth'
import { isServerUnreachable } from '../errors'

const KEY = ['serverReachable'] as const

/**
 * Whether the saved server answers, checked once per page load (in the background, the app renders
 * meanwhile). Only "Jellyfin doesn't answer" counts (see isServerUnreachable), not other HTTP errors.
 */
export function useServerUnreachable(server: Server | null): boolean {
  const check = useQuery({
    queryKey: [...KEY, server?.url],
    enabled: !!server,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // One try (8 s timeout): a blip at page load only costs one click on "Retry".
    retry: false,
    queryFn: () => (server ? connectToServer(server.url) : null),
  })
  return check.isError && isServerUnreachable(check.error)
}

/** Forgets the result, so the next render checks again (after connecting from the setup screen). */
export function useResetServerCheck() {
  const queryClient = useQueryClient()
  return useCallback(() => queryClient.resetQueries({ queryKey: KEY }), [queryClient])
}
