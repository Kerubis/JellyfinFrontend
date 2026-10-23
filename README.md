# JellyfinFrontend

A dense, fast web client for Jellyfin. Jellyfin stays your server (libraries, metadata, transcoding, users, watch
state); this only replaces the web interface.

> **Vibecoded.** This project is written almost entirely by an AI coding assistant (Claude Code), steered and
> tested by a human. It works well for its author, but expect rough edges, and use it at your own risk.

## Features

- **Dense layout**: small cards and tight grids, so you see many titles at once with little scrolling.
- **Home that tracks what you watch**: *Currently Watching* always has the shows you're in the middle of, sorted
  by what you watched last; new episodes of shows you set aside appear under *New Episodes*. Sections can be
  rearranged, renamed and hidden per device.
- **Playback that never throws you out**: the player shrinks to a mini player while you keep browsing.
- **Made for anime**: styled ASS/SSA subtitles with the file's own fonts, smart audio / subtitle language
  rules per library and per series, skip intro / outro, autoplay of the next episode.
- **Library browsing and search**: filters, sorting, an A–Z jump bar, movie detail pages.
- **Airing schedule**: the week's anime from AnimeSchedule.net, with shows in your library highlighted.
- **Requests with Seerr**: search any movie or show and request it, with the right server (e.g. a separate anime
  Sonarr) and HD or 4K.
- **Profiles and kids**: switch between Jellyfin users; kid mode, daily watch time and bedtime limits.
- **Server administration**: users, libraries, scheduled tasks, plugins, devices, backups and logs, all inside the
  app, with no need for the official web interface.

## Install on Unraid

You need a Jellyfin server (10.10 or newer) that your devices can reach.

1. **Add the template repository** (once): in Unraid, open **Docker → Add Container**, scroll down to
   **Template Repositories**, add this line and click **Save**:
   ```
   https://github.com/Kerubis/JellyfinFrontend
   ```
2. **Create the container**: still in **Add Container**, pick **JellyfinFrontend** from the **Template** list.
3. **Set it up**:
   - **Network Type**: `br0` (Custom), and give it a **Fixed IP address**, so it doesn't clash with ports already
     in use on your server.
   - **Jellyfin server URL**: the address your *browser* uses for Jellyfin, e.g. `http://192.168.1.10:8096`.
4. Click **Apply**, then open `http://<the container's IP>/` and sign in with your Jellyfin account.

If the template doesn't show up, you can also download it directly from the Unraid terminal and then pick it as in
step 2:

```sh
wget -O /boot/config/plugins/dockerMan/templates-user/my-JellyfinFrontend.xml \
  https://raw.githubusercontent.com/Kerubis/JellyfinFrontend/master/unraid/jellyfin-frontend.xml
```

**Updates**: Docker → **Check for Updates**, then apply. The installed version is shown next to the *Settings*
heading in the app.

### Optional: schedule and requests

- **Airing schedule**: create a free API application on
  [AnimeSchedule.net](https://animeschedule.net/users/settings/api) and enter its id and token in
  **Settings → Integrations**. Each profile uses its own token.
- **Seerr requests**: an admin enters the Seerr address and API key (Seerr → Settings → General) in
  **Settings → Administration → Seerr**, picks which profiles may request and where requests go. Users must be
  imported in Seerr.

## Credits

- Icons from [Material Symbols](https://fonts.google.com/icons) by Google, Apache License 2.0.
- Airing data from [AnimeSchedule.net](https://animeschedule.net), anime id mapping from
  [Fribb/anime-lists](https://github.com/Fribb/anime-lists).

## License

GPL-3.0, see [LICENSE](LICENSE).
