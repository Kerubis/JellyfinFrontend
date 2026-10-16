// Trickplay: server-generated preview frames for the seek bar. Jellyfin stores them as tile sheets
// (TileWidth × TileHeight frames per JPEG), one frame every `intervalMs`.

export type Trickplay = {
  /** Size of one frame in px. */
  width: number
  height: number
  /** Frames per sheet row / column. */
  columns: number
  rows: number
  /** Total frames across all sheets. */
  count: number
  intervalMs: number
  /** URL of sheet `index` (0-based). */
  sheetUrl: (index: number) => string
}

export type TrickplayFrame = { url: string; x: number; y: number }

/** The sheet and the frame's offset in it for a playback time. */
export function trickplayFrame(trickplay: Trickplay, seconds: number): TrickplayFrame {
  const frame = Math.min(trickplay.count - 1, Math.max(0, Math.floor((seconds * 1000) / trickplay.intervalMs)))
  const perSheet = trickplay.columns * trickplay.rows
  const inSheet = frame % perSheet
  return {
    url: trickplay.sheetUrl(Math.floor(frame / perSheet)),
    x: (inSheet % trickplay.columns) * trickplay.width,
    y: Math.floor(inSheet / trickplay.columns) * trickplay.height,
  }
}

/** Preferred frame width: the smallest resolution at least this wide (the tooltip shows ~200 px). */
export const TRICKPLAY_TARGET_WIDTH = 320

/** Picks a resolution from the available widths: smallest ≥ the target, otherwise the largest. */
export function pickTrickplayWidth(widths: readonly number[]): number | undefined {
  const sorted = [...widths].sort((a, b) => a - b)
  return sorted.find((w) => w >= TRICKPLAY_TARGET_WIDTH) ?? sorted.at(-1)
}
