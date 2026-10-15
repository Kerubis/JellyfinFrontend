import { Navigate, Route, Routes } from 'react-router'
import { useSession } from '@/api/session-context'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProfileMenu } from '@/features/auth/ProfileMenu'
import { ServerSetup } from '@/features/auth/ServerSetup'
import { HomePage } from '@/features/home/HomePage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export default function App() {
  const { server, account } = useSession()
  if (!server) return <ServerSetup />
  if (!account) return <LoginPage server={server} />

  return (
    <>
      <Layout actions={<ProfileMenu />}>
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      {/* Persistent player overlay mounts here, outside <Routes>, so navigation never interrupts playback. */}
    </>
  )
}
