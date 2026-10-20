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

## Docker / Unraid

The image `ghcr.io/kerubis/jellyfinfrontend` is built by GitHub Actions ([docker.yml](.github/workflows/docker.yml)) **only for version tags**. `latest` always points to the newest release, so Unraid's "Check for updates" only shows actual releases.

### Release a new version

```sh
git tag v0.2.0
git push origin v0.2.0      # builds and pushes :0.2.0, :0.2 and :latest (~2-3 min, see the Actions tab)
```

Then in Unraid: Docker → Check for updates → apply update. The version is shown next to the "Settings" heading.

### First-time setup

1. Push the first tag (above). After the build, on GitHub go to your profile → Packages → `jellyfinfrontend` → Package settings → change visibility to **Public** (once; Unraid pulls without a login then).
2. On Unraid, save [unraid/jellyfin-frontend.xml](unraid/jellyfin-frontend.xml) as `/boot/config/plugins/dockerMan/templates-user/my-JellyfinFrontend.xml`, e.g.
   ```sh
   wget -O /boot/config/plugins/dockerMan/templates-user/my-JellyfinFrontend.xml \
     https://raw.githubusercontent.com/Kerubis/JellyfinFrontend/master/unraid/jellyfin-frontend.xml
   ```
3. Docker → Add Container → Template: `JellyfinFrontend`.
   - Network type `br0`, set a **fixed IP address**.
   - **Jellyfin server URL**: how the *browser* reaches Jellyfin, e.g. `http://172.16.100.12:8096`.
4. Open `http://<container IP>/`.

### How it works

- nginx serves the static build; unknown paths fall back to `index.html` (client-side routes).
- At container start, [docker/40-jff-config.sh](docker/40-jff-config.sh) writes `JELLYFIN_URL` into `/config.js`; the app connects to it without the server setup screen (the form still appears if the server can't be reached).
- The browser talks to Jellyfin directly (Jellyfin allows cross-origin requests by default). If the frontend is ever served over HTTPS, Jellyfin must be reachable over HTTPS too, or the browser blocks the requests (mixed content).
- `/animeschedule/*` passes GET requests through to the AnimeSchedule.net API (it sends no CORS headers) for the Schedule page. Each profile enters its own app token in Settings → Integrations; nginx only forwards it.
- Health check: `GET /health`.

## Credits

Icons from [Material Symbols](https://fonts.google.com/icons) by Google, Apache License 2.0 (paths copied into the components, no package).
