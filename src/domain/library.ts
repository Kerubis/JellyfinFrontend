export type LibraryType =
  | 'movies'
  | 'tvshows'
  | 'music'
  | 'musicvideos'
  | 'homevideos'
  | 'boxsets'
  | 'books'
  | 'photos'
  | 'livetv'
  | 'playlists'
  | 'other'

export type Library = {
  id: string
  name: string
  type: LibraryType
  imageUrl?: string
}

const BROWSABLE: readonly LibraryType[] = ['tvshows', 'movies', 'boxsets', 'homevideos', 'other']

/** Libraries with their own header link and grid (video; music, books etc. aren't browsable here). */
export function isBrowsable(library: Library): boolean {
  return BROWSABLE.includes(library.type)
}
