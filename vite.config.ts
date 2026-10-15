import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev only: requests to /jellyfin/* are proxied to the real server to avoid CORS.
  // Set JELLYFIN_URL in .env.local (see .env.example).
  const target = env.JELLYFIN_URL

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: target
        ? {
            '/jellyfin': {
              target,
              changeOrigin: true,
              ws: true,
              rewrite: (path) => path.replace(/^\/jellyfin/, ''),
            },
          }
        : undefined,
    },
  }
})
