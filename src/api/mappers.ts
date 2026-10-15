import type { AuthenticationResult, BaseItemDto, UserDto } from '@jellyfin/sdk/lib/generated-client/models'
import type { Account, Server, SignedInAccount, User } from '@/domain/auth'
import type { Library, LibraryType } from '@/domain/library'
import type { EpisodeRef, MediaItem, MediaKind } from '@/domain/media'
import type { EpisodeDetails, Season, SeriesDetails } from '@/domain/series'
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

const KINDS: Partial<Record<string, MediaKind>> = {
  Series: 'series',
  Season: 'season',
  Episode: 'episode',
  Movie: 'movie',
}

const POSTER_WIDTH = 300
const THUMB_WIDTH = 480

/** Series thumb or backdrop: a 16:9 image that never shows episode content. */
function parentThumbUrl(server: Server, dto: BaseItemDto): string | undefined {
  if (dto.ParentThumbItemId && dto.ParentThumbImageTag) {
    return itemImageUrl(server.url, dto.ParentThumbItemId, dto.ParentThumbImageTag, { type: 'Thumb', maxWidth: THUMB_WIDTH })
  }
  if (dto.ParentBackdropItemId && dto.ParentBackdropImageTags?.[0]) {
    return itemImageUrl(server.url, dto.ParentBackdropItemId, dto.ParentBackdropImageTags[0], {
      type: 'Backdrop',
      maxWidth: THUMB_WIDTH,
    })
  }
  return undefined
}

function ownThumbUrl(server: Server, id: string, dto: BaseItemDto): string | undefined {
  return (
    itemImageUrl(server.url, id, dto.ImageTags?.Thumb, { type: 'Thumb', maxWidth: THUMB_WIDTH }) ??
    itemImageUrl(server.url, id, dto.BackdropImageTags?.[0], { type: 'Backdrop', maxWidth: THUMB_WIDTH })
  )
}

export function toMediaItem(server: Server, dto: BaseItemDto): MediaItem {
  const id = dto.Id ?? ''
  const kind = (dto.Type && KINDS[dto.Type]) ?? 'other'
  const ownPoster = itemImageUrl(server.url, id, dto.ImageTags?.Primary, { maxWidth: POSTER_WIDTH })
  const seriesPoster = dto.SeriesId
    ? itemImageUrl(server.url, dto.SeriesId, dto.SeriesPrimaryImageTag, { maxWidth: POSTER_WIDTH })
    : undefined
  const position = dto.UserData?.PlaybackPositionTicks ?? 0
  const percent = dto.UserData?.PlayedPercentage

  const base: MediaItem = {
    id,
    kind,
    name: dto.Name ?? 'Untitled',
    seriesId: dto.SeriesId ?? undefined,
    seriesName: dto.SeriesName ?? undefined,
    year: dto.ProductionYear ?? undefined,
    dateCreated: dto.DateCreated ?? undefined,
    progress: position > 0 && percent ? percent / 100 : undefined,
    lastPlayedAt: dto.UserData?.LastPlayedDate ?? undefined,
  }

  if (kind === 'episode') {
    const still = itemImageUrl(server.url, id, dto.ImageTags?.Primary, { maxWidth: THUMB_WIDTH })
    const spoilerFree = parentThumbUrl(server, dto)
    return {
      ...base,
      seasonNumber: dto.ParentIndexNumber ?? undefined,
      episodeNumber: dto.IndexNumber ?? undefined,
      posterUrl: seriesPoster,
      thumbUrl: still ?? spoilerFree,
      spoilerFreeThumbUrl: spoilerFree ?? seriesPoster,
    }
  }
  if (kind === 'season') {
    return { ...base, seasonNumber: dto.IndexNumber ?? undefined, posterUrl: ownPoster ?? seriesPoster, thumbUrl: parentThumbUrl(server, dto) }
  }
  const thumb = ownThumbUrl(server, id, dto)
  return { ...base, posterUrl: ownPoster, thumbUrl: thumb, spoilerFreeThumbUrl: thumb }
}

export function toEpisodeRef(dto: BaseItemDto): EpisodeRef | null {
  if (!dto.Id || !dto.SeriesId) return null
  return {
    id: dto.Id,
    name: dto.Name ?? 'Untitled',
    seriesId: dto.SeriesId,
    seasonNumber: dto.ParentIndexNumber ?? undefined,
    episodeNumber: dto.IndexNumber ?? undefined,
    premiereDate: dto.PremiereDate ?? undefined,
    dateCreated: dto.DateCreated ?? undefined,
  }
}

export function toSeriesDetails(server: Server, dto: BaseItemDto): SeriesDetails {
  const id = dto.Id ?? ''
  const status = dto.Status === 'Continuing' ? 'continuing' : dto.Status === 'Ended' ? 'ended' : undefined
  return {
    id,
    name: dto.Name ?? 'Untitled',
    year: dto.ProductionYear ?? undefined,
    endYear: dto.EndDate ? new Date(dto.EndDate).getFullYear() : undefined,
    status,
    overview: dto.Overview ?? undefined,
    posterUrl: itemImageUrl(server.url, id, dto.ImageTags?.Primary, { maxWidth: POSTER_WIDTH }),
    genres: dto.Genres ?? [],
    communityRating: dto.CommunityRating ?? undefined,
    officialRating: dto.OfficialRating ?? undefined,
  }
}

export function toSeason(server: Server, dto: BaseItemDto): Season {
  const id = dto.Id ?? ''
  return {
    id,
    name: dto.Name ?? 'Season',
    number: dto.IndexNumber ?? undefined,
    posterUrl: itemImageUrl(server.url, id, dto.ImageTags?.Primary, { maxWidth: POSTER_WIDTH }),
  }
}

export function toEpisodeDetails(server: Server, dto: BaseItemDto): EpisodeDetails | null {
  const ref = toEpisodeRef(dto)
  if (!ref) return null
  return {
    ...ref,
    overview: dto.Overview ?? undefined,
    runtimeTicks: dto.RunTimeTicks ?? undefined,
    stillUrl: itemImageUrl(server.url, ref.id, dto.ImageTags?.Primary, { maxWidth: 400 }),
    positionTicks: dto.UserData?.PlaybackPositionTicks ?? 0,
  }
}
