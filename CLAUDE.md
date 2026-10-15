# Custom Jellyfin Frontend

A dense, fast, personal web client for a Jellyfin server. Jellyfin stays the backend (scanning, metadata, transcoding, GPU acceleration, auth, watch state). This project replaces only the UI.

## Why this exists

Problems with the stock Jellyfin web UI that this project fixes:

1. **Wasted space**: too much scrolling. Needs a dense layout with compact cards and a tight grid.
2. **Weak "currently watching" / new-episode discovery**: Jellyfin's Resume and Next Up lose or reorder shows when new episodes arrive. I watch a lot of anime with weekly releases, so shows I follow must always be at the top when a new episode is available.
3. **Navigation**: starting playback throws the user out of the navigation. Playback must never destroy browsing context.

## Tech stack

- React + TypeScript (strict mode)
- Vite
- `@jellyfin/sdk` for API access
- `hls.js` for HLS playback (use native `<video>` for direct play)
- TanStack Query for data fetching and caching
- React Router
- Styling: Tailwind CSS v4 (decided, no CSS modules)
- Linting: oxlint
- Target: modern browsers on Windows and Linux (desktop first, responsive later)

## Architecture rules

- **All Jellyfin calls go through a data layer** in `src/api/`. Components never call the SDK directly. This keeps a future backend swap contained.
- Define our own domain types (`Series`, `Episode`, `PlaybackSource`, ...) in `src/domain/` and map from Jellyfin DTOs in the data layer.
- **The player is a persistent overlay / mini-player** mounted at the app root, outside the router outlet. Navigating while something plays must not interrupt playback.
- Server URL and credentials are configurable (no hardcoding). Store the access token in `localStorage`.
- During development, proxy API calls through the Vite dev server to avoid CORS issues.

## Suggested structure

```
src/
  api/          # Jellyfin client wrapper, auth, queries
  domain/       # our own types + mappers
  features/
    home/       # dense "currently watching" grid
    library/    # browse, filter, search
    series/     # series / season / episode views
    player/     # persistent player, controls, subtitles
  components/   # shared UI (cards, grids, layout)
  hooks/
  App.tsx
```

## Core feature: "Currently Watching" (home page)

Build this first. It is the main reason the project exists.

**Rule:** a series is in the list if the user has watched at least one episode **and** an unwatched episode exists. Sort by the **newest episode's `DateCreated`**, descending. A new episode therefore always moves the show to the top.

**Optional "Following" flag:** an explicit per-series flag (Jellyfin favorites to start with) that keeps weekly shows in the list regardless of watch history. Decide during implementation whether it is combined with, or replaces, the inferred rule.

Home page requirements:

- Dense grid with small cards: poster, title, next unwatched episode, "new" badge
- Minimal scrolling, many items visible at once
- Clicking a card starts the next unwatched episode, with a secondary action to open the series page

Check in the Jellyfin swagger docs (`<server>/api-docs/swagger`) which queries to use: per-user watch state, episode `DateCreated`, `IsUnplayed` filters, and queries by series. Do not rely on the built-in Resume or Next Up endpoints for the main list.

## Playback

- Call the playback info endpoint and let Jellyfin decide between direct play and transcode, then feed the returned stream URL to the player.
- Report playback progress back to Jellyfin (start, progress, stop) so watch state stays correct.
- Plan early for: ASS/SSA subtitles (anime!), audio track switching, chapters, "next episode" autoplay, resume position.
- Subtitle idea: JavaScript SubtitlesOctopus (libass in WASM) for styled ASS subs, as an alternative to burning them in on the server.

## Milestones

The detailed, up-to-date milestone list and task tracker is in [PLAN.md](PLAN.md). Keep it updated as work lands. The list below is the original outline.

1. Project setup, login against the Jellyfin server, API data layer, one working query
2. Home page: "Currently Watching" grid with the sorting rule above
3. Series page and episode list
4. Persistent player: direct play and HLS, progress reporting
5. Library browsing, search, filters
6. Subtitles, audio tracks, chapters, autoplay next
7. Polish: keyboard shortcuts, responsive layout, performance

## Conventions

- TypeScript strict, no `any` without a comment explaining why
- Small components, logic in hooks
- Keep dependencies minimal, ask before adding a new one
- Commit per milestone or feature, with clear messages

## Notes for Claude Code

- Start with milestone 1 and keep changes small and reviewable.
- Before implementing a feature, briefly propose the approach and ask when a decision is unclear.
- Verify Jellyfin API behavior against the swagger docs and the real server rather than assuming.
- Jellyfin server URL: `http://172.16.100.228:8096` ("Kerubis Jellyfin", version 12.2.0). Dev proxy target is set in `.env.local`.
- Test user / library notes: `TODO`
