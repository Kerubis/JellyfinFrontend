import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { useBackups, useCreateBackup, useRestoreBackup, type Backup, type BackupContents } from '@/api/queries/adminBackups'
import { ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { CheckboxField } from '@/components/form'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { SectionTitle } from './parts'

const CONTENTS: { key: keyof BackupContents; label: string }[] = [
  { key: 'Database', label: 'Database (users, watch history, settings)' },
  { key: 'Metadata', label: 'Metadata and artwork' },
  { key: 'Trickplay', label: 'Seek-bar previews' },
  { key: 'Subtitles', label: 'Extracted subtitles' },
]

export function BackupsSection() {
  const backups = useBackups()
  const create = useCreateBackup()
  const [contents, setContents] = useState<BackupContents>({ Database: true, Metadata: false, Trickplay: false, Subtitles: false })

  return (
    <>
      <section className="flex flex-col gap-2">
        <SectionTitle>Create a backup</SectionTitle>
        <p className="text-xs text-neutral-500">Stored on the server (in its data folder). Media files are never included.</p>
        {CONTENTS.map(({ key, label }) => (
          <CheckboxField key={key} label={label} checked={contents[key]} onChange={(v) => setContents((c) => ({ ...c, [key]: v }))} />
        ))}
        <Button variant="primary" className="self-start" disabled={create.isPending || !Object.values(contents).some(Boolean)} onClick={() => create.mutate(contents)}>
          {create.isPending ? 'Creating… (can take a while)' : 'Create backup'}
        </Button>
        {create.isSuccess && <p className="text-sm text-emerald-400">Backup created.</p>}
        {create.isError && <ErrorText>{errorMessage(create.error)}</ErrorText>}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Backups</SectionTitle>
        {backups.isError && <ErrorText>{errorMessage(backups.error)}</ErrorText>}
        {backups.data?.length === 0 && <p className="text-xs text-neutral-500">No backups yet.</p>}
        <ul className="flex flex-col divide-y divide-neutral-800">
          {backups.data?.map((backup) => (
            <BackupRow key={backup.path} backup={backup} />
          ))}
        </ul>
      </section>
    </>
  )
}

function BackupRow({ backup }: { backup: Backup }) {
  const time = useTimeFormat()
  const restore = useRestoreBackup()
  const [confirming, setConfirming] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const included = CONTENTS.filter(({ key }) => backup.contents[key]).map(({ key }) => key.toLowerCase())

  return (
    <li className="flex flex-col gap-2 py-2.5 text-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{backup.created ? time.dateTime(backup.created) : 'Backup'}</div>
          <div className="text-xs text-neutral-500">
            Jellyfin {backup.serverVersion} · {included.join(', ') || 'contents unknown'}
          </div>
          <div className="truncate font-mono text-[11px] text-neutral-600">{backup.path}</div>
        </div>
        {!confirming && (
          <Button variant="ghost" className="text-red-300" onClick={() => setConfirming(true)}>
            Restore…
          </Button>
        )}
      </div>
      {/* Restoring replaces the server's current state: two explicit steps. */}
      {confirming && (
        <div className="flex flex-col gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2">
          <CheckboxField
            label="I understand: users, watch history and settings are replaced by this backup, and the server restarts."
            checked={understood}
            onChange={setUnderstood}
          />
          <div className="flex gap-2">
            <Button variant="danger" disabled={!understood || restore.isPending || restore.isSuccess} onClick={() => restore.mutate(backup.path)}>
              {restore.isSuccess ? 'Restoring, the server restarts…' : 'Restore this backup'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirming(false)
                setUnderstood(false)
              }}
            >
              Cancel
            </Button>
          </div>
          {restore.isError && <ErrorText>{errorMessage(restore.error)}</ErrorText>}
        </div>
      )}
    </li>
  )
}
