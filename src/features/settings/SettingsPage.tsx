import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { usePref, useRefreshPrefsOnMount, usePrefsSaveState } from '@/api/prefs-context'
import { useCurrentUser } from '@/api/queries/users'
import { appVersion } from '@/api/runtimeConfig'
import { hasLimits } from '@/domain/safety'
import { hasHardLimits } from '@/domain/users'
import { DashboardEditor } from '@/features/home/DashboardEditor'
import { DeviceNameSection, ServerSection } from './DeviceServerSection'
import { HiddenSection } from './HiddenSection'
import { LanguageSection } from './LanguageSection'
import { NavColorsSection } from './NavColorsSection'
import { PlaybackDeviceSection } from './PlaybackDeviceSection'
import { PrefsDiagnostics } from './PrefsDiagnostics'
import { DisplayPrefsSection, PlaybackPrefsSection, SubtitlePrefsSection } from './ProfilePrefsSection'
import { ProfilesSection } from './ProfilesSection'

type Tab = { id: string; label: string; content: () => ReactNode }

const TABS: Tab[] = [
  {
    id: 'playback',
    label: 'Playback',
    content: () => (
      <>
        <PlaybackPrefsSection />
        <PlaybackDeviceSection />
      </>
    ),
  },
  {
    id: 'languages',
    label: 'Subtitles & languages',
    content: () => (
      <>
        <SubtitlePrefsSection />
        <LanguageSection />
      </>
    ),
  },
  { id: 'home', label: 'Home', content: () => <DashboardEditor /> },
  {
    id: 'display',
    label: 'Display',
    content: () => (
      <>
        <DisplayPrefsSection />
        <NavColorsSection />
        <HiddenSection />
      </>
    ),
  },
  { id: 'profiles', label: 'Profiles', content: () => <ProfilesSection /> },
  {
    id: 'device',
    label: 'Device & server',
    content: () => (
      <>
        <DeviceNameSection />
        <ServerSection />
        {import.meta.env.DEV && <PrefsDiagnostics />}
      </>
    ),
  },
]

const SAVE_LABEL = { idle: 'All changes synced', saving: 'Saving…', error: 'Sync failed, retrying…' } as const

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  useRefreshPrefsOnMount()
  const safety = usePref('safety').value
  const me = useCurrentUser()
  const saveState = usePrefsSaveState()

  // Kid mode has no settings (soft limit; the admin edits them from their own profile).
  if (safety.kidMode) return <Navigate to="/" replace />

  // "Profiles" only when there is something to show: admins manage others, others see their restrictions.
  const showProfiles = !!me.data && (me.data.isAdmin || hasHardLimits(me.data.limits) || hasLimits(safety))
  const tabs = TABS.filter((t) => t.id !== 'profiles' || showProfiles)
  const active = tabs.find((t) => t.id === params.get('tab')) ?? tabs[0]

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">
          Settings <span className="ml-1 text-xs font-normal text-neutral-500">{appVersion}</span>
        </h1>
        <span className={`text-xs ${saveState === 'error' ? 'text-red-400' : 'text-neutral-500'}`}>{SAVE_LABEL[saveState]}</span>
      </div>

      <div role="tablist" aria-label="Settings" className="flex flex-wrap gap-1 border-b border-neutral-800">
        {tabs.map((tab) => {
          const selected = tab.id === active?.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setParams({ tab: tab.id }, { replace: true })}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                selected ? 'border-accent-500 text-white' : 'border-transparent text-neutral-400 hover:text-neutral-100'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="flex max-w-2xl flex-col gap-8">
        {active?.content()}
      </div>
    </div>
  )
}
