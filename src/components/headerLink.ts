// Full header height. Active: the blue of the page's background glow; hover: the light-blue ring used on tiles.
export const headerLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center px-3 text-sm font-bold whitespace-nowrap ring-accent-400 ring-inset transition hover:ring-2 focus-visible:ring-2 focus-visible:outline-none ${
    isActive ? 'bg-[#00A4DC]/22 text-white' : 'text-neutral-400 hover:text-neutral-100'
  }`
