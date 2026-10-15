import { useRef } from 'react'
import { Link } from 'react-router'
import { useSession, useSignedIn } from '@/api/session-context'
import { Avatar } from '@/components/Avatar'

const ITEM = 'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-800'

/** Header menu: settings, quick profile switch, add profile, sign out. */
export function ProfileMenu() {
  const { account } = useSignedIn()
  const { accounts, switchAccount, signOut } = useSession()
  const menuRef = useRef<HTMLDetailsElement>(null)
  const others = accounts.filter((a) => a.userId !== account.userId)

  function run(action: () => void) {
    menuRef.current?.removeAttribute('open')
    action()
  }

  return (
    <details ref={menuRef} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-2 py-1 hover:bg-neutral-800">
        <Avatar name={account.name} url={account.avatarUrl} />
        <span className="text-sm">{account.name}</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-52 rounded border border-neutral-800 bg-neutral-900 p-1 shadow-lg">
        <Link to="/settings" className={ITEM} onClick={() => menuRef.current?.removeAttribute('open')}>
          Settings
        </Link>
        <hr className="my-1 border-neutral-800" />
        {others.map((a) => (
          <button key={a.userId} type="button" className={ITEM} onClick={() => run(() => switchAccount(a.userId))}>
            <Avatar name={a.name} url={a.avatarUrl} />
            <span className="truncate">{a.name}</span>
            {!a.accessToken && <span className="ml-auto text-[10px] text-neutral-500">signed out</span>}
          </button>
        ))}
        <button type="button" className={ITEM} onClick={() => run(() => switchAccount(null))}>
          Switch / add profile…
        </button>
        <hr className="my-1 border-neutral-800" />
        <button type="button" className={`${ITEM} text-red-300`} onClick={() => run(() => void signOut(account.userId))}>
          Sign out
        </button>
      </div>
    </details>
  )
}
