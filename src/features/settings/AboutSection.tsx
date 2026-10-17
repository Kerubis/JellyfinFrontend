import { appVersion } from '@/api/runtimeConfig'
import { useSignedIn } from '@/api/session-context'

/** App and server versions. */
export function AboutSection() {
  const { server } = useSignedIn()
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">About</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-neutral-500">App version</dt>
        <dd>{appVersion}</dd>
        <dt className="text-neutral-500">Server</dt>
        <dd>{server.name}</dd>
        <dt className="text-neutral-500">Server version</dt>
        <dd>Jellyfin {server.version}</dd>
        <dt className="text-neutral-500">Source</dt>
        <dd>
          <a href="https://github.com/Kerubis/JellyfinFrontend" target="_blank" rel="noreferrer" className="text-accent-400 hover:underline">
            github.com/Kerubis/JellyfinFrontend
          </a>
        </dd>
      </dl>
    </section>
  )
}
