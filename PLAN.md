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
| D21 | **Fixed image corner slots** everywhere (home cards, season posters, episode stills): top-left = unwatched count (`CountLabel`), bottom-left = NEW/NEXT (`MarkerLabel`), top-right = action (watched toggle, remove). Positions live in `components/corners.ts` | Same information is always in the same place |
| D22 | **Start position is applied client-side** (`hls.js` `startPosition` / `currentTime` after metadata), `PlaybackInfo` is requested without `StartTimeTicks` | The HLS playlist always covers the whole file, so seeking and resume work the same for direct play and HLS |
| D23 | Subtitles in M5: text tracks fetched as WebVTT (`Stream.vtt`) and rendered natively; ASS loses styling until JASSUB (M7) | Usable anime playback now without burning subs in on the server |
| D24 | Text subtitles are drawn by our own overlay (`SubtitleOverlay`), not by the browser's `::cue` rendering | `::cue` can't be positioned (e.g. above the controls) and its line boxes leave gaps; the browser still does parsing and timing |
| D25 | `PlaybackInfo` track choices always carry `MediaSourceId` (query + body) | Verified on 12.2: without it the server silently ignores `AudioStreamIndex` / `SubtitleStreamIndex`, including "off" (-1) |
| D26 | Direct play only when the chosen audio is the file's default track; otherwise the server remuxes with the chosen track | Browsers can't switch audio tracks inside a file (`audioTracks` is not generally available) |
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
- [x] `POST /Sessions/Capabilities/Full` on login (playback types only; `SupportsMediaControl` + commands get switched on in M11)
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
- [x] Hide from Currently Watching: × on the card (series and movies), "Unhide" list in Settings (D18). Unhides only manually or when something of it is played after hiding (any client; checked against the 50 most recently played items every 5 min)
- [x] Follow action: UI comes with the series page (M4); prefs and the rule already support it

### M4: Series page
- [x] Two-column layout: header + seasons on the left (sticky), episodes on the right; stacked on narrow screens
- [x] Series header (compact: poster, years, status, rating, genres, expandable overview, "x / y watched", next episode), season grid with poster previews below the header (specials last, unwatched count per season, selected season in the URL, defaults to the next episode's season), episode grid (wrapping cards: large still = play button, banner with SxxEyy, title, air date, runtime; watched toggle top-right on hover, always shown when watched; progress bar; NEXT marker)
- [x] Mark watched/unwatched per episode and per season (season: ✓ overlay on the season poster, like episodes; season posters 10rem wide, unwatched count top-left) (optimistic update of the shared watch-state lists, D19)
- [ ] Play from episode (episode still) / play next (series poster, labelled "Play SxxEyy") / play season (circle on the season poster: next unwatched episode after the furthest watched one in that season, or its first episode when all are watched): clickable areas exist, wired up in M5
- [x] Follow toggle, "Remove from Currently Watching" (hide)
- [x] **"Add to Currently Watching"** action: removes the series from `following.hidden` and adds it to `following.followed` (so it shows even without watch history); disabled when everything is watched
- [x] Spoiler protection (Settings → "Show spoilers"): unwatched episodes get a blurred still; titles stay visible (episode descriptions aren't shown at all)
- [ ] Verify in the browser (mark watched/unwatched on the real server, season marking, follow/hide round trip)

### M5: Persistent player core
- [x] Player engine (`features/player/engine.ts`: framework-free state store + **command dispatcher**, D8), bound to React via `useSyncExternalStore`, mounted at app root (`PlayerProvider` + `PlayerOverlay` outside `<Routes>`)
- [x] Device profile from detected browser codecs (`lib/codecs.ts` → `api/playback.ts`); per-device settings (max bitrate, MKV direct play, force transcode) in Settings, stored locally. 10-bit H.264 forced to transcode, text subs External, image subs burned in
- [x] `PlaybackInfo` → direct play (`<video src>`) or HLS (`hls.js`, lazy-loaded; native HLS on Safari). Verified on the server: MKV direct-plays when allowed, otherwise HLS remux (237-segment VOD playlist, seekable)
- [x] Overlay ⇄ mini-player: one `<video>`, only CSS changes; navigating while in full view shrinks it to the mini player
- [x] Progress reporting: start (first frame) / progress (10 s, pause, seek) / stopped (stop, end, next item, profile switch; `sendBeacon` on page unload). Stopping also ends the server transcode
- [x] Resume position (profile setting "Partly watched": always / ask / start over; position from the item endpoint)
- [x] Starting playback of a hidden series/movie unhides it right away
- [x] Controls (one bottom bar): full-width seek bar with buffer; left: −10 s, play/pause, +10 s, next, stop, time; centre: title; right: volume, subtitle menu (text tracks as WebVTT, stopgap until M6/M7), mini player, fullscreen; auto-hide after 3 s. Keyboard: Space/K, ←/→, ↑/↓, F, M, N, Esc. OS media keys via Media Session
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
- [ ] Verify in the browser: DanMachi (jpn/eng audio, Full + Signs/Songs subs), American Made (PGS forced → burned in; Off → audio-only transcode), a library rule for Anime

### M7: ASS/SSA subtitles
- [ ] Ask: add JASSUB dependency
- [ ] Render ASS with attachments fonts, fallback font, works over HLS and direct play
- [ ] Timing offset for mid-file transcodes
- [ ] PGS: server burn-in path

### M8: Autoplay & segments
- [ ] Next-episode resolution (series order, specials)
- [ ] "Up next" card with configurable countdown, play now / cancel, preload
- [ ] Media segments: skip intro/recap/outro (auto / button / off)
- [ ] "Still watching?" prompt
- [ ] Carry over tracks/volume/fullscreen

### M9: Dashboard editor
- [ ] Edit mode: reorder (up/down), show/hide, rename, per-section options
- [ ] Add/remove sections, reset to default
- [ ] Per-device visibility overrides

### M10: Profiles & child safety
- [ ] Settings screen showing Jellyfin parental controls (rating, tags, libraries, access schedules) + clear "not allowed" states
- [ ] Soft limits: daily budget, episodes per session, bedtime, kid mode UI
- [ ] Admin-only editing, optional PIN for settings/profile switching

### M11: Home Assistant remote control
- [ ] `api/socket.ts`: Jellyfin WebSocket, keep-alive, reconnect
- [ ] Bridge `Playstate` / `GeneralCommand` / `Play` messages → command dispatcher
- [ ] Verify with HA's Jellyfin integration: play/pause/seek/next/volume/track, state shown correctly
- [ ] Document HA setup in README

### M12: Library browsing & search
- [ ] Library grid with filters (genre, year, watched, sort), virtualized if needed
- [ ] Global search (debounced)

### M13: TV / 10-foot mode & polish
- [ ] Spatial navigation + focus styles across components
- [ ] TV device preset (card size, UI scale, hidden sections)
- [ ] Trickplay thumbnails, chapters in seek bar
- [ ] Performance pass (image sizes via `fillWidth`/`quality`, query caching), responsive layout
- [ ] Production build + deployment notes (static hosting / served next to Jellyfin)

---

## 5. Open questions

- [~] **Server URL, Jellyfin version** (≥10.10 needed for media segments), test user / libraries → fill into CLAUDE.md. Done: `http://172.16.100.228:8096`, v12.2.0. Still open: test user / libraries
- [ ] **Server: NVENC/CUDA hardware encoding fails** (`CUDA_ERROR_NO_DEVICE` in the FFmpeg log, 2026-10-15), so every real transcode returns HTTP 500 (e.g. American Made: DTS-HD audio + forced PGS subtitle). Direct play/remux is unaffected. Fix GPU access for the Jellyfin container, or switch hardware acceleration off until then
- [ ] Does the server have a segment provider (e.g. Intro Skipper)?
- [x] **Following**: decided: separate list in prefs (`following.followed`), favorites stay independent. "Import favorites" can come later.
- [ ] Kids: separate Jellyfin user(s) already, or to be created?
- [ ] TV browser: Chromium/Firefox in kiosk mode? Input device (keyboard, remote, gamepad, CEC)? This affects the codec profile and navigation.
- [ ] How common are PGS subs in the library (decides when client-side PGS is worth it)?
- [ ] `CustomPrefs` value size limits and whether admins can write other users' prefs (M2 spike)
- [ ] Production hosting: static files behind the same reverse proxy as Jellyfin (no CORS) or separate origin?
