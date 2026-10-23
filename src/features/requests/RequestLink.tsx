import { NavLink } from 'react-router'
import { useSeerrConfig } from '@/api/seerr'
import { headerLinkClass } from '@/components/headerLink'

/** Header link to the request page; only when an admin set up Seerr for this profile. */
export function RequestLink() {
  if (!useSeerrConfig()) return null
  return (
    <NavLink to="/requests" className={(state) => `${headerLinkClass(state)} self-stretch`}>
      Request
    </NavLink>
  )
}
