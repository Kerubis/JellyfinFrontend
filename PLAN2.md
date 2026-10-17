# Jellyfin Frontend: Deprioritized work

Milestones moved out of [PLAN.md](PLAN.md) because they aren't important right now. Same legend. The concept for this one is still in PLAN.md §3.2.

### M11: Home Assistant remote control
- [ ] `api/socket.ts`: Jellyfin WebSocket, keep-alive, reconnect
- [ ] Bridge `Playstate` / `GeneralCommand` / `Play` messages → command dispatcher
- [ ] Verify with HA's Jellyfin integration: play/pause/seek/next/volume/track, state shown correctly
- [ ] Document HA setup in README

### Sonarr / Radarr → Jellyfin library updates
New files on the network shares aren't noticed by Jellyfin's real-time monitoring (all libraries are network storage, checked 2026-10-17), so new episodes only show up after a full scan (fast when nothing is new, slow when many files are new).
- [ ] Sonarr: Settings → Connect → add "Emby / Jellyfin", enable "Update library" on import / upgrade / rename
- [ ] Radarr: same
- [ ] Check path mapping: Sonarr/Radarr report their own file paths; if they differ from Jellyfin's (`/tv/anime`, `/tv/1080p`, `/tv/2160p`, `/movies`), set up the path mapping in the connection
- [ ] Verify: a new episode appears in Jellyfin within ~1–2 min without a scan (the notification is `POST /Library/Media/Updated`; Jellyfin waits `LibraryMonitorDelay` = 60 s before checking the folder)
- [ ] Fallback if that's not possible: a per-library "check for new files" button in our app sending the same notification for the library's folders (unverified whether Jellyfin then picks up new files reliably; test when the next episode lands)

### Rating guard: hide whole shows above a profile's rating limit
Jellyfin checks the parental rating per item: episodes with their own rating ignore the show's rating, unrated items pass unless "block unrated" is set, and a limited user can't see (or count) the episodes above its limit. Found 2026-10-17 with KidTest (limit 10 = PG / TV-PG): My Hero Academia (TV-14) and Witch Hat Atelier (NC16) are hidden but some of their episodes are rated TV-PG and visible; Dagashi Kashi / One-Punch Man / Death March (TV-PG) have 23 / 23 / 7 TV-14 episodes hidden while the unrated ones show; Tales of the Abyss and Suikoden are unrated and visible.

Plan (decided: enforce on the server via blocked tags, computed outside Jellyfin):
- [ ] `tools/rating-guard` (small Node script, no dependencies, API key): per user with `MaxParentalRating`, find shows where the show **or any episode** is above the limit (server-side filter `minOfficialRating` = lowest rating above the limit, so non-US ratings map like Jellyfin maps them), tag them (e.g. `Above PG`), remove the tag where it no longer applies, add the tag to that user's `BlockedTags`. Episodes inherit the show's tags, so Jellyfin hides the show and every episode in all apps
- [ ] Run it on Unraid on a schedule (User Scripts cron or a tiny container), e.g. hourly
- [ ] App: "Recheck now" button on the Users page; "Block unrated items" switch in the limits editor (`BlockUnratedItems`: Series, Episode, Movie)
- [ ] Verify with KidTest: none of the shows above appear, nothing else disappears
