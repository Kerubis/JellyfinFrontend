import { NavLink } from 'react-router'
import { useScheduleToken } from '@/api/schedule'
import { headerLinkClass } from '@/components/headerLink'

/** Header link to the airing schedule; only when the profile has an AnimeSchedule token. */
export function ScheduleLink() {
  if (useScheduleToken() === '') return null
  return (
    <NavLink to="/schedule" className={(state) => `${headerLinkClass(state)} self-stretch`}>
      Schedule
    </NavLink>
  )
}
