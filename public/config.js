// Runtime config. In the Docker image this file is rewritten at container start from JELLYFIN_URL
// (docker/40-jff-config.sh); in dev it stays empty and the Vite proxy is used.
window.__JFF_CONFIG__ = {}
