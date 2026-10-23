# Jellyfin Frontend: static build served by nginx. Published to ghcr.io/kerubis/jellyfinfrontend on version
# tags (see .github/workflows/docker.yml); Unraid template in unraid/.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VERSION=dev
ENV VITE_APP_VERSION=$VERSION
RUN npm run build

FROM nginx:1.27-alpine
LABEL org.opencontainers.image.source="https://github.com/Kerubis/JellyfinFrontend" \
      org.opencontainers.image.description="Dense, fast web client for Jellyfin" \
      org.opencontainers.image.licenses="GPL-3.0" \
      net.unraid.docker.icon="https://raw.githubusercontent.com/Kerubis/JellyfinFrontend/master/public/icon-256.png" \
      net.unraid.docker.webui="http://[IP]:[PORT:80]/"
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
# nginx's entrypoint runs /docker-entrypoint.d/*.sh before starting: writes config.js from JELLYFIN_URL.
COPY --chmod=755 docker/40-jff-config.sh /docker-entrypoint.d/40-jff-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
ENV JELLYFIN_URL=""
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
