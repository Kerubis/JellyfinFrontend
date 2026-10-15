import { Jellyfin, type Api } from '@jellyfin/sdk'
import axios from 'axios'
import { readString, writeString } from '@/lib/storage'

const DEVICE_ID_KEY = 'jff.deviceId'
const DEVICE_NAME_KEY = 'jff.deviceName'

function loadDeviceId(): string {
  const existing = readString(DEVICE_ID_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  writeString(DEVICE_ID_KEY, id)
  return id
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
