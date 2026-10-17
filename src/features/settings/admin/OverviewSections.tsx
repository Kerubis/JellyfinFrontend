import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '@/api/errors'
import {
  useActivity,
  useMessageSession,
  useServerAction,
  useServerInfo,
  useSessions,
  useStopSession,
  useStorage,
} from '@/api/queries/admin'
import { ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { ConfirmButton } from '@/components/ConfirmButton'
import type { AdminSession } from '@/domain/admin'
import { formatTime } from '@/domain/player'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { formatBytes, formatRelative, humanize } from '@/lib/format'
import { Meter, SectionTitle } from './parts'
import { ScanProgress } from './ScanProgress'

const PLAY_METHOD = { DirectPlay: 'Direct play', DirectStream: 'Direct stream', Transcode: 'Transcode' } as const

/** Server name, version and the big actions (scan, restart, shutdown). */
export function ServerAdminSection() {
  const info = useServerInfo()
  const action = useServerAction()
  const [done, setDone] = useState<string>()
  const run = (kind: 'scan' | 'restart' | 'shutdown', message: string) =>
    action.mutate(kind, { onSuccess: () => setDone(message) })

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Server</SectionTitle>
      {info.data && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-neutral-500">Name</dt>
          <dd>{info.data.name}</dd>
          <dt className="text-neutral-500">Version</dt>
          <dd>
            Jellyfin {info.data.version}
            {info.data.hasUpdateAvailable && <span className="ml-2 text-xs text-amber-300">update available</span>}
          </dd>
          {info.data.platform && (
            <>
              <dt className="text-neutral-500">Platform</dt>
              <dd>{info.data.platform}</dd>
            </>
          )}
          {info.data.address && (
            <>
              <dt className="text-neutral-500">Address</dt>
              <dd>{info.data.address}</dd>
            </>
          )}
        </dl>
      )}
      {info.data?.hasPendingRestart && <p className="text-sm text-amber-300">A restart is needed to apply recent changes.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={action.isPending} onClick={() => run('scan', 'Library scan started.')}>
          Scan all libraries
        </Button>
        {info.data?.canRestart !== false && (
          <ConfirmButton question="Restart the server?" disabled={action.isPending} onConfirm={() => run('restart', 'Restarting… the server is back in a minute.')}>
            Restart
          </ConfirmButton>
        )}
        <ConfirmButton danger question="Shut the server down?" disabled={action.isPending} onConfirm={() => run('shutdown', 'Shutting down. Start it again on the host.')}>
          Shut down
        </ConfirmButton>
      </div>
      <ScanProgress />
      {done && <p className="text-sm text-emerald-400">{done}</p>}
      {action.isError && <ErrorText>{errorMessage(action.error)}</ErrorText>}
    </section>
  )
}

/** Who is connected and what they're watching; stop playback or send a message. */
export function SessionsSection() {
  const sessions = useSessions()
  const list = sessions.data ?? []
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Active devices</SectionTitle>
      {sessions.isError && <ErrorText>{errorMessage(sessions.error)}</ErrorText>}
      {sessions.data && list.length === 0 && <p className="text-xs text-neutral-500">No device active in the last 15 minutes.</p>}
      <ul className="flex flex-col gap-2">
        {list.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </ul>
    </section>
  )
}

function SessionRow({ session }: { session: AdminSession }) {
  const stop = useStopSession()
  const message = useMessageSession()
  const [composing, setComposing] = useState(false)
  const [text, setText] = useState('')
  const playing = session.nowPlaying

  function send(event: FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    message.mutate({ sessionId: session.id, text: text.trim() }, { onSuccess: () => (setText(''), setComposing(false)) })
  }

  return (
    <li className={`flex flex-col gap-1.5 rounded border px-3 py-2 ${playing ? 'border-accent-700/60 bg-accent-700/10' : 'border-neutral-800'}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">{session.userName ?? 'No user'}</span>
        <span className="text-neutral-400">{session.deviceName}</span>
        <span className="text-xs text-neutral-500">
          {session.client}
          {session.appVersion ? ` ${session.appVersion}` : ''}
        </span>
        {session.lastActivity && <span className="ml-auto text-xs text-neutral-500">{formatRelative(session.lastActivity)}</span>}
      </div>
      {playing && (
        <div className="flex flex-col gap-1">
          <div className="text-sm">
            <span className="text-neutral-100">{playing.title}</span>
            {playing.subtitle && <span className="text-neutral-400"> · {playing.subtitle}</span>}
            {playing.paused && <span className="ml-2 text-xs text-neutral-500">paused</span>}
          </div>
          {playing.durationSeconds && <Meter value={playing.positionSeconds / playing.durationSeconds} />}
          <div className="flex flex-wrap items-center gap-x-3 text-xs text-neutral-500">
            {playing.durationSeconds && (
              <span className="tabular-nums">
                {formatTime(playing.positionSeconds)} / {formatTime(playing.durationSeconds)}
              </span>
            )}
            {playing.playMethod && (
              <span className={playing.playMethod === 'Transcode' ? 'text-amber-300' : ''}>
                {PLAY_METHOD[playing.playMethod]}
                {playing.hardwareAccel && playing.hardwareAccel !== 'none' ? ` (${playing.hardwareAccel})` : ''}
              </span>
            )}
            {playing.transcodeReasons.length > 0 && <span>{playing.transcodeReasons.map(humanize).join(', ')}</span>}
          </div>
        </div>
      )}
      {(playing && session.mediaControl) || session.remoteControl ? (
        <div className="flex flex-wrap items-center gap-2">
          {playing && session.mediaControl && (
            <Button variant="ghost" disabled={stop.isPending} onClick={() => stop.mutate(session.id)}>
              Stop playback
            </Button>
          )}
          {session.remoteControl && !composing && (
            <Button variant="ghost" onClick={() => setComposing(true)}>
              Send message
            </Button>
          )}
          {composing && (
            <form onSubmit={send} className="flex flex-1 gap-2">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Message shown on that device"
                className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm focus:border-accent-500 focus:outline-none"
              />
              <Button type="submit" variant="primary" disabled={message.isPending || !text.trim()}>
                Send
              </Button>
              <Button variant="ghost" onClick={() => setComposing(false)}>
                Cancel
              </Button>
            </form>
          )}
        </div>
      ) : null}
      {(stop.isError || message.isError) && <ErrorText>{errorMessage(stop.error ?? message.error)}</ErrorText>}
    </li>
  )
}

/** Free space per disk (server folders and libraries). */
export function StorageSection() {
  const storage = useStorage()
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Storage</SectionTitle>
      {storage.isError && <ErrorText>{errorMessage(storage.error)}</ErrorText>}
      <ul className="flex flex-col gap-3">
        {(storage.data ?? []).map((disk) => {
          const total = disk.free + disk.used
          const share = total > 0 ? disk.used / total : 0
          return (
            <li key={disk.path} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span>
                  {disk.uses.join(', ')}
                  <span className="ml-2 text-xs text-neutral-500">
                    {disk.path}
                    {disk.network ? ' · network' : ''}
                  </span>
                </span>
                <span className="text-xs text-neutral-400">
                  {formatBytes(disk.free)} free of {formatBytes(total)}
                </span>
              </div>
              <Meter value={share} tone={share > 0.9 ? 'warn' : 'accent'} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const SEVERITY_DOT: Record<string, string> = { Error: 'bg-red-400', Warning: 'bg-amber-400' }

/** The last few activity entries, linking to the full log. */
export function RecentActivitySection() {
  const activity = useActivity()
  const items = activity.data?.pages[0]?.items.slice(0, 6) ?? []
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle
        action={
          <Link to="/settings/activity" className="text-xs text-accent-400 hover:underline">
            All activity
          </Link>
        }
      >
        Recent activity
      </SectionTitle>
      <ActivityList items={items} />
    </section>
  )
}

export function ActivityList({ items }: { items: { id: number; name: string; overview?: string; date: string; severity: string }[] }) {
  const time = useTimeFormat()
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((entry) => (
        <li key={entry.id} className="flex items-start gap-2 text-sm">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${SEVERITY_DOT[entry.severity] ?? 'bg-neutral-600'}`} aria-label={entry.severity} />
          <span className="min-w-0 flex-1">
            {entry.name}
            {entry.overview && <span className="block truncate text-xs text-neutral-500">{entry.overview}</span>}
          </span>
          <span className="shrink-0 text-xs text-neutral-500" title={time.dateTime(entry.date)}>
            {formatRelative(entry.date)}
          </span>
        </li>
      ))}
    </ul>
  )
}
