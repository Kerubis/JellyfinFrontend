# Jellyfin Frontend: Deprioritized work

Milestones moved out of [PLAN.md](PLAN.md) because they aren't important right now. Same legend. The concept for this one is still in PLAN.md §3.2.

### M11: Home Assistant remote control
- [ ] `api/socket.ts`: Jellyfin WebSocket, keep-alive, reconnect
- [ ] Bridge `Playstate` / `GeneralCommand` / `Play` messages → command dispatcher
- [ ] Verify with HA's Jellyfin integration: play/pause/seek/next/volume/track, state shown correctly
- [ ] Document HA setup in README
