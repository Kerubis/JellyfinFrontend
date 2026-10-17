import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { errorMessage } from '@/api/errors'
import { useLogFile, useLogFiles } from '@/api/queries/admin'
import { ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { formatBytes, formatRelative } from '@/lib/format'
import { SectionTitle } from './parts'

/** Server log files; `?file=` opens one in the viewer (back/forward keep the place). */
export function LogsSection() {
  const [params, setParams] = useSearchParams()
  const file = params.get('file')
  return file ? <LogViewer name={file} onClose={() => setParams({})} /> : <LogList onOpen={(name) => setParams({ file: name })} />
}

function LogList({ onOpen }: { onOpen: (name: string) => void }) {
  const files = useLogFiles()
  const [showFfmpeg, setShowFfmpeg] = useState(false)
  const all = files.data ?? []
  // FFmpeg writes one log per stream; they bury the server logs.
  const shown = showFfmpeg ? all : all.filter((f) => !f.name.startsWith('FFmpeg'))
  const ffmpegCount = all.length - all.filter((f) => !f.name.startsWith('FFmpeg')).length

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle
        action={
          ffmpegCount > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-neutral-400">
              <input type="checkbox" checked={showFfmpeg} onChange={(e) => setShowFfmpeg(e.target.checked)} />
              FFmpeg logs ({ffmpegCount})
            </label>
          )
        }
      >
        Log files
      </SectionTitle>
      {files.isError && <ErrorText>{errorMessage(files.error)}</ErrorText>}
      <ul className="flex flex-col divide-y divide-neutral-800">
        {shown.map((f) => (
          <li key={f.name}>
            <button type="button" onClick={() => onOpen(f.name)} className="flex w-full items-baseline justify-between gap-3 py-1.5 text-left text-sm hover:text-accent-400">
              <span className="min-w-0 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-neutral-500">
                {formatBytes(f.size)} · {formatRelative(f.modified)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

const LEVEL_TONE: [RegExp, string][] = [
  [/\[(ERR|FTL)\]/, 'text-red-300'],
  [/\[WRN\]/, 'text-amber-300'],
]

function LogViewer({ name, onClose }: { name: string; onClose: () => void }) {
  const log = useLogFile(name)
  const [filter, setFilter] = useState('')
  const lines = (log.data ?? '').split('\n')
  const needle = filter.trim().toLowerCase()
  const shown = needle ? lines.filter((l) => l.toLowerCase().includes(needle)) : lines

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <SectionTitle
        action={
          <Button variant="ghost" onClick={onClose}>
            All log files
          </Button>
        }
      >
        <span className="break-all normal-case">{name}</span>
      </SectionTitle>
      <div className="flex items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter lines, e.g. ERR or a title"
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm focus:border-accent-500 focus:outline-none"
        />
        <Button variant="ghost" disabled={log.isFetching} onClick={() => void log.refetch()}>
          Reload
        </Button>
        <span className="text-xs text-neutral-500 tabular-nums">
          {shown.length}/{lines.length} lines
        </span>
      </div>
      {log.isPending && <p className="text-sm text-neutral-500">Loading…</p>}
      {log.isError && <ErrorText>{errorMessage(log.error)}</ErrorText>}
      {log.data !== undefined && (
        <pre className="max-h-[70vh] overflow-auto rounded border border-neutral-800 bg-black/40 p-2 text-[11px] leading-snug">
          {shown.map((line, i) => (
            <div key={i} className={LEVEL_TONE.find(([re]) => re.test(line))?.[1]}>
              {line || ' '}
            </div>
          ))}
        </pre>
      )}
    </section>
  )
}
