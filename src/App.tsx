import { Navigate, Route, Routes } from 'react-router'
import { PrefsProvider } from '@/api/PrefsProvider'
import { useSession } from '@/api/session-context'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProfileMenu } from '@/features/auth/ProfileMenu'
import { ServerSetup } from '@/features/auth/ServerSetup'
import { HomePage } from '@/features/home/HomePage'
import { LibraryNav } from '@/features/library/LibraryNav'
import { LibraryPage } from '@/features/library/LibraryPage'
import { MoviePage } from '@/features/movies/MoviePage'
import { PlayerOverlay } from '@/features/player/PlayerOverlay'
import { PlayerProvider } from '@/features/player/PlayerProvider'
import { SearchBox } from '@/features/search/SearchBox'
import { SearchPage } from '@/features/search/SearchPage'
import { EpisodeRedirect } from '@/features/series/EpisodePanel'
import { SeriesPage } from '@/features/series/SeriesPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export default function App() {
  const { server, account } = useSession()
  if (!server) return <ServerSetup />
  if (!account) return <LoginPage server={server} />

  return (
    <PrefsProvider key={account.userId} fallback={<p className="p-4 text-sm text-neutral-500">Loading profile…</p>}>
      <PlayerProvider>
        <Layout
          nav={<LibraryNav />}
          actions={
            <>
              <SearchBox />
              <ProfileMenu />
            </>
          }
        >
          <Routes>
            <Route index element={<HomePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="series/:seriesId" element={<SeriesPage />} />
            <Route path="series/:seriesId/episode/:episodeId" element={<SeriesPage />} />
            <Route path="episode/:episodeId" element={<EpisodeRedirect />} />
            <Route path="library/:libraryId" element={<LibraryPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="item/:itemId" element={<MoviePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        {/* Outside <Routes>, so navigation never interrupts playback. */}
        <PlayerOverlay />
      </PlayerProvider>
    </PrefsProvider>
  )
}
