import type { ReactNode } from 'react'
import { Navigate, NavLink, useNavigate, useParams, useSearchParams } from 'react-router'
import { usePref, useRefreshPrefsOnMount, usePrefsSaveState } from '@/api/prefs-context'
import { useCurrentUser } from '@/api/queries/users'
import { appVersion } from '@/api/runtimeConfig'
import { hasLimits } from '@/domain/safety'
import { hasHardLimits } from '@/domain/users'
import { DashboardEditor } from '@/features/home/DashboardEditor'
import { AboutSection } from './AboutSection'
import { ActivityAndLogs } from './admin/ActivitySection'
import { RecentActivitySection, ServerAdminSection, SessionsSection, StorageSection } from './admin/OverviewSections'
import { TasksSection } from './admin/TasksSection'
import { UsersSection } from './admin/UsersSection'
import { BackupsSection } from './admin/BackupsSection'
import { ConfigForm } from './admin/ConfigForm'
import { BRANDING, GENERAL, LIBRARY_DISPLAY, METADATA_DEFAULTS, METADATA_SAVING, NETWORKING, NFO, RESUME, STREAMING, TRANSCODING, TRICKPLAY } from './admin/configSpecs'
import { ApiKeysSection, DevicesSection } from './admin/DevicesSection'
import { CatalogSection, InstalledPluginsSection, RepositoriesSection } from './admin/PluginsSection'
import { RestartNotice } from './admin/RestartNotice'
import { SeerrSection } from './admin/SeerrSection'
import { LibrariesSection } from './admin/LibrariesSection'
import { TwoColumns } from './admin/parts'
import { AvatarSection, PasswordSection, QuickConnectSection } from './AccountSections'
import { DeviceNameSection, ServerSection } from './DeviceServerSection'
import { HiddenSection } from './HiddenSection'
import { AnimeScheduleSection } from './IntegrationsSection'
import { LanguageSection } from './LanguageSection'
import { NavColorsSection } from './NavColorsSection'
import { PlaybackDeviceSection } from './PlaybackDeviceSection'
import { PrefsDiagnostics } from './PrefsDiagnostics'
import { DisplayPrefsSection, PlaybackPrefsSection, SubtitlePrefsSection } from './ProfilePrefsSection'
import { OwnLimitsSection } from './ProfilesSection'

type SettingsGroup = 'profile' | 'device' | 'admin'

type Page = {
  id: string
  label: string
  group: SettingsGroup
  content: () => ReactNode
  /** Dashboard-like pages use the full width (two columns); forms stay narrow for readability. */
  wide?: boolean
}

/** Sidebar groups, by whose setting it is (PLAN.md §3.8). Admin pages arrive with M15+. */
const GROUPS: { id: SettingsGroup; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'device', label: 'This device' },
  { id: 'admin', label: 'Administration' },
]

type Visibility = { isAdmin: boolean; hasLimits: boolean }

const PAGES: (Page & { visible?: (v: Visibility) => boolean })[] = [
  // Profile: synced with the Jellyfin user, the same on every device.
  {
    id: 'account',
    group: 'profile',
    label: 'Account',
    content: () => (
      <>
        <AvatarSection />
        <PasswordSection />
        <QuickConnectSection />
      </>
    ),
  },
  { id: 'playback', group: 'profile', label: 'Playback', content: () => <PlaybackPrefsSection /> },
  {
    id: 'languages',
    group: 'profile',
    label: 'Audio & subtitles',
    content: () => (
      <>
        <LanguageSection />
        <SubtitlePrefsSection />
      </>
    ),
  },
  { id: 'home', group: 'profile', label: 'Home', content: () => <DashboardEditor /> },
  {
    id: 'appearance',
    group: 'profile',
    label: 'Appearance',
    content: () => (
      <>
        <DisplayPrefsSection />
        <NavColorsSection />
      </>
    ),
  },
  {
    id: 'watching',
    group: 'profile',
    label: 'Currently Watching',
    content: () => (
      <HiddenSection />
    ),
  },
  { id: 'integrations', group: 'profile', label: 'Integrations', content: () => <AnimeScheduleSection /> },
  { id: 'limits', group: 'profile', label: 'Limits', content: () => <OwnLimitsSection />, visible: (v) => !v.isAdmin && v.hasLimits },
  // This device: stored in this browser only.
  {
    id: 'device',
    group: 'device',
    label: 'Device & server',
    content: () => (
      <>
        <DeviceNameSection />
        <ServerSection />
      </>
    ),
  },
  { id: 'quality', group: 'device', label: 'Playback quality', content: () => <PlaybackDeviceSection /> },
  {
    id: 'about',
    group: 'device',
    label: 'About',
    content: () => (
      <>
        <AboutSection />
        {import.meta.env.DEV && <PrefsDiagnostics />}
      </>
    ),
  },
  // Administration (PLAN.md M15–M17); the server refuses these calls for everyone else anyway.
  {
    id: 'server',
    group: 'admin',
    label: 'Overview',
    visible: (v) => v.isAdmin,
    wide: true,
    content: () => (
      <TwoColumns
        left={
          <>
            <ServerAdminSection />
            <SessionsSection />
            <StorageSection />
            <RecentActivitySection />
          </>
        }
        right={<TasksSection />}
      />
    ),
  },
  { id: 'users', group: 'admin', label: 'Users', content: () => <UsersSection />, visible: (v) => v.isAdmin },
  { id: 'libraries', group: 'admin', label: 'Libraries', content: () => <LibrariesSection />, visible: (v) => v.isAdmin, wide: true },
  {
    id: 'transcoding',
    group: 'admin',
    label: 'Playback & transcoding',
    visible: (v) => v.isAdmin,
    wide: true,
    content: () => (
      <TwoColumns
        left={<ConfigForm spec={TRANSCODING} />}
        right={
          <>
            <ConfigForm spec={RESUME} />
            <ConfigForm spec={STREAMING} />
            <ConfigForm spec={TRICKPLAY} />
          </>
        }
      />
    ),
  },
  {
    id: 'plugins',
    group: 'admin',
    label: 'Plugins',
    visible: (v) => v.isAdmin,
    wide: true,
    content: () => (
      <>
        <RestartNotice />
        <TwoColumns
          left={<InstalledPluginsSection />}
          right={
            <>
              <CatalogSection />
              <RepositoriesSection />
            </>
          }
        />
      </>
    ),
  },
  {
    id: 'devices',
    group: 'admin',
    label: 'Devices & API keys',
    visible: (v) => v.isAdmin,
    wide: true,
    content: () => <TwoColumns left={<DevicesSection />} right={<ApiKeysSection />} />,
  },
  { id: 'seerr', group: 'admin', label: 'Seerr', content: () => <SeerrSection />, visible: (v) => v.isAdmin },
  { id: 'backups', group: 'admin', label: 'Backups', content: () => <BackupsSection />, visible: (v) => v.isAdmin },
  { id: 'activity', group: 'admin', label: 'Activity & logs', content: () => <ActivityAndLogs />, visible: (v) => v.isAdmin, wide: true },
  {
    id: 'general',
    group: 'admin',
    label: 'General',
    visible: (v) => v.isAdmin,
    content: () => (
      <>
        <ConfigForm spec={GENERAL} />
        <ConfigForm spec={BRANDING} />
      </>
    ),
  },
  {
    id: 'networking',
    group: 'admin',
    label: 'Networking',
    visible: (v) => v.isAdmin,
    content: () => (
      <>
        <RestartNotice />
        <ConfigForm spec={NETWORKING} />
      </>
    ),
  },
  {
    id: 'library-defaults',
    group: 'admin',
    label: 'Library defaults',
    visible: (v) => v.isAdmin,
    content: () => (
      <>
        <ConfigForm spec={LIBRARY_DISPLAY} />
        <ConfigForm spec={METADATA_DEFAULTS} />
        <ConfigForm spec={METADATA_SAVING} />
        <ConfigForm spec={NFO} />
      </>
    ),
  },
]

/** Pages that were renamed or split (old links and ?tab= values). */
const ALIASES: Record<string, (v: Visibility) => string> = {
  display: () => 'appearance',
  profiles: (v) => (v.isAdmin ? 'users' : 'limits'),
  tasks: () => 'server',
  logs: () => 'activity',
}

const SAVE_LABEL = { idle: 'All changes synced', saving: 'Saving…', error: 'Sync failed, retrying…' } as const

export function SettingsPage() {
  const { page: pageId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  useRefreshPrefsOnMount()
  const safety = usePref('safety').value
  const me = useCurrentUser()
  const saveState = usePrefsSaveState()

  // Kid mode has no settings (soft limit; the admin edits them from their own profile).
  if (safety.kidMode) return <Navigate to="/" replace />

  const visibility: Visibility = {
    isAdmin: !!me.data?.isAdmin,
    hasLimits: !!me.data && (hasHardLimits(me.data.limits) || hasLimits(safety)),
  }
  const pages = PAGES.filter((p) => !p.visible || p.visible(visibility))
  const groups = GROUPS.map((g) => ({ ...g, pages: pages.filter((p) => p.group === g.id) })).filter((g) => g.pages.length > 0)

  // Old links (?tab=playback) and plain /settings land on a page URL.
  const resolve = (id: string | null | undefined) => (id && ALIASES[id] ? ALIASES[id](visibility) : id)
  if (!pageId) return <Navigate to={`/settings/${pages.find((p) => p.id === resolve(params.get('tab')))?.id ?? pages[0]?.id ?? ''}`} replace />
  const active = pages.find((p) => p.id === pageId)
  if (!active) {
    // Admin-only pages wait for the user to load instead of bouncing to the first page.
    if (me.isPending) return null
    const alias = resolve(pageId)
    return <Navigate to={alias && alias !== pageId ? `/settings/${alias}` : '/settings'} replace />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">
          Settings <span className="ml-1 text-xs font-normal text-neutral-500">{appVersion}</span>
        </h1>
        <span className={`text-xs ${saveState === 'error' ? 'text-red-400' : 'text-neutral-500'}`}>{SAVE_LABEL[saveState]}</span>
      </div>

      {/* Narrow screens: the menu becomes a dropdown. */}
      <select
        aria-label="Settings page"
        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm md:hidden"
        value={active.id}
        onChange={(e) => navigate(`/settings/${e.target.value}`)}
      >
        {groups.map((group) => (
          <optgroup key={group.id} label={group.label}>
            {group.pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="flex items-start gap-8">
        <nav aria-label="Settings" className="sticky top-16 hidden w-52 shrink-0 flex-col gap-6 md:flex">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-0.5">
              {/* Group heading in the logo's violet → blue, with a rule under it, so the groups stand apart. */}
              <h2 className="mb-1 border-b border-neutral-700 px-3 pb-1.5 text-xs font-bold tracking-wider uppercase">
                <span className="bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] bg-clip-text text-transparent">{group.label}</span>
              </h2>
              {group.pages.map((p) => (
                <NavLink key={p.id} to={`/settings/${p.id}`} className={MENU_ITEM}>
                  {p.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <section aria-label={active.label} className={`flex min-w-0 flex-1 flex-col gap-8 ${active.wide ? '' : 'max-w-2xl'}`}>
          {active.content()}
        </section>
      </div>
    </div>
  )
}

// Same states as the header links: active = background-glow blue, hover = light-blue inset ring.
const MENU_ITEM = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm ring-accent-400 ring-inset transition hover:ring-2 focus-visible:ring-2 focus-visible:outline-none ${
    isActive ? 'bg-[#00A4DC]/22 font-medium text-white' : 'text-neutral-400 hover:text-neutral-100'
  }`
