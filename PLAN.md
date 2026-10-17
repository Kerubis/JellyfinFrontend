# Jellyfin Frontend: Plan & Tracker

Living document. Tick boxes as work lands, add decisions to the log, and move open questions out once they're answered.
Background and core rules are in [CLAUDE.md](CLAUDE.md); this file covers **what** to build, in **which order**, and **how** the larger features fit together.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `(later)` designed now, built later

---

## 1. Decisions log

| # | Decision | Why |
|---|----------|-----|
| D1 | Vite + React 19 + TS (strict, `noUncheckedIndexedAccess`) | Stack from CLAUDE.md |
| D2 | **Tailwind CSS v4** (via `@tailwindcss/vite`), no CSS modules | Dense layouts are mostly utility classes; one styling approach for the whole project |
| D3 | React Router (declarative `<Routes>`), TanStack Query | Stack from CLAUDE.md |
| D4 | Lint with **oxlint** (Vite template default) | Fast, no ESLint config overhead |
| D5 | Dev proxy: `/jellyfin/*` → `JELLYFIN_URL` from `.env.local` (HTTP + WebSocket) | No CORS problems in dev; prod uses the configured server URL directly |
| D6 | **A profile is a Jellyfin user.** Synced profile data lives in Jellyfin **DisplayPreferences `CustomPrefs`**, not in our own backend | Cross-device sync without running extra infrastructure. Verified: SDK `DisplayPreferenceApi`, `CustomPrefs: Record<string, string>` |
| D7 | **Home Assistant control = act as a normal controllable Jellyfin session** (WebSocket + `Sessions/Capabilities`) | HA's official Jellyfin integration already drives sessions through the server, so we don't need a custom API. Verified: SDK `SessionApi`, `PlaystateCommand`, `GeneralCommandType` |
| D8 | All player actions go through **one command dispatcher** (UI, keyboard, remote/HA all call it) | Lets us add HA control later without touching the player again |
| D9 | Intro/outro skipping uses the **MediaSegments API** | Server-native since 10.10. Verified: SDK `MediaSegmentApi` |
| D10 | License: GPL-3.0 (from the repo's initial commit) | Already chosen |
| D11 | Session state (server, remembered profiles with tokens, active profile) in a `SessionProvider` under `src/api/`; the app shows server setup → login → app based on it, no login route | 401 handling and profile switching are just state changes; a profile whose token is rejected stays listed as "signed out" |
| D13 | Prefs writes are **read-modify-write** of the whole `CustomPrefs` map, sending only changed keys' new values | Works whether the server merges or replaces `CustomPrefs`; keys changed on another device survive. Last write wins per key |
| D14 | Device overrides are **per device, not per profile** (`jff.deviceOverrides`), field-level on top of the synced value | They describe the screen (TV vs PC), not the person |
| D15 | **Watch state comes from two server-filtered episode lists** (`IsPlayed=true` / `IsPlayed=false`, virtual episodes excluded), not from series `UnplayedItemCount`/`PlayedPercentage` or list `UserData` | Verified on 12.2.0: series counts and the `UserData` embedded in list responses are wrong for some items (e.g. a series reporting 5 unplayed when all are played), while the `IsPlayed` filter matches the item's real state. Next episode = first unwatched regular episode after the furthest watched one (specials last); Next Up isn't used because its date cutoff drops older shows |
| D16 | Following = own list in prefs, not Jellyfin favorites | Keeps favorites free for other use |
| D17 | **Continue Watching is part of Currently Watching**: a started episode counts as "watched one", the card shows the next episode's progress (play = resume), started movies are mixed in sorted by last played | One place for "what do I watch now". Only the next episode's position is used, so old abandoned partials don't surface |
| D18 | `following.hidden` only applies to **Currently Watching**; New Episodes still lists hidden shows. Entries are `{ id, at }` (prefs v2); they're removed only by Unhide or by playing the item after `at` | Lets you clear Currently Watching without losing track of new episodes; a new episode alone doesn't bring a show back. `minDateLastSavedForUser` is ignored by the server (12.2.0), so recent plays come from `SortBy=DatePlayed` |
| D19 | Series page watched state also comes from the played/unplayed lists (D15), not from `Shows/{id}/Episodes` UserData (verified wrong for e.g. Spider S1E8). Marking watched updates those cached lists optimistically instead of refetching them | Home and series page always agree; no 700 KB refetch per click |
| D20 | Accent color = **Jellyfin blue `#00a4dc`**, defined once as `accent-*` in `@theme` (`src/index.css`); components use `accent-*`, never a raw palette color | Recolouring the app is a one-place change |
| D21 | **Fixed image corner slots** everywhere (home cards, season posters, episode stills): top-left = unwatched count (`CountLabel`), bottom-left = NEW/NEXT (`MarkerLabel`), top-right = watched toggle, bottom-right = ⋯ action menu (`CardMenu`, e.g. Open series / Remove from Currently Watching). Positions live in `components/corners.ts` | Same information is always in the same place |
| D22 | **Start position is applied client-side** (`hls.js` `startPosition` / `currentTime` after metadata), `PlaybackInfo` is requested without `StartTimeTicks` | The HLS playlist always covers the whole file, so seeking and resume work the same for direct play and HLS |
| D23 | Subtitles in M5: text tracks fetched as WebVTT (`Stream.vtt`) and rendered natively; ASS loses styling until JASSUB (M7) | Usable anime playback now without burning subs in on the server |
| D24 | Text subtitles are drawn by our own overlay (`SubtitleOverlay`), not by the browser's `::cue` rendering | `::cue` can't be positioned (e.g. above the controls) and its line boxes leave gaps; the browser still does parsing and timing |
| D25 | `PlaybackInfo` track choices always carry `MediaSourceId` (query + body) | Verified on 12.2: without it the server silently ignores `AudioStreamIndex` / `SubtitleStreamIndex`, including "off" (-1) |
| D26 | Direct play only when the chosen audio is the file's default track; otherwise the server remuxes with the chosen track | Browsers can't switch audio tracks inside a file (`audioTracks` is not generally available) |
| D27 | **One tile component + one action hook**: `MediaTile` renders every image with all overlays (play, count, NEW/NEXT, progress, ✓, ⋯, ring, spoiler blur); `useMediaActions(item)` defines what they do per item kind (series: next episode / whole series / series menu; season; episode; movie). Sections only override where the meaning differs (Currently Watching and New Episodes: ✓ = next / new episodes) | Overlay design and behaviour change in one place; library, search and every home row behave the same. No confirmation when marking a whole series/season (decided: ✓ again undoes it) |
| D28 | "Recently Added" always queries `/Items/Latest` **per video library** and merges by the newer of `DateCreated` / `DateLastMediaAdded` | Verified on 12.2: without `parentId` the endpoint leaves out whole libraries (no movies even with limit 200). Episodes / seasons of the same show are then grouped into one series card (`groupBySeries`), fetching 2× the limit to make up for it |
| D29 | **One caption component** (`MediaCaption`) for the two lines under every tile: title, then movie: year · series: years · N seasons · season: Season N · N episodes · episode: S01 E05 (Currently Watching: the next episode). Year links to the item's library filtered by year (library resolved via ancestors on click, cached); season → series page with that season; episode → episode view in its series page | Same text and links everywhere; New Episodes no longer shows the episode range |
| D30 | Soft limits live in the **kid's own synced prefs** (`safety`, written by an admin; `safetyUsage`, written by the kid's player). Kid-mode sign-out locks the profile picker instead of a PIN | Verified that admins can write other users' prefs; works across devices without our own backend. Soft by design (a kid using the API could change them) |
| D31 | **Deployment: own Docker image on GHCR, built by GitHub Actions on `v*` tags; Unraid tracks `:latest`** (br0, own IP). Server URL is a runtime env var (`JELLYFIN_URL` → `/config.js`), not baked into the build. Browser talks to Jellyfin directly (CORS `*` on the server, checked 2026-10-16) | Unraid's update check compares the registry digest of the tag, so releases (not every push) show as updates. One image works for any server |
| D32 | Settings live in one place (`/settings/:page`, left menu grouped Profile / This device / Administration). **Admin dashboard fully native**, no links into the official web client; plugin settings via a form generated from their JSON configuration. Overlapping profile settings are **written through** to Jellyfin's user configuration | The official frontend shouldn't be needed for anything. Write-through keeps other Jellyfin apps consistent |
| D33 | **Currently Watching sorts by last watched** (2026-10-17), replacing the newest-episode rule: a series by its most recently played episode, movies by their own last play, followed-but-unwatched series last (newest episode first). Last-played times come from the 300 most recent plays (`useRecentlyPlayed`), not from the full played list | User preference. Series-level `LastPlayedDate` is always empty on 12.2; per-episode UserData on the full played list would cost +23 % payload and ~5× server time |
| D34 | **Home sections partition everything unwatched** (§3.9, M18): Currently Watching (play position or started & unfinished, removable), New Episodes (removed started shows), Not watched per library. Follow, Continue Watching and Unwatched Movies removed; specials count | User decision 2026-10-17. Only the removed entries are stored (one source of truth: Jellyfin's watch state) |
| D12 | One `deviceId` per browser, shared by all profiles on it | Stable identity for the Jellyfin dashboard / HA. To verify: switching profiles on one device doesn't revoke the other profile's token |

---

## 2. Architecture overview

```
┌─────────────────────────── App root ────────────────────────────┐
│  Providers: QueryClient · Session(auth) · Prefs · PlayerEngine  │
│                                                                 │
│  ┌──────── Router outlet ────────┐   ┌──── Player overlay ────┐ │
│  │ home / series / library / ... │   │ full ⇄ mini, persists  │ │
│  └───────────────────────────────┘   └───────────▲────────────┘ │
│                                                   │ commands     │
│        UI buttons ── keyboard ── RemoteSession(WS) ┘             │
└─────────────────────────────────────────────────────────────────┘
          │ domain types only
┌─────────▼──────── src/api (data layer) ─────────────────────────┐
│ client.ts (SDK instance) · auth · queries/* · prefs · playback  │
│ mappers: Jellyfin DTO → src/domain types                        │
└─────────────────────────────────────────────────────────────────┘
```

### Folder layout (created)

```
src/
  api/            # SDK wrapper, auth, query hooks, mappers, prefs persistence, socket
  domain/         # Series, Episode, PlaybackSource, Prefs, DashboardSection, ... (no SDK imports)
  features/
    home/         # dashboard + sections (Currently Watching etc.)
    auth/         # server setup, login, Quick Connect, profile picker/menu
    library/      # browse, filter, search
    series/       # series / season / episode views
    player/       # engine, overlay UI, subtitles, track selection, autoplay
    settings/     # profile settings, dashboard editor, library language defaults
    remote/       # Jellyfin session socket → player command bridge (HA control)
  components/     # shared UI (Card, Grid, Layout, Button, ...)
  hooks/          # generic hooks
  lib/            # framework-free helpers (debounce, storage, language codes, ...)
```

Rule: `features/*` and `components/*` never import `@jellyfin/sdk`. Only `src/api/` does.

---

## 3. Feature concepts

### 3.1 Profile-based data, synced across devices (PC ⇄ Arch HTPC/TV)

**Profiles.** Each profile is a Jellyfin user. On a shared device like the TV, show a **profile picker**: public users come from `GET /Users/Public`, sign-in uses password or Quick Connect, and the token is stored per user so switching is instant.

**Storage layers** (resolved in this order, later layers win):

1. **Built-in defaults** (code)
2. **Profile prefs (synced)**: `DisplayPreferences` with id `jff-profile`, client `jellyfin-frontend`. Values go into `CustomPrefs` as JSON strings, one key per section (`dashboard`, `playback`, `languages`, `safety`, `seriesOverrides`, ...), so a write only touches the part that changed.
3. **Device overrides (local)**: in `localStorage`. Things that legitimately differ per screen: UI scale / card size (TV vs PC), 10-foot mode, volume, device name.

Device-local only (never synced): server URL, access tokens, `deviceId`, device name.

**Sync mechanics**
- Load prefs right after login, before the first render of the dashboard (suspense/loading state).
- Writes: optimistic local update, then a debounced (~1 s) PUT of the changed key(s).
- Every value carries `{ v: schemaVersion, updatedAt, data }`; a `migrate()` per key keeps old values working.
- Conflicts: last write wins per key (fine for one person on two screens). Refetch on window focus / visibility change, so the TV picks up changes made on the PC.
- `CustomPrefs` is a string→string map, so one JSON blob per key. Check the server's size limits early and fall back to splitting keys if needed.

**What's in a profile** (requested + recommended)

| Group | Settings |
|-------|----------|
| Playback | autoplay next on/off · **countdown seconds between episodes** · "Still watching?" after N episodes or X minutes without input · skip intro / outro: `auto` \| `button` \| `off` · default playback speed · resume behaviour (always resume / ask / start over) |
| Languages | global audio/subtitle prefs · **per-library defaults** (§3.4) · per-series remembered choice |
| Subtitles | style for text subs (size, background, bottom offset) · subtitle delay memory per series (optional) |
| Dashboard | section order, visibility, per-section options (§3.6) |
| Following | explicit "following" list (or Jellyfin favorites, see open questions) · **hidden / dropped series** removed from Currently Watching |
| Child safety | see below |
| UI | card density, show spoilers (episode thumbnails/descriptions of unwatched episodes on/off), theme |

**Child safety (two layers)**
- **Hard limits are enforced by Jellyfin** (the only thing a kid can't get around): per user `MaxParentalRating`, `BlockedTags`, `EnabledFolders` (library access), and **`AccessSchedules`** (allowed days/hours). The frontend only *shows* these in the settings UI and respects them (hide restricted UI and show a clear "not allowed now" screen when the server rejects a request).
- **Soft limits are enforced by the frontend**, stored in the kid profile's `safety` prefs: daily watch-time budget, max episodes per session, bedtime warning, autoplay forced off or limited, "kid mode" UI (only the dashboard plus allowed libraries, no settings). A determined user can get around these through the API. That's acceptable for its purpose, and the UI says so.
- Only an admin profile can edit safety settings. To check: whether an admin can write another user's `DisplayPreferences` (`userId` param); if not, store safety rules in the admin's prefs, keyed by kid user id.
- Settings/profile switching can be PIN-protected (a frontend PIN in the admin's prefs).

### 3.2 Home Assistant control (concept now, implemented later)

**Approach: be a proper Jellyfin remote-controllable client.** HA's built-in Jellyfin integration creates a `media_player` per active session and sends commands through the server. If our client registers correctly, HA can play/pause/seek/skip it with no custom API.

What the client must do (`features/remote/`, `src/api/socket.ts`):
1. `POST /Sessions/Capabilities/Full` after login: `PlayableMediaTypes: [Video, Audio]`, `SupportsMediaControl: true`, `SupportedCommands: [...]` (SetVolume, Mute, Unmute, ToggleMute, SetAudioStreamIndex, SetSubtitleStreamIndex, DisplayMessage, ToggleFullscreen, PlayNext, PlayState, ...).
2. Open the Jellyfin WebSocket (`/socket?api_key=…&deviceId=…`), answer `ForceKeepAlive`/`KeepAlive`, and reconnect with backoff.
3. Map incoming messages to the player command dispatcher (D8):
   - `Playstate` → `PlayPause | Pause | Unpause | Stop | NextTrack | PreviousTrack | Seek | Rewind | FastForward`
   - `GeneralCommand` → volume, mute, track switching, fullscreen, display message
   - `Play` → `PlayNow / PlayNext / PlayLast` with item ids (HA "play media")
4. Keep reporting progress (`Sessions/Playing`, `/Progress`, `/Stopped`) with accurate `IsPaused`, `PositionTicks`, `VolumeLevel`, and track indices, so HA shows correct state.
5. Stable identity: persistent `deviceId` + user-editable **device name** (e.g. "Living Room HTPC"), so the HA entity doesn't change between sessions.

What has to be in place before then: the command dispatcher (D8), an observable player state store, and a stable deviceId/device name. These are part of the player milestone, so the HA milestone only adds the socket bridge.

Possible later extras: HA dashboard card via HA's own media_player card; TV power/CEC and lights stay HA's job (automations on `media_player` state).

### 3.3 Subtitles

| Format | Strategy |
|--------|----------|
| SRT / VTT (text) | Fetch as VTT from `/Videos/{id}/{mediaSourceId}/Subtitles/{index}/Stream.vtt` and render with our own overlay (styleable, works with HLS too); native `<track>` as fallback |
| **ASS / SSA** (anime) | **JASSUB** (maintained libass-WASM successor of SubtitlesOctopus, needs approval as a new dependency): fetch `Stream.ass` and fonts from MKV attachments (`/Videos/{id}/{mediaSourceId}/Attachments/{index}`), with a fallback font bundled |
| PGS / VobSub (image) | Phase 1: let the server burn them in (transcode). Later: client-side PGS renderer if needed |

- **Device profile** sent with `PlaybackInfo` declares `SubtitleProfiles` (`ass`, `ssa`, `srt`, `vtt` → `External`), so the server doesn't burn in text subs and direct play stays possible.
- Timing offset when playback is an HLS transcode that started mid-file (check `TranscodingUrl` start offset and keep subs in sync).
- In-player: subtitle delay ± adjustment, track switch without restarting playback where possible.

### 3.4 Default audio & subtitle language per library

Track resolution when an episode starts (first match wins):

1. **Per-series override**: whatever was chosen manually last time for this series (remembered automatically)
2. **Per-library default**: e.g. *Anime*: audio `jpn`, subs `eng` mode `always`; *Series*: audio `eng`/`deu`, subs `smart`
3. Profile global default
4. Jellyfin user config (`AudioLanguagePreference`, `SubtitleLanguagePreference`)
5. File's default flags

Subtitle **modes**: `off` · `forced only` · `always` · `smart` (on only when the audio language isn't the preferred language).
**Anime-specific**: when several subtitle tracks match the language, prefer "Full"/"Dialogue" over "Signs & Songs" using a track-title heuristic, unless the mode is `forced only`, where Signs & Songs is the right pick.
Resolved indices are passed to `PlaybackInfo` (`AudioStreamIndex`, `SubtitleStreamIndex`) and carried over to autoplayed episodes.

### 3.5 Autoplay next episode

- **Next item**: the next episode in series order (season/episode index, specials handled), queried from the series' episode list, **not** the NextUp endpoint.
- **When**: at the start of the **Outro** media segment if one exists, otherwise X seconds before the end (configurable). Show an "Up next" card with a **countdown** (profile setting), plus *Play now* and *Cancel*.
- **"Still watching?"** after N consecutive autoplays without user input (profile setting); child-safety limits plug in at the same spot.
- **Skip Intro / Recap / Outro** via `MediaSegmentApi`. Needs segment data on the server (10.10+ with a segment provider plugin such as Intro Skipper). Behaviour per profile: auto / button / off.
- Track choices, volume, and fullscreen state carry over to the next episode.
- Preload the next episode's `PlaybackInfo` during the countdown so the switch is instant.

### 3.6 Customizable dashboard

The dashboard is an ordered list of **sections**, stored in profile prefs:

```ts
type DashboardSection = {
  id: string
  type: 'currentlyWatching' | 'newEpisodes' | 'continueWatching' | 'recentlyAdded'
      | 'following' | 'favorites' | 'unwatchedMovies'
  title?: string            // custom label
  visible: boolean
  options: {
    libraryIds?: string[]   // limit to libraries
    limit?: number
    rows?: number           // max rows before "show more"
    cardSize?: 'xs' | 'sm' | 'md'
    collapsed?: boolean
  }
}
```

Section types:
- **Currently Watching** (core rule from CLAUDE.md: ≥1 watched and ≥1 unwatched episode, sorted by newest episode `DateCreated` desc, plus "Following" shows)
- **New episodes**: episodes added in the last N days for followed or in-progress series
- **Continue watching**: partially watched items (resume position > 0). Off by default since D17 merged it into Currently Watching
- **Recently added** (optionally limited to libraries), **Following**, **Favorites**, **unwatched movies**

Editor: an "Edit dashboard" mode with move up/down, show/hide, options per section, add/remove section, reset to default. Up/down buttons rather than drag-and-drop at first, because they work with keyboard and TV remote and need no new dependency. The device-local layer can hide sections per device (e.g. the TV shows fewer).

### 3.7 Recommended extras (not requested, cheap now / painful later)

- **10-foot / TV mode**: spatial (arrow-key) navigation with visible focus, bigger cards. The HTPC is probably driven by keyboard/remote/gamepad, so build focus handling into shared components from day one.
- **Hide / drop series** from Currently Watching (stored in prefs).
- **Mark watched / unwatched** on cards and episodes.
- **Spoiler protection**: blur thumbnails/descriptions of unwatched episodes.
- **Trickplay thumbnails** on the seek bar (server-generated since 10.9).
- **Codec awareness for the HTPC**: the device profile should reflect what Chromium on Arch can really decode (HEVC/AV1 via VAAPI), to avoid unnecessary transcodes. Make it configurable per device.

### 3.8 Settings & administration (proposal, 2026-10-17)

**Goal:** one place for everything. The stock client splits it into "user preferences" (`#/mypreferencesmenu`) and a separate "dashboard" (`#/dashboard/…`); we put both into `/settings`, grouped by *whose* setting it is.

**Layout:** `/settings/:page`. Left menu with three groups (sticky); on narrow screens it becomes a dropdown at the top. Each page is a column of sections. Admin pages are ordinary menu entries in the "Administration" group, only for admins (the server enforces it anyway); many small pages rather than few big ones, so things are easy to find. Profile menu: "Settings" plus "Administration" (admins) jumping to the first admin page.

| Group | Page | Contents (today's section → new place; **new** = not built yet) |
|---|---|---|
| **Profile** (synced with the Jellyfin user) | Account | **new**: avatar, password, **Quick Connect "authorize a code"** (sign in the TV from the phone), sign out of all devices |
| | Playback | autoplay / still watching / resume / speed / skip times (+ per library) / intro-outro skip (PlaybackPrefsSection) |
| | Audio & subtitles | language rules global + per library (LanguageSection), subtitle look (SubtitlePrefsSection) |
| | Home | dashboard editor (DashboardEditor) |
| | Appearance | card size, spoilers, header link colours |
| | Currently Watching | **followed shows list** (new) + hidden list (HiddenSection) |
| | Limits | own restrictions / kid mode view (today in "Profiles" for non-admins) |
| **This device** (localStorage) | Device | device name, server address / forget server, card-size override, sections hidden on this device, TV mode later |
| | Playback quality | codecs / bitrate / direct play (PlaybackDeviceSection) |
| | About | app version, server name + version, diagnostics (dev) |
| **Administration** (admins) | Overview | **new**: server info + storage, active sessions (what plays, direct/transcode + reason, stop / message), running tasks with progress, recent activity; actions: scan all libraries, restart, shutdown |
| | Users | list / add / delete; per user: profile, library access, Jellyfin limits (LimitsEditor), app limits (SafetyEditor), password reset, admin flag |
| | Libraries | list, scan, add / remove folders (directory browser via `/Environment/*`), key options (real-time monitoring, trickplay, chapter images, metadata language) |
| | Playback & transcoding | hardware acceleration + enabled codecs, tone mapping, throttling, resume thresholds, streaming bitrate limit, trickplay options |
| | Tasks | scheduled tasks: run / stop, progress, last result, triggers |
| | Activity & logs | activity log, server log files viewer |
| | Plugins | installed (enable / disable / uninstall / update), catalog, repositories |
| | Devices & API keys | devices (rename / delete), API keys (create / revoke) |
| | Backups | list, create, restore (confirm twice) |
| | General & branding | server name, metadata language / country, Quick Connect on/off, login disclaimer, custom CSS |
| | Networking | ports, LAN networks, known proxies, HTTPS (read carefully: wrong values lock you out) |
| | Library defaults | library display, metadata savers / NFO options |

**Admin dashboard approach: fully native, no links into the official web client** (decided 2026-10-17). Plugin configuration: plugins ship their settings pages as HTML for the stock client, so instead we render a generated form from `GET /Plugins/{id}/Configuration` (strings, numbers, booleans, lists) and save it back with `POST`. Live TV is left out (not used on this server).

**Rules for admin pages:** server config is read fresh, patched and written back whole (as with user policies); admin forms save with an explicit **Save** button (profile prefs keep auto-saving); destructive actions (delete user / library, restore backup, restart, shutdown) need a confirmation. Data layer in `src/api/admin/`, types in `src/domain/admin/`, pages in `src/features/settings/{profile,device,admin}/`.

**Decided (D32):** overlapping profile settings are **written through** to Jellyfin's own user configuration (`POST /Users/Configuration`: audio / subtitle language, subtitle mode, autoplay next, remember tracks), so other Jellyfin apps follow them too. Today we only read those as a fallback.

### 3.9 Home sections: one place for everything unwatched (implemented, M18)

**Goal:** every show or movie with anything unwatched appears in exactly one home section; fully watched ones in none. Decided by the user; replaces the "Currently Watching" rule with follow (D33 sort order stays).

| Section | Contains | Sort |
|---|---|---|
| **Currently Watching** | anything with a play position (episodes → their show, movies) **+** shows with ≥ 1 watched and ≥ 1 unwatched episode; every entry removable | last watched (D33) |
| **New Episodes** | shows with ≥ 1 watched and ≥ 1 unwatched episode that are **not** in Currently Watching, i.e. the ones removed from it | newest added episode first (a new weekly episode surfaces) |
| **Not watched** (one section per library) | shows with no watched episode and no play position; movies not watched (incl. a started movie removed from Currently Watching) | newest added first |

Checked against admin's data (152 shows): 16 started & unfinished, 71 never watched with unwatched episodes, 65 finished: each show in exactly one bucket.

**Precedence:** Currently Watching → (removed) → New Episodes / Not watched. Playing something of a removed entry brings it back into Currently Watching (existing un-hide rule). The "Hidden" list in Settings stays as the place to move entries back.

**Goes away:** "Follow" (a never-watched show now lives in Not watched; starting an episode moves it up), the Following section and settings list, and the sections now covered: Continue Watching, Unwatched Movies. Favorites and Recently Added stay.

**Decided (2026-10-17):** Follow is removed; Continue Watching and Unwatched Movies sections are removed (saved layouts drop them); **specials count** as unwatched content (a show with only unwatched season-0 episodes stays in Currently Watching / New Episodes).

**Data:** all from what's loaded today (played / unplayed episode lists, resumable items, series catalog with library, recently played). Not watched per library needs the series' library (ParentId / ancestors) and an unwatched-movies query per library. Large libraries: rows are limited (section option) with a "show all" link to the library page.

---

## 4. Milestones & tasks

The order follows CLAUDE.md, with the prefs layer moved forward because the dashboard, playback, and languages all depend on it. One commit (or small PR) per task group.

### M0: Project setup
- [x] Vite + React + TS scaffold, strict TS, `@/` alias
- [x] Tailwind v4, TanStack Query, React Router, `@jellyfin/sdk`, hls.js installed
- [x] Folder structure, dev proxy (`JELLYFIN_URL` in `.env.local`)
- [x] Git repo connected to `github.com/Kerubis/JellyfinFrontend`
- [x] Fill in server URL / version / test user in CLAUDE.md (URL + version done, test user open)

### M1: Auth, data layer, device identity
- [x] `api/client.ts`: SDK `Jellyfin` instance, `clientInfo`, `deviceInfo` (persistent `deviceId`, editable device name)
- [x] Server URL setup screen (dev: `/jellyfin` proxy, prod: entered URL), `GET /System/Info/Public` check
- [x] Login (username/password), token in `localStorage`, logout, 401 → back to login
- [x] Quick Connect sign-in (enabled on the server; handy for the TV)
- [x] Profile picker (`/Users/Public` + profiles remembered on the device), multiple stored tokens, quick switch from the header menu
- [x] `domain/` first types + mappers: `User`, `Library`, `Series`, `Episode`
- [x] First query hook: user libraries (`UserViews`) rendered as a list
- [x] `POST /Sessions/Capabilities/Full` on login (playback types only; `SupportsMediaControl` + commands get switched on in M11, see PLAN2.md)
- [x] Verify in the browser: login, Quick Connect, profile switch, sign out, revoked token → login

### M2: Profile prefs layer (synced)
- [x] `domain/prefs.ts`: typed schema per key + defaults + versioned `migrate()` (keys so far: `playback`, `ui`, `following`; `dashboard`, `languages`, `safety`, ... get added in their milestones)
- [x] `api/prefs.ts`: read/write `DisplayPreferences` (`jff-profile` / `jellyfin-frontend`), JSON per key, read-modify-write
- [x] `PrefsProvider` + `usePref(key)` hook: optimistic update, debounced write, refetch on window focus (incl. side-by-side windows) + when opening Settings + 15 s poll while visible (Jellyfin has no change event for DisplayPreferences), flush on tab hide / profile switch, retry on failure
- [x] Device-override layer in `localStorage`, merged in `usePref`
- [x] Settings: playback + display prefs (card size can be overridden per device)
- [x] Verify in the browser: change on PC → appears on the second device after focusing it; device override stays local
- [x] Verify size limits and admin write access for other users: run Settings → "Sync diagnostics (dev)", record results here and under open questions

### M3: Home: "Currently Watching" + section framework
- [x] Spike against the real server (findings in D15): 3 requests total (played episodes, unplayed episodes, series catalog), ~0.2 s each, ~700 KB gzipped
- [x] `useCurrentlyWatching()` implementing the CLAUDE.md rule + Following + hidden list (pure logic in `domain/currentlyWatching.ts`)
- [x] Dense `CardGrid` + compact poster/thumb cards (poster, title, next episode `SxxEyy`, unwatched count, "NEW" badge), card size from prefs
- [~] Card click → series page stub for now (decided: M5 switches the click to "play next", the secondary action keeps opening the series)
- [x] Dashboard renders `DashboardSection[]` from prefs (default: Currently Watching, New Episodes, Recently Added)
- [x] New Episodes: one card per started/followed, unfinished series with all its unwatched episodes (range + count); no time window unless the section sets `days`, NEW badge only for episodes added in the last 7 days
- [x] Continue Watching merged into Currently Watching (D17); the separate section type stays available but is off by default
- [x] Remaining section types: Following, Favorites, Unwatched Movies (Recently Added takes `libraryIds`, which replaces the planned "library row")
- [x] Sections other than Currently Watching are single rows that scroll horizontally (‹ › buttons appear when there is more); Currently Watching stays a wrapping grid
- [x] Auto refresh for always-on screens: unplayed list every 5 min, played list every 15 min, other sections every 10 min
- [x] Verify in the browser with a user that has watch history
- [x] Hide from Currently Watching: ⋯ menu on the card → "Remove from Currently Watching" (series and movies); ✓ top-right marks the card's next episode (or the movie) watched, "Unhide" list in Settings (D18). Unhides only manually or when something of it is played after hiding (any client; checked against the 50 most recently played items every 5 min)
- [x] Follow action: UI comes with the series page (M4); prefs and the rule already support it

### M4: Series page
- [x] Two-column layout: header + seasons on the left (sticky), episodes on the right; stacked on narrow screens
- [x] Series header (compact: poster, years, status, rating, genres, expandable overview, "x / y watched", next episode), season grid with poster previews below the header (specials last, unwatched count per season, selected season in the URL, defaults to the next episode's season), episode grid (wrapping cards: large still = play button, banner with SxxEyy, title, air date, runtime; watched toggle top-right on hover, always shown when watched; progress bar; NEXT marker)
- [x] Mark watched/unwatched per episode and per season (season: ✓ overlay on the season poster, like episodes; season posters 10rem wide, unwatched count top-left) (optimistic update of the shared watch-state lists, D19)
- [x] Play from episode (episode still) / play next (series poster, labelled "Play SxxEyy") / play season (circle on the season poster: next unwatched episode after the furthest watched one in that season, or its first episode when all are watched): clickable areas exist, wired up in M5
- [x] Follow toggle, "Remove from Currently Watching" (hide)
- [x] **"Add to Currently Watching"** action: removes the series from `following.hidden` and adds it to `following.followed` (so it shows even without watch history); disabled when everything is watched
- [x] Spoiler protection (Settings → "Show spoilers"): unwatched episodes get a blurred still; titles stay visible (episode descriptions aren't shown at all)
- [x] Verify in the browser (mark watched/unwatched on the real server, season marking, follow/hide round trip)

- [x] Episode view inside the series page (`/series/:seriesId/episode/:episodeId`; left column stays, right column shows the episode instead of the list; season of the episode selected; old `/episode/:id` links redirect): still (play / resume, ✓, progress, spoiler blur), series + season links, title, air date, runtime, watched / stopped-at, spoiler-protected description, Play / Resume / Play from start / Mark watched, audio + subtitle languages, previous / next episode
- [x] Series page accepts `?sn=<season number>` besides `?season=<id>` (links where only the number is known)

### M5: Persistent player core
- [x] Player engine (`features/player/engine.ts`: framework-free state store + **command dispatcher**, D8), bound to React via `useSyncExternalStore`, mounted at app root (`PlayerProvider` + `PlayerOverlay` outside `<Routes>`)
- [x] Device profile from detected browser codecs (`lib/codecs.ts` → `api/playback.ts`); per-device settings (max bitrate, MKV direct play, force transcode) in Settings, stored locally. 10-bit H.264 forced to transcode, text subs External, image subs burned in
- [x] `PlaybackInfo` → direct play (`<video src>`) or HLS (`hls.js`, lazy-loaded; native HLS on Safari). Verified on the server: MKV direct-plays when allowed, otherwise HLS remux (237-segment VOD playlist, seekable)
- [x] Overlay ⇄ mini-player: one `<video>`, only CSS changes; navigating while in full view shrinks it to the mini player
- [x] Progress reporting: start (first frame) / progress (10 s, pause, seek) / stopped (stop, end, next item, profile switch; `sendBeacon` on page unload). Stopping also ends the server transcode
- [x] Resume position (profile setting "Partly watched": always / ask / start over; position from the item endpoint)
- [x] Starting playback of a hidden series/movie unhides it right away
- [x] Controls (one bottom bar): full-width seek bar with buffer; left: skip back, play/pause, skip forward, next, stop, time; centre: title; right: volume, audio + subtitle menus, mini player, picture-in-picture (P; subtitles switch to native rendering there), cast, fullscreen; auto-hide after 3 s. Keyboard: Space/K, ←/→, ↑/↓, F, M, N, Esc. OS media keys via Media Session
- [x] Cast button (browser Remote Playback API) left of fullscreen; Chrome's own overlay Cast button hidden. Only shows when a device is available and the source is castable: direct-play URLs the device can reach (not `localhost` in dev, not hls.js/MSE streams)
- [x] Skip back/forward times (default 5 s, synced) with optional per-library overrides; buttons, ←/→ and OS media keys all use `skipBack`/`skipForward` commands resolved by the engine for the playing item's library
- [x] Play buttons wired: Currently Watching poster (series: next episode, movie), series poster, season circle, episode still
- [x] "Next episode" (button, N, end screen) via `Shows/{id}/Episodes?adjacentTo` (full autoplay/countdown is M8)
- [x] Verify in the browser: Chromium (direct play MKV) and Firefox (HLS remux), resume, progress shows up in the Jellyfin dashboard, watched state after finishing, mini player while browsing

### M6: Tracks & language defaults
- [x] Audio track switching: picking another track requests a new stream from the current position; a non-default audio track can't be direct-played by `<video>`, so the server remuxes it (video + audio copied, verified)
- [x] Subtitle switching: text tracks switch instantly in the browser; image subtitles (PGS/VobSub) are requested burned in (new stream), "Off" really turns burned-in subtitles off (verified: only the audio is transcoded then)
- [x] Text subtitles with own overlay (`SubtitleOverlay`, D24) + style settings: font size (synced, per-device override), background (none/light/medium/dark), distance from the bottom
- [x] Track resolution (`domain/tracks.ts`, §3.4): series memory → library rule → profile rule → Jellyfin user settings → file defaults. Modes default / off / forced / always / smart; Signs & Songs vs. Full heuristic; language codes normalized (ger/deu, de → deu)
- [x] Settings UI: profile + per-library audio/subtitle languages and mode; "Remembered per series" list with forget / forget all
- [x] Per-series memory: manual picks are saved by language + title (indices differ between files), latest 300 series, synced
- [x] Subtitle delay: ±0.1 s in the subtitle menu or G / H, shown and resettable (per playback)
- [x] Verify in the browser: DanMachi (jpn/eng audio, Full + Signs/Songs subs), American Made (PGS forced → burned in; Off → audio-only transcode), a library rule for Anime

### M7: ASS/SSA subtitles
- [x] JASSUB 2.5.21 added (approved; libass in WebAssembly, LGPL-2.1+). Loaded lazily: the worker/wasm (~0.9 MB gzipped) and fallback font only download when an ASS track plays. `optimizeDeps.exclude: ['jassub']` keeps its `new URL(..., import.meta.url)` assets working in dev. `lfa-ponyfill`'s postinstall (refreshes a Google Fonts list) is left blocked: not needed
- [x] Render ASS/SSA with full styling: original `Stream.ass` + fonts from the MKV attachments (`/Videos/{id}/{source}/Attachments/{index}`, verified: 9 fonts on DanMachi), JASSUB's bundled fallback font, no local-font permission prompts. Works over HLS and direct play (it follows the `<video>` element), in full view and the mini player; subtitle delay maps to JASSUB's `timeOffset`
- [x] Fallbacks: plain text overlay if JASSUB fails or "Styled ASS/SSA subtitles" is off (per-device setting, for weak clients); native WebVTT in picture-in-picture
- [x] Timing offset for mid-file transcodes: not needed: HLS playlists always start at 0 and the start position is applied client-side (D22), so `currentTime` is the file time
- [x] PGS: server burn-in path (M6)
- [x] Verify in the browser: DanMachi Full / Signs & Songs with embedded fonts, a typeset-heavy episode, mini player, delay, PiP fallback, CPU load on the HTPC
- [x] Later (optional): COOP/COEP headers for multi-threaded JASSUB (needs the server/proxy to send them; single-threaded works without)

### M8: Autoplay & segments
- [x] Next-episode resolution: series order via `adjacentTo`; from a regular episode, specials (season 0) placed in between are skipped; from a special it simply continues
- [x] "Up next" card (bottom right): poster, `SxxEyy` (+ title only with spoilers on), countdown bar, Play now / Cancel. Appears at the outro if only outro (+ preview) remains, otherwise `countdown` seconds before the end, so post-credit scenes aren't cut. Pausing stops the countdown; seeking back hides it again
- [x] Preload: item, track choice and PlaybackInfo of the next episode are fetched when "Up next" appears and reused when it starts
- [x] Segments: Jellyfin MediaSegments if a provider fills them (none installed yet, see open questions), else derived from chapter names ("OP/Opening" → intro, "ED/Ending" → outro, recap, preview; cold opens like "Intro/Prologue/Avant" are not skipped; implausible lengths ignored). Verified chapter naming on several anime series
- [x] Skip intro/recap (setting "Intro") and outro/preview (setting "Outro / credits"): auto / button / off. Skipping credits that run to the end goes straight to the next episode
- [x] "Still watching?" after N autoplays without any input (setting; any command resets the counter), Continue / Stop
- [x] Carry over: tracks (series memory / rules), volume, fullscreen; subtitle delay within the same series
- [x] Verify in the browser: autoplay chain with countdown, Cancel, pause during credits, "Skip intro" button on a series with OP/ED chapters (e.g. Date A Live, Chainsaw Man), post-credit scene (One-Punch Man), Still watching after 3

### M9: Dashboard editor
- [x] Editor in Settings → "Home" tab (moved there from an edit mode on the home page), changes saved right away (synced prefs)
- [x] Per section: ↑/↓ reorder, visible, rename (empty = default title), remove; options per type: max items (empty = default), "NEW" window / "only added in the last N days" (New Episodes), libraries (Recently Added, none = all)
- [x] Add sections (any type, also several of the same type, e.g. Recently Added per library), reset to default
- [x] "Hide when empty" per section (shown while loading and on errors, hidden once loaded and empty)
- [x] Per-device visibility: "Hide on this device" (device-override layer, `dashboard.deviceHidden`, never synced)
- [x] Verify in the browser; note: once the dashboard is edited, new default section types no longer appear on their own (use "Add section" / "Reset to default")

### M10: Profiles & child safety
- [x] Settings → "Profiles & limits" (admins): every other user's **Jellyfin limits** (max rating level, allowed libraries, blocked tags, allowed time windows) edited via `POST /Users/{id}/Policy` (full policy read fresh, patched, written back) + **app limits** written into that user's synced prefs (verified: admins can write other users' DisplayPreferences)
- [x] Non-admin users see their own restrictions read-only; clear "not allowed right now" message when Jellyfin refuses a user outside the allowed times
- [x] Soft limits (`domain/safety.ts`, per profile): daily watch-time budget (counted every 15 s while playing, saved per minute, synced, stops playback with a friendly screen when used up), bedtime (no new playback incl. autoplay, running episode may finish, notice 10 min before), budget notice 5 min before
- [x] Kid mode UI: no settings route, no dashboard editing, profile menu only "Sign out"; signing out from kid mode locks the profile picker on that device (remembered profiles need password / Quick Connect until the next sign-in)
- [x] Decided: no PIN; no "episodes per session" limit
- [x] Bedtime stops playback when it starts (checked every second; was: running episode may finish); warning from 10 min before, last minute counts down in seconds, "no more TV after that". Limits (bedtime and daily budget) now stop for real: position reported to Jellyfin and stream released (before: only paused, position not reported)
- [ ] Verify with a kid user (none on the server yet): kid mode, budget, bedtime, Jellyfin limits as seen by the kid

### M11: Home Assistant remote control
Deprioritized, moved to [PLAN2.md](PLAN2.md).

### M12: Library browsing & search
- [x] Header navigation: Home + one link per video library
- [x] Header links: full header height, active = background-glow blue (`#00A4DC`/22), hover = light-blue inset ring; per-link text colour (Settings → Display → Header link colours, synced `ui.navColors` by `home` / library id, native colour picker + reset)
- [x] Library grid (`/library/:id`): sort (name, date added / new episode for shows, year, rating, last played) + direction, watched filter, genre, year; filters live in the URL; pages of 120 loaded on scroll (no virtualization needed at ~150 items, revisit for big libraries)
- [x] Cards: series open their page; movies/episodes play from the poster
- [x] Global search in the header (debounced 300 ms, `/` focuses it): `/search?q=` with "Shows & movies" and "Episodes". Note: Jellyfin only matches stored titles (DanMachi → "dungeon", not "danmachi")
- [x] Verify in the browser
- [x] Library, search and all home rows use the shared tile overlay (play, ✓, ⋯, unwatched count) via `MediaItemCard` (D27)
- [x] Movie tiles get a ⋯ menu: Open details, Play from start (when started), Add to / Remove from favorites (`MediaItem.favorite` from list UserData; favorite changes refresh home lists, library grids, search)
- [x] Movie detail page (`/item/:id`): poster (play / resume, ✓, progress), year · runtime · age rating · ★ · critics, genres, tagline, description, Play / Resume / Play from start / Mark watched / Favorite, director, writers, cast with roles, studio, audio + subtitle languages, "More like this" row (`/Items/{id}/Similar`); series / episode ids redirect to their pages
- [x] A–Z scrollbar (name sort only): fixed letter rail on the right edge that replaces the page scrollbar while shown; letters run in list order (reversed for Z→A), each letter's height proportional to its item count (min 12 px, empty letters stay at the minimum), a thumb spans the part of the list currently on screen and moves continuously (fractional row position, each letter's items spread over its rail rows up to the next letter that has items); click a letter to jump, drag to scrub. One request loads all sort names (`Fields=SortName`, no images / user data) for a letter → position index with the grid's filters; a jump loads pages up to that position first. `#` = digits, symbols, non-Latin; diacritics folded (É → E)
- [x] Refresh button next to the library name, showing the title count. Admins start the full "Scan Media Library" task (`POST /Library/Refresh`; the per-library `POST /Items/{id}/Refresh` returns 204 but finds no new files, checked 2026-10-16), the button follows the task (`/ScheduledTasks`, % shown) and reloads all user data every 30 s and at the end. Non-admins only reload (scans need admin). Admin flag is refetched on click
- [x] Verify A–Z jump in the browser

### M13: TV / 10-foot mode & polish
- [x] Custom page scrollbar on every page (`PageScrollbar` in Layout, native one hidden): dark rail + light Jellyfin gradient thumb, drag / click-to-jump; generic `ScrollRail` (window or any overflow element) also used for the series page's left pane; shares its look (`scrollRailStyles.ts`) with the library A–Z rail, which replaces the page rail via `useReplacePageScrollbar`
- [x] Tile "⋯" menu always fully visible and never over its tile (portal + fixed position): room to the right → right of the tile (bottom-left at the tile's bottom-right); else room below → below (top-right at the tile's bottom-right); else → left of the tile (bottom-right at the tile's bottom-left). Menu touches the tile; one Jellyfin-violet outline around both (SVG overlay, strokes masked by both boxes, so no line where they meet). Closes on scroll / resize
- [x] Time format setting (Settings → Appearance: automatic / 24-hour / 12-hour, synced `ui.timeFormat`) used for every clock time (time fields, access schedule hours, bedtime, activity tooltips); `useTimeFormat` + `lib/time.ts` (format / parse incl. "8pm", "12 AM")
- [x] Time picker in the style of Android's clock dial (`ClockDialog`): hour then minute on the dial (drag or tap, any minute), 24 h with two rings like Android (12, 1–11 outside; 00, 13–23 inside), AM / PM toggle in 12 h, arrow keys + Enter, Cancel / OK; `TimeField` keeps typing as an alternative. Replaces every `<input type="time">`. Checked in a headless browser in both modes (screenshots)
- [x] Fix: "stopped" on page unload (reload, closing the tab, dev full reloads) was never sent: `sendBeacon` with a JSON body is refused by Chromium, so the server kept the session "playing" and saved no position. Now a `keepalive` fetch; verified (reload during playback → server logs the stop with the position). To verify in production: cross-origin keepalive request with CORS preflight
- [ ] Spatial navigation + focus styles across components
- [ ] TV device preset (card size, UI scale, hidden sections)
- [x] Chapters in the seek bar (gaps at chapter starts, intro amber / outro rose highlights, hover tooltip with time + chapter name)
- [x] Trickplay thumbnails in the seek-bar tooltip: manifest from the item (`Trickplay[mediaSourceId][width]`), resolution ≥ 320 px picked, frame cut from the tile sheet (`/Videos/{id}/Trickplay/{width}/{n}.jpg`, token in the URL since it's a CSS background) and shown at 208 px above time + chapter; tooltip clamped inside the bar
- [ ] Verify trickplay in the browser: needs "Enable trickplay image extraction" on the libraries (off on all three, 2026-10-16) and a run of "Generate Trickplay Images"
- [ ] Performance pass (image sizes via `fillWidth`/`quality`, query caching), responsive layout
- [x] Docker image for Unraid (D31): multi-stage `Dockerfile` (node build → nginx:alpine), `docker/nginx.conf` (SPA fallback, immutable `/assets`, no-cache entry points, gzip, `/health`), `JELLYFIN_URL` → `/config.js` at container start (app auto-connects, setup form as fallback), GitHub Actions → `ghcr.io/kerubis/jellyfinfrontend` on `v*` tags only (`latest`, `x.y.z`, `x.y`), Unraid template `unraid/jellyfin-frontend.xml` (br0, required server URL), version shown in Settings; README "Docker / Unraid"
- [x] Unreachable server: checked once per page load in the background (`useServerUnreachable`: no answer, or 502/503/504 from a proxy in between, e.g. the Vite dev proxy; other HTTP errors don't count) → setup screen with the old address (Retry / change); profiles are kept since they belong to the server id, not the address. A preset `JELLYFIN_URL` that differs from the failed address is tried automatically
- [x] Plain-HTTP fix: device id without `crypto.randomUUID` (secure contexts only)
- [x] First release: push `v0.2.0`, make the GHCR package public, install via the template on Unraid and verify (update flow: new tag → Unraid "Check for updates")

### M14: Settings shell & restructure (no new server features)
- [x] `/settings/:page` routes, left menu with groups (Profile / This device; Administration once it has pages), dropdown on narrow screens, old `?tab=` links redirect
- [x] Pages per §3.8. Profile: Account, Playback, Audio & subtitles, Home, Appearance, Currently Watching (followed + hidden lists), Limits (non-admins with limits). This device: Device & server, Playback quality, About. Administration: Users (today's limits editor; grows in M16). Old ids (`display`, `profiles`, `?tab=`) redirect
- [x] Account page: profile picture (upload base64 to `/UserImage` like the stock client; session avatar updated), password (403 = wrong current password), Quick Connect "approve a code" (only when enabled on the server). "Sign out everywhere" moved to the admin Devices page (M17): only admins can end other devices' sessions
- [x] About page (app + server version); profile menu gets "Administration" for admins
- [x] Write-through (D32) on change in our settings: global audio / subtitle language (first one), subtitle mode, autoplay next → `POST /Users/Configuration` (read fresh, patch, write whole). Clearing a field clears it in Jellyfin too
- [x] Verify M14 in the browser (avatar upload, password change, Quick Connect approve from a second device, write-through visible in the official app's settings)

### M15: Admin overview, tasks, activity
- [x] Administration pages in the settings menu (admins only): **Overview** (incl. scheduled tasks), Users, **Activity & logs**; profile menu "Administration" → Overview. Old `/settings/tasks` and `/settings/logs` redirect
- [x] Overview: server name / version / platform / address (+ "update available", "restart needed"); scan all libraries, restart, shut down (inline confirmation, `ConfirmButton`); active devices of the last 15 min (playing first, refreshed every 5 s: title, progress, direct play / stream / transcode + reasons + hardware encoder, stop playback, send message, where the client supports it); storage per disk (server folders and libraries grouped by device, warn above 90 %); recent activity
- [x] Scheduled tasks by category: last run (status, when, duration, error), schedule, run / stop, progress; schedule editor (daily / weekly / every N hours / on startup, add / remove; saves the whole trigger list)
- [x] Activity log (pages of 50, user names, severity dots); log files (FFmpeg logs hidden by default) with a viewer: line filter, errors / warnings coloured, reload
- [x] Our client reports the real app version (was a hard-coded 0.1.0) so the device list shows what each browser runs
- [x] Verified in a headless browser against the server (all four pages, no errors / failed requests). Not exercised: restart, shutdown, stop / message (our own client doesn't accept remote commands until the Home Assistant socket work in PLAN2)
### M16: Admin users & libraries
- [x] Users page: list (badges admin / disabled / hidden / limited / no password, last activity), add user (name + password), user detail via `?user=`: name + account switches (admin, disabled, hidden from login screens, remote access, downloads, transcoding; saved explicitly, policy read fresh + patched), set / remove password (admins need no current one), library access & Jellyfin limits (LimitsEditor), app limits (SafetyEditor), delete (confirmation). Own admin / disabled switches and deleting yourself are blocked
- [x] Libraries page: scan all, per library (expandable): folders (add via server folder picker `/Environment/*`, remove with confirmation), options (real-time monitoring, save artwork / NFO next to media, embedded titles, trickplay ± during scan, chapter images ± during scan, metadata language / country, refresh interval; explicit Save, other options read fresh and kept), rename, remove (confirmation); add library (name, kind, folder)
- [x] App limit "Show the Home page" per user (`safety.showHome`, set on the user's admin page; e.g. guests): off = no Home link, `/` opens the first library, header colour setting for Home hidden; shown under the user's own Limits page
- [x] Libraries page in two columns (libraries left, add library right)
- [x] Per-library scan left out: `POST /Items/{id}/Refresh` doesn't pick up new files (checked 2026-10-16), so the page only offers the full scan. `EnableInternetProviders` not offered (legacy flag; metadata sources are set per type)
- [x] Verified read-only in a headless browser (user list / detail, library card, folder picker); create / delete / save not exercised against the server
### M17: Admin playback, plugins, devices, backups
- [x] Generic server-settings forms: pages described as data (`configSpecs.ts`: field kind, Jellyfin key path, hints, conditional fields), one `ConfigForm` (read fresh, change only the edited paths, write back whole; explicit Save / Discard). Sources: `/System/Configuration`, named configurations, plugin configurations
- [x] Playback & transcoding: hardware acceleration (+ VAAPI / QSV device, hardware decoding codecs, 10-bit, hardware encoding), HEVC / AV1 encoding, tone mapping, preset, CRF, threads, deinterlacing, throttling, segment deletion, subtitle extraction, down-mix boost; Resume (min / max %, min duration); Streaming (remote bitrate limit in Mbit/s); Trickplay options
- [x] Plugins: installed (image, version, status, enable / disable, uninstall with confirmation), settings as a form generated from the plugin's JSON configuration (booleans, numbers, strings incl. hidden secrets, string / number lists; nested values read-only), catalog (search, install), repositories (enable, add, remove); restart notice with "Restart now"
- [x] Devices & API keys: devices (app, user, last activity, this device marked) with sign out and "Sign out all other devices" (the "sign out everywhere" from M14); API keys list / create (new key shown once, select-to-copy since the clipboard API needs HTTPS) / revoke
- [x] Backups: create (database / metadata / trickplay / subtitles), list, restore with two explicit steps
- [x] General (server name, metadata language / country, Quick Connect, monitor delay, log retention, image encodings) & branding; Networking (ports, base URL, HTTPS, subnets, proxies, remote access + filter, discovery, UPnP, IPv6; warning + restart notice); Library defaults (display, date added, artwork naming, NFO)
- [x] Verified read-only in a headless browser (every page, TMDb's generated form, catalog); nothing saved / installed / restored against the server

### M18: Home sections rework (§3.9)
- [x] Domain: `buildHomeSections` splits the watch state into Currently Watching / New Episodes / Not watched in one pass; checked against admin's real data (16 / 0 / 71 of 152 shows, 65 finished; no show twice; removing a started show moves it to New Episodes, a never-watched one stays in Not watched)
- [x] Currently Watching: play position or started & unfinished (specials count; a rewatch in progress continues that episode); remove any entry (show / movie ⋯ menu, series page); last-watched sort (D33)
- [x] New Episodes: started & unfinished shows removed from Currently Watching; newest episode first; NEW badge; "Back to Currently Watching" in the ⋯ menu and on the series page
- [x] Not watched: section type with a library option (none = one row per browsable library), shows from the catalog + unwatched movies per library, newest added first, "Show all" → library page with the Unwatched filter
- [x] Follow removed (menus, series page button, Following section + settings list); Continue Watching / Unwatched Movies section types removed (saved layouts drop them); dashboard pref v2 adds "Not watched" to saved layouts once
- [x] Removed list: pref key `following` → `watching` (read from the old key until written; v1 plain-id format still migrated)
- [x] Cleanup (`useRemovedListMaintenance`): drops entries with nothing unwatched / no position left, watched movies, items that no longer exist; only when all lists loaded without error; also brings entries back after a later play (as before)
- [x] CLAUDE.md core rule, section descriptions, settings texts updated
- [x] Verify in the browser: remove / bring back a show and a movie, cleanup after finishing a removed show, own custom sections from before (e.g. renamed "Not watched …" Recently Added sections) vs. the new ones
---

## 5. Open questions

- [~] **Server URL, Jellyfin version** (≥10.10 needed for media segments), test user / libraries → fill into CLAUDE.md. Done: `http://172.16.100.12:8096` (was .228 until 2026-10-17), v12.2.0. Still open: test user / libraries
- [ ] **Server: NVENC/CUDA hardware encoding fails** (`CUDA_ERROR_NO_DEVICE` in the FFmpeg log, 2026-10-15), so every real transcode returns HTTP 500 (e.g. American Made: DTS-HD audio + forced PGS subtitle). Direct play/remux is unaffected. Fix GPU access for the Jellyfin container, or switch hardware acceleration off until then
- [ ] Segment provider: none installed (checked 2026-10-15: no plugin, `/MediaSegments` empty). The app falls back to chapter names; installing e.g. Intro Skipper would cover files without chapters
- [x] **Following**: decided: separate list in prefs (`following.followed`), favorites stay independent. "Import favorites" can come later.
- [ ] Kids: no kid user yet (2026-10-15); create one in the Jellyfin dashboard to test M10
- [ ] TV browser: Chromium/Firefox in kiosk mode? Input device (keyboard, remote, gamepad, CEC)? This affects the codec profile and navigation.
- [ ] How common are PGS subs in the library (decides when client-side PGS is worth it)?
- [ ] `CustomPrefs` value size limits and whether admins can write other users' prefs (M2 spike)
- [ ] Production hosting: static files behind the same reverse proxy as Jellyfin (no CORS) or separate origin?
