import { useState, type FormEvent } from 'react'
import { errorMessage } from '@/api/errors'
import { useServerAction } from '@/api/queries/admin'
import {
  useAddLibrary,
  useAdminLibraries,
  useLibraryFolder,
  useRemoveLibrary,
  useRenameLibrary,
  useSaveLibrarySettings,
} from '@/api/queries/adminLibraries'
import { ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { ConfirmButton } from '@/components/ConfirmButton'
import { CheckboxField, SelectField } from '@/components/form'
import { TextField } from '@/components/TextField'
import { LIBRARY_KINDS, type AdminLibrary, type LibraryKind, type LibrarySettings } from '@/domain/admin'
import { FolderPicker } from './FolderPicker'
import { SectionTitle, TwoColumns } from './parts'
import { ScanProgress } from './ScanProgress'

const KIND_LABEL: Record<string, string> = Object.fromEntries(LIBRARY_KINDS.map((k) => [k.value, k.label]))

/** Libraries: folders, options, add / rename / remove, scan. */
export function LibrariesSection() {
  const libraries = useAdminLibraries()
  const scan = useServerAction()
  return (
    <TwoColumns
      left={
        <>
          <section className="flex flex-col gap-2">
            <SectionTitle
              action={
                <Button disabled={scan.isPending} onClick={() => scan.mutate('scan')}>
                  {scan.isSuccess ? 'Scan started' : 'Scan all libraries'}
                </Button>
              }
            >
              Libraries
            </SectionTitle>
            <p className="text-xs text-neutral-500">
              A scan picks up new and changed files in every library (Jellyfin only rescans all libraries at once).
            </p>
            <ScanProgress />
            {libraries.isError && <ErrorText>{errorMessage(libraries.error)}</ErrorText>}
          </section>
          {libraries.data?.map((library) => (
            <LibraryCard key={library.id} library={library} />
          ))}
        </>
      }
      right={<AddLibrarySection />}
    />
  )
}

function LibraryCard({ library }: { library: AdminLibrary }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded border border-neutral-800">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5">
        <span className="flex-1 text-sm font-semibold">{library.name}</span>
        <span className="text-xs text-neutral-500">{library.kind ? (KIND_LABEL[library.kind] ?? library.kind) : 'Mixed movies and shows'}</span>
        <span className="text-xs text-neutral-500">
          {library.paths.length} folder{library.paths.length === 1 ? '' : 's'}
        </span>
        {library.refreshing && <span className="text-xs text-accent-400">scanning…</span>}
        <span aria-hidden className="text-neutral-500">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-5 border-t border-neutral-800 px-3 py-3">
          <FoldersBlock library={library} />
          <SettingsBlock key={JSON.stringify(library.settings)} library={library} />
          <ManageBlock library={library} />
        </div>
      )}
    </section>
  )
}

const SUBTITLE = 'text-xs font-semibold tracking-wide text-neutral-400 uppercase'

function FoldersBlock({ library }: { library: AdminLibrary }) {
  const folder = useLibraryFolder()
  const [picking, setPicking] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <h3 className={SUBTITLE}>Folders</h3>
      <ul className="flex flex-col gap-1">
        {library.paths.map((path) => (
          <li key={path} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-mono text-xs">{path}</span>
            {library.paths.length > 1 && (
              <ConfirmButton question="Remove this folder?" disabled={folder.isPending} onConfirm={() => folder.mutate({ library: library.name, path, action: 'remove' })}>
                Remove
              </ConfirmButton>
            )}
          </li>
        ))}
      </ul>
      {picking ? (
        <FolderPicker
          onCancel={() => setPicking(false)}
          onPick={(path) => folder.mutate({ library: library.name, path, action: 'add' }, { onSuccess: () => setPicking(false) })}
        />
      ) : (
        <Button className="self-start" onClick={() => setPicking(true)}>
          Add folder
        </Button>
      )}
      {folder.isError && <ErrorText>{errorMessage(folder.error)}</ErrorText>}
    </div>
  )
}

const REFRESH_OPTIONS = [
  { value: '0', label: 'Never' },
  { value: '30', label: 'Every 30 days' },
  { value: '60', label: 'Every 60 days' },
  { value: '90', label: 'Every 90 days' },
]

const SWITCHES: { key: keyof LibrarySettings; label: string; requires?: keyof LibrarySettings }[] = [
  { key: 'realtimeMonitor', label: 'Watch the folders for new files (real-time monitoring)' },
  { key: 'saveLocalMetadata', label: 'Save artwork and NFO files next to the media' },
  { key: 'embeddedTitles', label: 'Prefer titles embedded in the files' },
  { key: 'trickplay', label: 'Create seek-bar preview images (trickplay)' },
  { key: 'trickplayDuringScan', label: '… already during library scans (otherwise by the nightly task)', requires: 'trickplay' },
  { key: 'chapterImages', label: 'Create chapter images' },
  { key: 'chapterImagesDuringScan', label: '… already during library scans', requires: 'chapterImages' },
]

function SettingsBlock({ library }: { library: AdminLibrary }) {
  const save = useSaveLibrarySettings()
  const [draft, setDraft] = useState<LibrarySettings>(library.settings)
  const set = (patch: Partial<LibrarySettings>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(library.settings)

  return (
    <div className="flex flex-col gap-2">
      <h3 className={SUBTITLE}>Options</h3>
      {SWITCHES.filter((s) => !s.requires || draft[s.requires]).map(({ key, label }) => (
        <CheckboxField key={key} label={label} checked={draft[key] as boolean} onChange={(v) => set({ [key]: v })} />
      ))}
      <div className="flex flex-wrap gap-3">
        <TextField
          label="Metadata language"
          className="w-36"
          placeholder="server default"
          value={draft.metadataLanguage}
          onChange={(e) => set({ metadataLanguage: e.target.value.trim() })}
        />
        <TextField
          label="Country"
          className="w-28"
          placeholder="e.g. AT"
          value={draft.metadataCountry}
          onChange={(e) => set({ metadataCountry: e.target.value.trim().toUpperCase() })}
        />
      </div>
      <SelectField
        label="Refresh metadata"
        value={String(draft.refreshDays)}
        options={REFRESH_OPTIONS.some((o) => o.value === String(draft.refreshDays)) ? REFRESH_OPTIONS : [...REFRESH_OPTIONS, { value: String(draft.refreshDays), label: `Every ${draft.refreshDays} days` }]}
        onChange={(v) => set({ refreshDays: Number(v) })}
      />
      {draft.trickplay && !library.settings.trickplay && (
        <p className="text-xs text-amber-300">Creating preview images for a whole library takes long and uses a lot of CPU (or the GPU, if hardware encoding works).</p>
      )}
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate({ id: library.id, settings: draft })}>
          {save.isPending ? 'Saving…' : 'Save options'}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setDraft(library.settings)}>
            Discard
          </Button>
        )}
      </div>
      {save.isError && <ErrorText>{errorMessage(save.error)}</ErrorText>}
    </div>
  )
}

function ManageBlock({ library }: { library: AdminLibrary }) {
  const rename = useRenameLibrary()
  const remove = useRemoveLibrary()
  const [name, setName] = useState(library.name)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim() && name.trim() !== library.name) rename.mutate({ name: library.name, newName: name })
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className={SUBTITLE}>Manage</h3>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <TextField label="Name" className="w-56" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={rename.isPending || !name.trim() || name.trim() === library.name}>
          Rename
        </Button>
      </form>
      <div>
        <ConfirmButton danger question={`Remove ${library.name}?`} disabled={remove.isPending} onConfirm={() => remove.mutate(library.name)}>
          Remove library
        </ConfirmButton>
      </div>
      <p className="text-xs text-neutral-500">Removing a library deletes it from Jellyfin (watch history for its items too); the files on disk stay.</p>
      {(rename.isError || remove.isError) && <ErrorText>{errorMessage(rename.error ?? remove.error)}</ErrorText>}
    </div>
  )
}

function AddLibrarySection() {
  const add = useAddLibrary()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<LibraryKind>('tvshows')
  const [path, setPath] = useState<string>()
  const [picking, setPicking] = useState(false)

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Add library</SectionTitle>
      <div className="flex flex-wrap items-end gap-3">
        <TextField label="Name" className="w-48" value={name} onChange={(e) => setName(e.target.value)} />
        <SelectField label="Content" value={kind} options={[...LIBRARY_KINDS]} onChange={(v) => setKind(v)} />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-neutral-400">Folder:</span>
        <span className="font-mono text-xs">{path ?? 'none chosen'}</span>
        {!picking && (
          <Button variant="ghost" onClick={() => setPicking(true)}>
            {path ? 'Change' : 'Choose…'}
          </Button>
        )}
      </div>
      {picking && (
        <FolderPicker
          onCancel={() => setPicking(false)}
          onPick={(p) => {
            setPath(p)
            setPicking(false)
          }}
        />
      )}
      <Button
        variant="primary"
        className="self-start"
        disabled={add.isPending || !name.trim() || !path}
        onClick={() =>
          path &&
          add.mutate(
            { name, kind, path },
            {
              onSuccess: () => {
                setName('')
                setPath(undefined)
              },
            },
          )
        }
      >
        {add.isPending ? 'Adding…' : 'Add library'}
      </Button>
      {add.isError && <ErrorText>{errorMessage(add.error)}</ErrorText>}
    </section>
  )
}
