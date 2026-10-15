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
