#!/bin/sh
# Writes the runtime config read by the app (src/api/runtimeConfig.ts) from the container's environment.
set -eu

escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

target=/usr/share/nginx/html/config.js
printf 'window.__JFF_CONFIG__ = { serverUrl: "%s" };\n' "$(escape "${JELLYFIN_URL:-}")" > "$target"
echo "jff: config.js written (JELLYFIN_URL=${JELLYFIN_URL:-<empty>})"
