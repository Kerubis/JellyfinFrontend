import { Navigate, Route, Routes } from 'react-router'
import { PrefsProvider } from '@/api/PrefsProvider'
import { useServerUnreachable } from '@/api/queries/server'
import { useSession } from '@/api/session-context'
import { Layout } from '@/components/Layout'
import { LibraryScanButton } from '@/features/admin/LibraryScanButton'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProfileMenu } from '@/features/auth/ProfileMenu'
import { ServerSetup } from '@/features/auth/ServerSetup'
import { HomeRoute } from '@/features/home/HomeRoute'
import { LibraryNav } from '@/features/library/LibraryNav'
import { AutoSignOut } from '@/features/limits/AutoSignOut'
import { TimeLeftChip } from '@/features/limits/TimeLeftChip'
import { LibraryPage } from '@/features/library/LibraryPage'
import { MoviePage } from '@/features/movies/MoviePage'
import { PlayerOverlay } from '@/features/player/PlayerOverlay'
import { PlayerProvider } from '@/features/player/PlayerProvider'
import { SearchBox } from '@/features/search/SearchBox'
import { ScheduleLink } from '@/features/schedule/ScheduleLink'
import { SchedulePage } from '@/features/schedule/SchedulePage'
import { SearchPage } from '@/features/search/SearchPage'
import { EpisodeRedirect } from '@/features/series/EpisodePanel'
import { SeriesPage } from '@/features/series/SeriesPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export default function App() {
  const { server, account } = useSession()
  const unreachable = useServerUnreachable(server)
  if (!server) return <ServerSetup />
  // Saved server doesn't answer (new IP, stopped): back to setup with the old address, profiles are kept.
  if (unreachable) return <ServerSetup unreachable={server} />
  if (!account) return <LoginPage server={server} />

  return (
    <PrefsProvider key={account.userId} fallback={<p className="p-4 text-sm text-neutral-500">Loading profile…</p>}>
      <PlayerProvider>
        <Layout
          nav={<LibraryNav />}
          actions={
            <>
              <ScheduleLink />
              <SearchBox />
              <TimeLeftChip />
              <LibraryScanButton />
              <ProfileMenu />
            </>
          }
        >
          <Routes>
            <Route index element={<HomeRoute />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/:page" element={<SettingsPage />} />
            <Route path="series/:seriesId" element={<SeriesPage />} />
            <Route path="series/:seriesId/episode/:episodeId" element={<SeriesPage />} />
            <Route path="episode/:episodeId" element={<EpisodeRedirect />} />
            <Route path="library/:libraryId" element={<LibraryPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="item/:itemId" element={<MoviePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        {/* Outside <Routes>, so navigation never interrupts playback. */}
        <PlayerOverlay />
        <AutoSignOut />
      </PlayerProvider>
    </PrefsProvider>
  )
}
