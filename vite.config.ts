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
    // JASSUB loads its worker, wasm and default font via new URL(..., import.meta.url);
    // pre-bundling would move the module and break those paths. Its CommonJS dependencies
    // still need pre-bundling (ESM conversion), otherwise `import x from 'throughput'` fails in dev.
    optimizeDeps: {
      exclude: ['jassub'],
      include: ['jassub > throughput', 'jassub > rvfc-polyfill'],
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        ...(target && {
          '/jellyfin': {
            target,
            changeOrigin: true,
            ws: true,
            rewrite: (path) => path.replace(/^\/jellyfin/, ''),
          },
        }),
        // AnimeSchedule.net sends no CORS headers; the browser's request (with the profile's token) is passed
        // through. The image does the same in nginx (docker/nginx.conf).
        '/animeschedule': {
          target: 'https://animeschedule.net',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/animeschedule/, '/api/v3'),
        },
      },
    },
  }
})
