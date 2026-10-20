#!/bin/sh
# Writes the runtime config read by the app (src/api/runtimeConfig.ts) from the container's environment.
set -eu

escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

target=/usr/share/nginx/html/config.js
printf 'window.__JFF_CONFIG__ = { serverUrl: "%s" };\n' "$(escape "${JELLYFIN_URL:-}")" > "$target"
echo "jff: config.js written (JELLYFIN_URL=${JELLYFIN_URL:-<empty>})"

# nginx resolves the AnimeSchedule proxy target at request time and needs a DNS server for that (docker/nginx.conf).
ns=$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf 2>/dev/null || true)
case "$ns" in
  "") ns=1.1.1.1 ;;
  *:*) ns="[$ns]" ;;
esac
printf 'resolver %s valid=300s ipv6=off;\nresolver_timeout 5s;\n' "$ns" > /etc/nginx/jff-resolver.conf
echo "jff: resolver $ns"
