import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { useServerFolders } from '@/api/queries/adminLibraries'
import { ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'

/** Parent of a server path ("/tv/anime" → "/tv", "/tv" → "/"); null above the root = the drive list. */
function parentOf(path: string): string | null {
  const trimmed = path.replace(/[/\\]+$/, '')
  if (trimmed === '' || /^[A-Za-z]:$/.test(trimmed)) return null
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return cut <= 0 ? '/' : trimmed.slice(0, cut)
}

/** Browse the server's folders (as Jellyfin sees them, e.g. inside its container) and pick one. */
export function FolderPicker({ onPick, onCancel }: { onPick: (path: string) => void; onCancel: () => void }) {
  const [path, setPath] = useState<string | null>(null)
  const folders = useServerFolders(path)

  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-700 bg-neutral-900/60 p-2">
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" disabled={path === null} onClick={() => setPath(path === null ? null : parentOf(path))}>
          ↑ Up
        </Button>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-300">{path ?? 'Drives'}</span>
      </div>
      <ul className="max-h-64 overflow-y-auto">
        {folders.isPending && <li className="px-2 py-1 text-xs text-neutral-500">Loading…</li>}
        {folders.data?.length === 0 && <li className="px-2 py-1 text-xs text-neutral-500">No subfolders.</li>}
        {folders.data?.map((f) => (
          <li key={f.path}>
            <button type="button" onClick={() => setPath(f.path)} className="w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-neutral-800">
              📁 {f.name}
            </button>
          </li>
        ))}
      </ul>
      {folders.isError && <ErrorText>{errorMessage(folders.error)}</ErrorText>}
      <div className="flex gap-2">
        <Button variant="primary" disabled={path === null} onClick={() => path && onPick(path)}>
          Use this folder
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
