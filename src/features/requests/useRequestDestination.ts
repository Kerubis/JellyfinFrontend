import { useState } from 'react'
import { useSeerrConfig, useSeerrServerOptions, useSeerrServers } from '@/api/seerr'
import { routedServer, routeKey, serverDefaults, type SeerrKind } from '@/domain/seerr'

/**
 * Where a request goes (D39): HD or 4K, the server (the admin's route for anime / other, see routedServer), and
 * that server's quality profile and root folder (its anime ones for anime). Every choice can be changed; changing
 * the server or 4K resets profile and folder to the new server's defaults.
 */
export function useRequestDestination(kind: SeerrKind, anime: boolean) {
  const config = useSeerrConfig()
  const servers = useSeerrServers(kind)
  const [is4k, setIs4kState] = useState(false)
  const [chosenServer, setChosenServer] = useState<number>()
  const [chosenProfile, setProfileId] = useState<number>()
  const [chosenFolder, setRootFolder] = useState<string>()

  const list = servers.data ?? []
  const choices = list.filter((s) => s.is4k === is4k)
  const server =
    choices.find((s) => s.id === chosenServer) ?? routedServer(list, config?.routing ?? {}, routeKey(kind, anime, is4k), is4k)
  const defaults = server ? serverDefaults(server, anime) : { profileId: undefined, rootFolder: undefined }
  const options = useSeerrServerOptions(kind, server?.id)

  const resetDetails = () => {
    setProfileId(undefined)
    setRootFolder(undefined)
  }

  return {
    /** Loading / failed server list: requests then go to Seerr's default. */
    servers,
    has4k: list.some((s) => s.is4k),
    is4k,
    setIs4k: (value: boolean) => {
      setIs4kState(value)
      setChosenServer(undefined)
      resetDetails()
    },
    choices,
    server,
    setServer: (id: number) => {
      setChosenServer(id)
      resetDetails()
    },
    profileId: chosenProfile ?? defaults.profileId,
    setProfileId,
    rootFolder: chosenFolder ?? defaults.rootFolder,
    setRootFolder,
    /** Profiles and folders of the chosen server. */
    options,
  }
}
