type Props = { name: string; url?: string; size?: 'sm' | 'lg' }

export function Avatar({ name, url, size = 'sm' }: Props) {
  const box = size === 'lg' ? 'size-16 text-2xl' : 'size-7 text-xs'
  if (url) return <img src={url} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
  return (
    <span
      aria-hidden
      className={`${box} flex shrink-0 items-center justify-center rounded-full bg-violet-700 font-semibold text-white`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
