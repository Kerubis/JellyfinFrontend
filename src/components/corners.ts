// Image corner slots, the same everywhere (home cards, season posters, episode stills):
//   top-left: unwatched count · bottom-left: NEW / NEXT marker · top-right: watched toggle · bottom-right: ⋯ menu

export type Corner = 'tl' | 'tr' | 'bl' | 'br'

/** Flush with the image corner; the outer corner matches the image's rounding, the inner one is rounder. */
export const CORNER: Record<Corner, string> = {
  tl: 'top-0 left-0 rounded-tl rounded-br-lg',
  tr: 'top-0 right-0 rounded-tr rounded-bl-lg',
  bl: 'bottom-0 left-0 rounded-bl rounded-tr-lg',
  br: 'bottom-0 right-0 rounded-br rounded-tl-lg',
}
