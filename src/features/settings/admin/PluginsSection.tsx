import { useState, type FormEvent } from 'react'
import { errorMessage } from '@/api/errors'
import { useServerConfig } from '@/api/queries/adminConfig'
import {
  useCatalog,
  useInstallPackage,
  usePluginAction,
  usePlugins,
  useRepositories,
  useSaveRepositories,
  type Plugin,
} from '@/api/queries/adminPlugins'
import { ErrorText } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { ConfirmButton } from '@/components/ConfirmButton'
import { TextField } from '@/components/TextField'
import { inferFields } from '@/domain/adminSettings'
import { ConfigForm } from './ConfigForm'
import { SectionTitle } from './parts'

const STATUS_TONE: Record<string, string> = {
  Active: 'bg-emerald-500/20 text-emerald-300',
  Restart: 'bg-amber-500/20 text-amber-300',
  Disabled: 'bg-neutral-700 text-neutral-300',
  Malfunctioned: 'bg-red-500/20 text-red-300',
  NotSupported: 'bg-red-500/20 text-red-300',
}

export function InstalledPluginsSection() {
  const plugins = usePlugins()
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Installed plugins</SectionTitle>
      {plugins.isError && <ErrorText>{errorMessage(plugins.error)}</ErrorText>}
      <ul className="flex flex-col divide-y divide-neutral-800">
        {plugins.data?.map((plugin) => (
          <PluginRow key={`${plugin.id}-${plugin.version}`} plugin={plugin} />
        ))}
      </ul>
    </section>
  )
}

function PluginRow({ plugin }: { plugin: Plugin }) {
  const action = usePluginAction()
  const [settings, setSettings] = useState(false)
  const disabled = plugin.status === 'Disabled'
  return (
    <li className="flex flex-col gap-2 py-2.5">
      <div className="flex items-start gap-3">
        {plugin.imageUrl ? (
          <img src={plugin.imageUrl} alt="" className="size-10 shrink-0 rounded bg-neutral-800 object-contain" />
        ) : (
          <span className="size-10 shrink-0 rounded bg-neutral-800" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{plugin.name}</span>
            <span className="text-xs text-neutral-500">{plugin.version}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_TONE[plugin.status] ?? 'bg-neutral-800 text-neutral-300'}`}>
              {plugin.status === 'Restart' ? 'restart needed' : plugin.status.toLowerCase()}
            </span>
          </div>
          {plugin.description && <p className="text-xs text-neutral-500">{plugin.description}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-13">
        {plugin.configurable && (
          <Button variant={settings ? 'secondary' : 'ghost'} onClick={() => setSettings((s) => !s)}>
            Settings
          </Button>
        )}
        <Button variant="ghost" disabled={action.isPending} onClick={() => action.mutate({ plugin, action: disabled ? 'enable' : 'disable' })}>
          {disabled ? 'Enable' : 'Disable'}
        </Button>
        {plugin.canUninstall && (
          <ConfirmButton danger question={`Uninstall ${plugin.name}?`} disabled={action.isPending} onConfirm={() => action.mutate({ plugin, action: 'uninstall' })}>
            Uninstall
          </ConfirmButton>
        )}
      </div>
      {action.isError && <ErrorText>{errorMessage(action.error)}</ErrorText>}
      {settings && <PluginSettings plugin={plugin} />}
    </li>
  )
}

/** The plugin's stored settings as a generated form (its own settings page only exists for the official client). */
function PluginSettings({ plugin }: { plugin: Plugin }) {
  const source = { kind: 'plugin', id: plugin.id } as const
  const config = useServerConfig(source)
  if (config.isPending) return <p className="text-xs text-neutral-500">Loading…</p>
  if (config.isError) return <ErrorText>{errorMessage(config.error)}</ErrorText>
  const fields = inferFields(config.data)
  return (
    <div className="ml-13 rounded border border-neutral-800 px-3 py-2">
      {fields.length === 0 ? (
        <p className="text-xs text-neutral-500">This plugin has no settings.</p>
      ) : (
        <ConfigForm spec={{ title: `${plugin.name} settings`, source, fields }} />
      )}
    </div>
  )
}

export function CatalogSection() {
  const plugins = usePlugins()
  const [open, setOpen] = useState(false)
  const catalog = useCatalog(open)
  const install = useInstallPackage()
  const [search, setSearch] = useState('')
  const installed = new Set((plugins.data ?? []).map((p) => p.name.toLowerCase()))
  const needle = search.trim().toLowerCase()
  const shown = (catalog.data ?? []).filter(
    (p) => !needle || p.name.toLowerCase().includes(needle) || p.overview.toLowerCase().includes(needle) || p.category.toLowerCase().includes(needle),
  )

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Catalog</SectionTitle>
      {!open ? (
        <Button className="self-start" onClick={() => setOpen(true)}>
          Browse plugins
        </Button>
      ) : (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or category"
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm focus:border-accent-500 focus:outline-none"
          />
          {catalog.isPending && <p className="text-xs text-neutral-500">Loading the catalog…</p>}
          {catalog.isError && <ErrorText>{errorMessage(catalog.error)}</ErrorText>}
          {install.isSuccess && <p className="text-sm text-emerald-400">Installed. Restart the server to load it.</p>}
          {install.isError && <ErrorText>{errorMessage(install.error)}</ErrorText>}
          <ul className="flex max-h-[32rem] flex-col divide-y divide-neutral-800 overflow-y-auto [scrollbar-width:thin]">
            {shown.map((pkg) => (
              <li key={pkg.guid} className="flex items-start gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{pkg.name}</span>
                    <span className="text-xs text-neutral-500">
                      {pkg.category} · {pkg.versions[0]?.version}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">{pkg.overview}</p>
                </div>
                {installed.has(pkg.name.toLowerCase()) ? (
                  <span className="text-xs text-neutral-500">installed</span>
                ) : (
                  <Button disabled={install.isPending || !pkg.versions[0]} onClick={() => install.mutate(pkg)}>
                    Install
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export function RepositoriesSection() {
  const repos = useRepositories()
  const save = useSaveRepositories()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const list = repos.data ?? []

  function add(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !url.trim()) return
    save.mutate([...list, { Name: name.trim(), Url: url.trim(), Enabled: true }], {
      onSuccess: () => {
        setName('')
        setUrl('')
      },
    })
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Repositories</SectionTitle>
      <p className="text-xs text-neutral-500">Where the catalog comes from. Only add repositories you trust: plugins run inside the server.</p>
      <ul className="flex flex-col gap-1.5">
        {list.map((repo, i) => (
          <li key={repo.Url} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-accent-500"
              aria-label={`${repo.Name} enabled`}
              checked={repo.Enabled}
              onChange={(e) => save.mutate(list.map((r, j) => (j === i ? { ...r, Enabled: e.target.checked } : r)))}
            />
            <span className="min-w-0 flex-1">
              {repo.Name}
              <span className="block truncate text-xs text-neutral-500">{repo.Url}</span>
            </span>
            <ConfirmButton question="Remove?" disabled={save.isPending} onConfirm={() => save.mutate(list.filter((_, j) => j !== i))}>
              Remove
            </ConfirmButton>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <TextField label="Name" className="w-36" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Manifest URL" className="min-w-56 flex-1" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/manifest.json" />
        <Button type="submit" disabled={save.isPending || !name.trim() || !url.trim()}>
          Add
        </Button>
      </form>
      {save.isError && <ErrorText>{errorMessage(save.error)}</ErrorText>}
    </section>
  )
}
