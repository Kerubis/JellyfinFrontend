import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { useSaveServerConfig, useServerConfig } from '@/api/queries/adminConfig'
import { ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { getPath, type FieldSpec, type FormSpec } from '@/domain/adminSettings'
import { SectionTitle } from './parts'

const INPUT = 'rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm focus:border-accent-500 focus:outline-none'

/** One settings form described by a FormSpec: loads the configuration, edits a draft, saves explicitly. */
export function ConfigForm({ spec }: { spec: FormSpec }) {
  const config = useServerConfig(spec.source)
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>{spec.title}</SectionTitle>
      {spec.note && <p className="text-xs text-amber-300">{spec.note}</p>}
      {config.isPending && <p className="text-xs text-neutral-500">Loading…</p>}
      {config.isError && <ErrorText>{errorMessage(config.error)}</ErrorText>}
      {/* Keyed by the loaded values, so the draft resets when the server's values change. */}
      {config.data && <ConfigFields key={JSON.stringify(spec.fields.map((f) => getPath(config.data, f.key)))} spec={spec} config={config.data} />}
    </section>
  )
}

function ConfigFields({ spec, config }: { spec: FormSpec; config: Record<string, unknown> }) {
  const initial = Object.fromEntries(spec.fields.map((f) => [f.key, getPath(config, f.key)]))
  const [draft, setDraft] = useState<Record<string, unknown>>(initial)
  const save = useSaveServerConfig(spec.source)
  const changed = spec.fields.filter((f) => f.kind !== 'readonly' && JSON.stringify(draft[f.key]) !== JSON.stringify(initial[f.key]))

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {spec.fields
          .filter((f) => !f.showIf || f.showIf(draft))
          .map((field) => (
            <Field key={field.key} field={field} value={draft[field.key]} onChange={(value) => setDraft((d) => ({ ...d, [field.key]: value }))} />
          ))}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Button
          variant="primary"
          disabled={changed.length === 0 || save.isPending}
          onClick={() => save.mutate(Object.fromEntries(changed.map((f) => [f.key, draft[f.key]])))}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        {changed.length > 0 && (
          <Button variant="ghost" onClick={() => setDraft(initial)}>
            Discard
          </Button>
        )}
        {save.isSuccess && changed.length === 0 && <span className="text-sm text-emerald-400">Saved.{spec.savedNote ? ` ${spec.savedNote}` : ''}</span>}
      </div>
      {save.isError && <ErrorText>{errorMessage(save.error)}</ErrorText>}
    </>
  )
}

/** Comma-separated text for list fields; parsed on blur so typing commas isn't disturbed. */
function ListInput({ value, numbers, placeholder, onChange }: { value: unknown[]; numbers: boolean; placeholder?: string; onChange: (v: unknown[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  const commit = () => {
    const parts = text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    const next = numbers ? parts.map(Number).filter((n) => Number.isFinite(n)) : parts
    setText(next.join(', '))
    onChange(next)
  }
  return <input className={`${INPUT} w-72`} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={commit} />
}

function Field({ field, value, onChange }: { field: FieldSpec; value: unknown; onChange: (value: unknown) => void }) {
  const [reveal, setReveal] = useState(false)
  if (field.kind === 'bool') {
    return (
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-accent-500" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <span>
          {field.label}
          {field.hint && <span className="block text-xs text-neutral-500">{field.hint}</span>}
        </span>
      </label>
    )
  }

  let control
  switch (field.kind) {
    case 'number': {
      const scale = field.scale ?? 1
      control = (
        <span className="flex items-center gap-1.5">
          <input
            type="number"
            className={`${INPUT} w-24`}
            min={field.min}
            max={field.max}
            step={field.step}
            value={typeof value === 'number' ? value / scale : ''}
            onChange={(e) => onChange(Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber * scale : 0)}
          />
          {field.suffix && <span className="text-xs text-neutral-500">{field.suffix}</span>}
        </span>
      )
      break
    }
    case 'text':
      control = field.multiline ? (
        <textarea className={`${INPUT} h-28 w-full font-mono text-xs`} value={typeof value === 'string' ? value : ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <span className="flex items-center gap-1.5">
          <input
            className={`${INPUT} w-72`}
            type={field.secret && !reveal ? 'password' : 'text'}
            autoComplete="off"
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.secret && (
            <button type="button" className="text-xs text-accent-400 hover:underline" onClick={() => setReveal((r) => !r)}>
              {reveal ? 'Hide' : 'Show'}
            </button>
          )}
        </span>
      )
      break
    case 'select':
      control = (
        <select className={INPUT} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
          {/* Keep an unknown stored value selectable instead of silently replacing it. */}
          {typeof value === 'string' && !field.options.some((o) => o.value === value) && <option value={value}>{value}</option>}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
      break
    case 'list':
    case 'numberList':
      control = <ListInput value={Array.isArray(value) ? value : []} numbers={field.kind === 'numberList'} placeholder={field.placeholder} onChange={onChange} />
      break
    case 'multi': {
      const selected = Array.isArray(value) ? (value as string[]) : []
      control = (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {field.options.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-accent-500"
                checked={selected.includes(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))}
              />
              {o.label}
            </label>
          ))}
        </span>
      )
      break
    }
    case 'readonly':
      control = <code className="max-w-md truncate text-xs text-neutral-400">{JSON.stringify(value)}</code>
      break
  }

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-sm sm:pt-1">
        {field.label}
        {field.hint && <span className="block text-xs text-neutral-500">{field.hint}</span>}
      </span>
      <span className="sm:max-w-[60%]">{control}</span>
    </div>
  )
}
