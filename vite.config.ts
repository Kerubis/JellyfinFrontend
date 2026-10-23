import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Seerr pass-through (dev): the target is the profile's Seerr server from the X-Seerr-Url header, so a fixed proxy
// target doesn't work. Same rules as docker/nginx.conf: http(s)://host[:port] only, GET/POST, the endpoints the app uses.
const SEERR_TARGET = /^https?:\/\/[A-Za-z0-9.:[\]-]+$/
const SEERR_PATH = /^\/(auth\/me|search|request|movie\/\d+|tv\/\d+|user\/jellyfin\/[0-9a-fA-F-]+|service\/(sonarr|radarr)(\/\d+)?)(\?.*)?$/

async function forwardToSeerr(req: IncomingMessage, res: ServerResponse) {
  const target = req.headers['x-seerr-url']
  const path = req.url ?? ''
  if (typeof target !== 'string' || !SEERR_TARGET.test(target) || !SEERR_PATH.test(path) || (req.method !== 'GET' && req.method !== 'POST')) {
    res.statusCode = 400
    res.end()
    return
  }
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  try {
    const upstream = await fetch(`${target}/api/v1${path}`, {
      method: req.method,
      headers: {
        Accept: 'application/json',
        'X-Api-Key': String(req.headers['x-api-key'] ?? ''),
        ...(req.method === 'POST' && { 'Content-Type': 'application/json' }),
      },
      body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
    })
    res.statusCode = upstream.status
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
    res.end(Buffer.from(await upstream.arrayBuffer()))
  } catch {
    res.statusCode = 502
    res.end()
  }
}

const seerrProxy = (): Plugin => ({
  name: 'seerr-proxy',
  configureServer(server) {
    server.middlewares.use('/seerr', (req, res) => void forwardToSeerr(req, res))
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev only: requests to /jellyfin/* are proxied to the real server to avoid CORS.
  // Set JELLYFIN_URL in .env.local (see .env.example).
  const target = env.JELLYFIN_URL

  return {
    plugins: [react(), tailwindcss(), seerrProxy()],
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
