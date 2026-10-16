import { Jellyfin, type Api } from '@jellyfin/sdk'
import axios from 'axios'
import { readString, writeString } from '@/lib/storage'

const DEVICE_ID_KEY = 'jff.deviceId'
const DEVICE_NAME_KEY = 'jff.deviceName'

function loadDeviceId(): string {
  const existing = readString(DEVICE_ID_KEY)
  if (existing) return existing
  const id = randomUuid()
  writeString(DEVICE_ID_KEY, id)
  return id
}

/**
 * Random UUID v4. `crypto.randomUUID` only exists in secure contexts (HTTPS, localhost), and the Docker image
 * is usually opened over plain HTTP on the LAN; `getRandomValues` works everywhere.
 */
function randomUuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40 // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80 // RFC 4122 variant
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function defaultDeviceName(): string {
  const ua = navigator.userAgent
  const browser = /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : 'Browser'
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS'
  return `${browser} on ${os}`
}

export function getDeviceName(): string {
  return readString(DEVICE_NAME_KEY) ?? defaultDeviceName()
}

/** Persistent per-device identity: Jellyfin (and Home Assistant) key sessions on it. */
export const jellyfin = new Jellyfin({
  clientInfo: { name: 'Jellyfin Frontend', version: '0.1.0' },
  deviceInfo: { id: loadDeviceId(), name: getDeviceName() },
})

export function setDeviceName(name: string): void {
  const trimmed = name.trim()
  writeString(DEVICE_NAME_KEY, trimmed || null)
  jellyfin.deviceInfo = { ...jellyfin.deviceInfo, name: trimmed || defaultDeviceName() }
  apiCache.clear()
}

// --- 401 handling ---------------------------------------------------------

type UnauthorizedListener = (accessToken: string) => void
const unauthorizedListeners = new Set<UnauthorizedListener>()

/** Called with the rejected token whenever an authenticated request returns 401. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

const http = axios.create()
http.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const header = String(error.config?.headers?.Authorization ?? '')
    const token = /Token="([^"]+)"/.exec(header)?.[1]
    if (token) unauthorizedListeners.forEach((listener) => listener(token))
  }
  return Promise.reject(error)
})

// --- Api instances --------------------------------------------------------

const apiCache = new Map<string, Api>()

/** Returns a (cached) SDK Api for a server URL, optionally authenticated. */
export function apiFor(serverUrl: string, accessToken?: string): Api {
  const key = `${serverUrl}\n${accessToken ?? ''}`
  let api = apiCache.get(key)
  if (!api) {
    api = jellyfin.createApi(serverUrl, accessToken, http)
    apiCache.set(key, api)
  }
  return api
}

/** In dev, the Vite proxy forwards /jellyfin/* to JELLYFIN_URL (see vite.config.ts). */
export const devProxyUrl = import.meta.env.DEV ? `${window.location.origin}/jellyfin` : null

/** Turns user input like "192.168.1.5:8096/" or "/jellyfin" into an absolute base URL. */
export function normalizeServerUrl(input: string): string {
  let url = input.trim()
  if (url.startsWith('/')) url = window.location.origin + url
  else if (!/^https?:\/\//i.test(url)) url = `http://${url}`
  return url.replace(/\/+$/, '').replace(/\/web$/i, '')
}

// --- Image URLs -----------------------------------------------------------

export function itemImageUrl(
  serverUrl: string,
  itemId: string,
  tag: string | null | undefined,
  options: { type?: 'Primary' | 'Thumb' | 'Backdrop'; maxWidth?: number } = {},
): string | undefined {
  if (!tag) return undefined
  const params = new URLSearchParams({ tag, quality: '90' })
  if (options.maxWidth) params.set('maxWidth', String(options.maxWidth))
  return `${serverUrl}/Items/${itemId}/Images/${options.type ?? 'Primary'}?${params}`
}

export function userImageUrl(serverUrl: string, userId: string, tag: string | null | undefined): string | undefined {
  if (!tag) return undefined
  return `${serverUrl}/Users/${userId}/Images/Primary?${new URLSearchParams({ tag, maxWidth: '96', quality: '90' })}`
}
