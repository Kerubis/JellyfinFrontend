import type { AuthenticationResult, BaseItemDto, UserDto } from '@jellyfin/sdk/lib/generated-client/models'
import type { Account, Server, SignedInAccount, User } from '@/domain/auth'
import type { Library, LibraryType } from '@/domain/library'
import type { Episode, Series } from '@/domain/media'
import { itemImageUrl, userImageUrl } from './client'

const LIBRARY_TYPES: ReadonlySet<string> = new Set<LibraryType>([
  'movies', 'tvshows', 'music', 'musicvideos', 'homevideos', 'boxsets', 'books', 'photos', 'livetv', 'playlists',
])

export function toUser(server: Server, dto: UserDto): User {
  const id = dto.Id ?? ''
  return {
    id,
    name: dto.Name ?? 'Unknown',
    hasPassword: dto.HasPassword ?? true,
    avatarUrl: userImageUrl(server.url, id, dto.PrimaryImageTag),
  }
}

export function toAccount(server: Server, result: AuthenticationResult): SignedInAccount {
  if (!result.AccessToken || !result.User?.Id) throw new Error('Server returned no access token')
  const user = toUser(server, result.User)
  return {
    serverId: server.id,
    userId: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    accessToken: result.AccessToken,
  } satisfies Account
}

export function toLibrary(server: Server, dto: BaseItemDto): Library {
  const id = dto.Id ?? ''
  const type = dto.CollectionType && LIBRARY_TYPES.has(dto.CollectionType) ? (dto.CollectionType as LibraryType) : 'other'
  return {
    id,
    name: dto.Name ?? 'Untitled',
    type,
    imageUrl: itemImageUrl(server.url, id, dto.ImageTags?.Primary, { maxWidth: 400 }),
  }
}

export function toSeries(server: Server, dto: BaseItemDto): Series {
  const id = dto.Id ?? ''
  return {
    id,
    name: dto.Name ?? 'Untitled',
    year: dto.ProductionYear ?? undefined,
    posterUrl: itemImageUrl(server.url, id, dto.ImageTags?.Primary, { maxWidth: 300 }),
    unplayedCount: dto.UserData?.UnplayedItemCount ?? 0,
    isFavorite: dto.UserData?.IsFavorite ?? false,
  }
}

export function toEpisode(server: Server, dto: BaseItemDto): Episode {
  const id = dto.Id ?? ''
  return {
    id,
    name: dto.Name ?? 'Untitled',
    seriesId: dto.SeriesId ?? undefined,
    seriesName: dto.SeriesName ?? undefined,
    seasonNumber: dto.ParentIndexNumber ?? undefined,
    episodeNumber: dto.IndexNumber ?? undefined,
    dateCreated: dto.DateCreated ?? undefined,
    played: dto.UserData?.Played ?? false,
    positionTicks: dto.UserData?.PlaybackPositionTicks ?? 0,
    runtimeTicks: dto.RunTimeTicks ?? undefined,
    thumbUrl: itemImageUrl(server.url, id, dto.ImageTags?.Primary, { maxWidth: 400 }),
  }
}
