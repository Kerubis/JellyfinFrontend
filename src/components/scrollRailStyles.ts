// Shared look of the custom scrollbars (page, side panes) and the library A–Z rail.

/** Rail look: dark translucent background with a thin left border. Position comes from the caller. */
export const RAIL_LOOK = 'w-5 touch-none select-none border-l border-neutral-800 bg-neutral-900/90 backdrop-blur'

/** The page rail: right edge below the sticky header. */
export const RAIL_CLASS = `fixed top-11 right-0 bottom-0 z-[5] ${RAIL_LOOK}`

/** The thumb: light Jellyfin gradient (violet → blue, top to bottom). */
export const THUMB_CLASS = 'absolute inset-x-0.5 rounded-full bg-gradient-to-b from-[#AA5CC3]/45 to-[#00A4DC]/45'
