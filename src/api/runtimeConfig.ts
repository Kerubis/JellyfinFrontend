// Settings injected when the app is served, not at build time: the Docker image writes /config.js from its
// environment (docker/40-jff-config.sh), so one image works for any server.

type RuntimeConfig = {
  /** Jellyfin server the container was set up for; devices connect to it without the setup screen. */
  serverUrl?: string
}

declare global {
  interface Window {
    __JFF_CONFIG__?: RuntimeConfig
  }
}

export const runtimeConfig: RuntimeConfig = window.__JFF_CONFIG__ ?? {}

/** The preset server address, if the container has one. */
export const presetServerUrl = runtimeConfig.serverUrl?.trim() || null

/** App version from the release tag (Docker build arg), "dev" otherwise. */
export const appVersion: string = import.meta.env.VITE_APP_VERSION || 'dev'
