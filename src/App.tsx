import { Route, Routes } from 'react-router'

function Home() {
  return <h1 className="p-4 text-lg font-semibold">Currently Watching</h1>
}

export default function App() {
  return (
    <>
      <Routes>
        <Route index element={<Home />} />
      </Routes>
      {/* Persistent player overlay mounts here, outside <Routes>, so navigation never interrupts playback. */}
    </>
  )
}
