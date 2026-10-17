import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { finishQuickConnect, isQuickConnectApproved, isQuickConnectEnabled, startQuickConnect } from '@/api/auth'
import type { Server, SignedInAccount } from '@/domain/auth'

const POLL_MS = 3000

/** Quick Connect flow: request a code, poll until it's approved elsewhere, then exchange it for a token. */
export function useQuickConnect(server: Server, onSignedIn: (account: SignedInAccount) => void) {
  const [request, setRequest] = useState<{ code: string; secret: string } | null>(null)

  const enabled = useQuery({
    queryKey: ['server', server.id, 'quickConnectEnabled'],
    queryFn: () => isQuickConnectEnabled(server),
    staleTime: 60_000,
  })

  const start = useMutation({ mutationFn: () => startQuickConnect(server), onSuccess: setRequest })

  const approved = useQuery({
    queryKey: ['quickConnect', request?.secret],
    queryFn: () => (request ? isQuickConnectApproved(server, request.secret) : false),
    enabled: !!request,
    refetchInterval: (query) => (query.state.data ? false : POLL_MS),
    // The code gets approved on another device, so this window usually isn't focused meanwhile.
    refetchIntervalInBackground: true,
    gcTime: 0,
  })

  const finish = useMutation({
    mutationFn: (secret: string) => finishQuickConnect(server, secret),
    onSuccess: onSignedIn,
  })

  const { mutate: finishMutate, isIdle: finishIdle } = finish
  useEffect(() => {
    if (approved.data && request && finishIdle) finishMutate(request.secret)
  }, [approved.data, request, finishIdle, finishMutate])

  return {
    available: enabled.data === true,
    code: request?.code ?? null,
    starting: start.isPending,
    error: start.error ?? approved.error ?? finish.error,
    start: () => start.mutate(),
    cancel: () => {
      setRequest(null)
      start.reset()
      finish.reset()
    },
  }
}

