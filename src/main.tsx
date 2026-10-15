import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { shouldRetry } from '@/api/errors'
import { SessionProvider } from '@/api/SessionProvider'
import App from './App.tsx'
import './index.css'

// TanStack Query only listens to visibilitychange; also treat window focus as "focused",
// so switching between two side-by-side windows refetches stale data.
focusManager.setEventListener((setFocused) => {
  const onChange = () => setFocused(document.visibilityState === 'visible' && document.hasFocus())
  window.addEventListener('focus', onChange)
  window.addEventListener('blur', onChange)
  document.addEventListener('visibilitychange', onChange)
  return () => {
    window.removeEventListener('focus', onChange)
    window.removeEventListener('blur', onChange)
    document.removeEventListener('visibilitychange', onChange)
  }
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: shouldRetry } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
