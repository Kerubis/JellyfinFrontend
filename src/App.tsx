import { Navigate, Route, Routes } from 'react-router'
import { PrefsProvider } from '@/api/PrefsProvider'
import { useSession } from '@/api/session-context'
import { ComingSoon } from '@/components/ComingSoon'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProfileMenu } from '@/features/auth/ProfileMenu'
import { ServerSetup } from '@/features/auth/ServerSetup'
import { HomePage } from '@/features/home/HomePage'
import { PlayerOverlay } from '@/features/player/PlayerOverlay'
import { PlayerProvider } from '@/features/player/PlayerProvider'
import { SeriesPage } from '@/features/series/SeriesPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export default function App() {
  const { server, account } = useSession()
  if (!server) return <ServerSetup />
  if (!account) return <LoginPage server={server} />

  return (
    <PrefsProvider key={account.userId} fallback={<p className="p-4 text-sm text-neutral-500">Loading profile…</p>}>
      <PlayerProvider>
        <Layout actions={<ProfileMenu />}>
          <Routes>
            <Route index element={<HomePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="series/:seriesId" element={<SeriesPage />} />
            <Route path="item/:itemId" element={<ComingSoon title="Details" milestone="M12" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        {/* Outside <Routes>, so navigation never interrupts playback. */}
        <PlayerOverlay />
      </PlayerProvider>
    </PrefsProvider>
  )
}
