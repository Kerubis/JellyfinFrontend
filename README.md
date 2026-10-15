# JellyfinFrontend

A dense, fast, personal web client for Jellyfin. Jellyfin stays the backend; this replaces only the UI.

- Project goals and rules: [CLAUDE.md](CLAUDE.md)
- Plan and task tracker: [PLAN.md](PLAN.md)

## Development

```sh
cp .env.example .env.local   # set JELLYFIN_URL to your server
npm install
npm run dev                  # API is proxied via /jellyfin → JELLYFIN_URL
npm run build
npm run lint
```
