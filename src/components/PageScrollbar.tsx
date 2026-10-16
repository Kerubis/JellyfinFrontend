import { ScrollRail } from './ScrollRail'
import { RAIL_CLASS } from './scrollRailStyles'

/** Custom scrollbar for the window, styled like the library A–Z rail (Layout hides the native one). */
export function PageScrollbar() {
  return <ScrollRail target="window" className={RAIL_CLASS} />
}
