import radarrIcon from '@/assets/radarr.png'
import sonarrIcon from '@/assets/sonarr.svg'
import { useSeerrMedia, useSeerrServers } from '@/api/seerr'
import { useCurrentUser } from '@/api/queries/users'
import { buttonClass } from '@/components/buttonClass'
import type { SeerrKind } from '@/domain/seerr'

type Props = { kind: SeerrKind; tmdbId: number | undefined }

/** "Open in Sonarr / Radarr" for admins, one link per server (HD, 4K) Seerr knows the title on. */
export function ServiceLinks({ kind, tmdbId }: Props) {
  const me = useCurrentUser()
  const admin = !!me.data?.isAdmin
  const media = useSeerrMedia(admin && tmdbId ? { kind, tmdbId } : undefined)
  const servers = useSeerrServers(kind, admin ? undefined : null)
  const app = kind === 'tv' ? 'Sonarr' : 'Radarr'
  return media.data?.services.map((service) => {
    const server = servers.data?.find((s) => s.id === service.serverId && s.is4k === service.is4k)
    return (
      <a
        key={service.url}
        href={service.url}
        target="_blank"
        rel="noreferrer"
        title={`Open in ${app}${server ? ` (${server.name})` : ''}`}
        className={buttonClass('outlined', 'flex items-center gap-1.5')}
      >
        <img src={kind === 'tv' ? sonarrIcon : radarrIcon} alt="" className="size-4" />
        Open in {server?.name ?? `${app}${service.is4k ? ' 4K' : ''}`}
      </a>
    )
  })
}
