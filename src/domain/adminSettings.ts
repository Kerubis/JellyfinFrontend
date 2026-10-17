// Server settings pages (Settings → Administration) are described as data: which configuration they edit and
// which fields they show. One form component renders any of them; everything not listed stays untouched.

/** Where the values live. `system` = /System/Configuration, `named` = /System/Configuration/{key}. */
export type ConfigSource = { kind: 'system' } | { kind: 'named'; key: string } | { kind: 'plugin'; id: string }

export type Option = { value: string; label: string }

type Base = {
  /** Property path in the configuration, dots for nested objects ("TrickplayOptions.Interval"). */
  key: string
  label: string
  hint?: string
  /** Only shown when this returns true for the current (unsaved) values. */
  showIf?: (values: Record<string, unknown>) => boolean
}

export type FieldSpec = Base &
  (
    | { kind: 'bool' }
    | { kind: 'number'; min?: number; max?: number; step?: number; suffix?: string; /** Shown value = stored / scale. */ scale?: number }
    | { kind: 'text'; placeholder?: string; multiline?: boolean; secret?: boolean }
    | { kind: 'select'; options: readonly Option[] }
    /** string[] edited as comma-separated text. */
    | { kind: 'list'; placeholder?: string }
    /** number[] edited as comma-separated text. */
    | { kind: 'numberList'; placeholder?: string }
    /** string[] as checkboxes. */
    | { kind: 'multi'; options: readonly Option[] }
    /** Shown, not editable (e.g. nested objects of a plugin). */
    | { kind: 'readonly' }
  )

export type FormSpec = {
  title: string
  source: ConfigSource
  fields: FieldSpec[]
  /** Shown above the fields, e.g. a warning. */
  note?: string
  /** Notice after saving (e.g. "takes effect after a restart"). */
  savedNote?: string
}

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, part) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined), obj)
}

/** Copy of `obj` with `path` set to `value` (nested objects copied along the way). */
export function setPath<T extends Record<string, unknown>>(obj: T, path: string, value: unknown): T {
  const [head = '', ...rest] = path.split('.')
  if (rest.length === 0) return { ...obj, [head]: value }
  const child = obj[head]
  return { ...obj, [head]: setPath(child && typeof child === 'object' ? (child as Record<string, unknown>) : {}, rest.join('.'), value) }
}

/** "TmdbApiKey" → "Tmdb api key". */
export function labelFromKey(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Fields for a plugin's configuration, inferred from its JSON (plugins ship their settings UI only for the official
 * client): booleans, numbers, strings, lists of strings / numbers; anything nested is shown read-only.
 */
export function inferFields(config: Record<string, unknown>): FieldSpec[] {
  return Object.entries(config).map(([key, value]): FieldSpec => {
    const label = labelFromKey(key)
    if (typeof value === 'boolean') return { kind: 'bool', key, label }
    if (typeof value === 'number') return { kind: 'number', key, label }
    if (typeof value === 'string' || value === null) return { kind: 'text', key, label, secret: /key|password|token|secret/i.test(key) }
    if (Array.isArray(value) && value.every((v) => typeof v === 'number')) return value.length > 0 ? { kind: 'numberList', key, label } : { kind: 'list', key, label }
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return { kind: 'list', key, label }
    return { kind: 'readonly', key, label }
  })
}
