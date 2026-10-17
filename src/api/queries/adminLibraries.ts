import type { CollectionTypeOptions, LibraryOptions, VirtualFolderInfo } from '@jellyfin/sdk/lib/generated-client/models'
import { getEnvironmentApi, getLibraryStructureApi } from '@jellyfin/sdk/lib/utils/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminLibrary, FolderEntry, LibraryKind, LibrarySettings } from '@/domain/admin'
import { apiFor } from '../client'
import { useSignedIn } from '../session-context'

// Library management (admins). Changes refresh our library lists too (header links, filters, access lists).

function toSettings(o: LibraryOptions | undefined): LibrarySettings {
  return {
    realtimeMonitor: o?.EnableRealtimeMonitor ?? true,
    saveLocalMetadata: o?.SaveLocalMetadata ?? false,
    metadataLanguage: o?.PreferredMetadataLanguage ?? '',
    metadataCountry: o?.MetadataCountryCode ?? '',
    refreshDays: o?.AutomaticRefreshIntervalDays ?? 0,
    trickplay: o?.EnableTrickplayImageExtraction ?? false,
    trickplayDuringScan: o?.ExtractTrickplayImagesDuringLibraryScan ?? false,
    chapterImages: o?.EnableChapterImageExtraction ?? false,
    chapterImagesDuringScan: o?.ExtractChapterImagesDuringLibraryScan ?? false,
    embeddedTitles: o?.EnableEmbeddedTitles ?? false,
  }
}

function applySettings(o: LibraryOptions, s: LibrarySettings): LibraryOptions {
  return {
    ...o,
    EnableRealtimeMonitor: s.realtimeMonitor,
    SaveLocalMetadata: s.saveLocalMetadata,
    PreferredMetadataLanguage: s.metadataLanguage || null,
    MetadataCountryCode: s.metadataCountry || null,
    AutomaticRefreshIntervalDays: s.refreshDays,
    EnableTrickplayImageExtraction: s.trickplay,
    ExtractTrickplayImagesDuringLibraryScan: s.trickplay && s.trickplayDuringScan,
    EnableChapterImageExtraction: s.chapterImages,
    ExtractChapterImagesDuringLibraryScan: s.chapterImages && s.chapterImagesDuringScan,
    EnableEmbeddedTitles: s.embeddedTitles,
  }
}

function toLibrary(dto: VirtualFolderInfo): AdminLibrary {
  return {
    id: dto.ItemId ?? '',
    name: dto.Name ?? 'Library',
    kind: dto.CollectionType ?? undefined,
    paths: dto.Locations ?? [],
    refreshing: dto.RefreshStatus === 'Active',
    settings: toSettings(dto.LibraryOptions),
  }
}

function useLibraryApi() {
  const { server, account } = useSignedIn()
  const queryClient = useQueryClient()
  const api = apiFor(server.url, account.accessToken)
  const key = ['user', account.userId, 'admin', 'libraries'] as const
  const changed = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: ['user', account.userId, 'libraries'] }),
      queryClient.invalidateQueries({ queryKey: ['server', server.id, 'mediaFolders'] }),
    ])
  return { api, key, changed }
}

export function useAdminLibraries() {
  const { api, key } = useLibraryApi()
  return useQuery({
    queryKey: key,
    staleTime: 30_000,
    queryFn: async () => (await getLibraryStructureApi(api).getVirtualFolders()).data.map(toLibrary),
  })
}

export function useAddLibrary() {
  const { api, changed } = useLibraryApi()
  return useMutation({
    mutationFn: ({ name, kind, path }: { name: string; kind: LibraryKind; path: string }) =>
      getLibraryStructureApi(api).addVirtualFolder({
        name: name.trim(),
        // Jellyfin stores "mixed" as no collection type.
        collectionType: kind === 'mixed' ? undefined : (kind as CollectionTypeOptions),
        refreshLibrary: true,
        addVirtualFolderDto: { LibraryOptions: { PathInfos: [{ Path: path }], EnableRealtimeMonitor: true } },
      }),
    onSuccess: changed,
  })
}

export function useRemoveLibrary() {
  const { api, changed } = useLibraryApi()
  return useMutation({
    mutationFn: (name: string) => getLibraryStructureApi(api).removeVirtualFolder({ name, refreshLibrary: true }),
    onSuccess: changed,
  })
}

export function useRenameLibrary() {
  const { api, changed } = useLibraryApi()
  return useMutation({
    mutationFn: ({ name, newName }: { name: string; newName: string }) =>
      getLibraryStructureApi(api).renameVirtualFolder({ name, newName: newName.trim(), refreshLibrary: false }),
    onSuccess: changed,
  })
}

/** Adds or removes one folder of a library; the library is rescanned afterwards. */
export function useLibraryFolder() {
  const { api, changed } = useLibraryApi()
  return useMutation({
    mutationFn: ({ library, path, action }: { library: string; path: string; action: 'add' | 'remove' }) =>
      action === 'add'
        ? getLibraryStructureApi(api).addMediaPath({ mediaPathDto: { Name: library, PathInfo: { Path: path } }, refreshLibrary: true })
        : getLibraryStructureApi(api).removeMediaPath({ name: library, path, refreshLibrary: true }),
    onSuccess: changed,
  })
}

/** Saves the edited options; the rest of the library's options are read fresh and kept. */
export function useSaveLibrarySettings() {
  const { api, changed } = useLibraryApi()
  return useMutation({
    mutationFn: async ({ id, settings }: { id: string; settings: LibrarySettings }) => {
      const structure = getLibraryStructureApi(api)
      const current = (await structure.getVirtualFolders()).data.find((f) => f.ItemId === id)
      if (!current?.LibraryOptions) throw new Error('Library not found on the server.')
      await structure.updateLibraryOptions({ updateLibraryOptionsDto: { Id: id, LibraryOptions: applySettings(current.LibraryOptions, settings) } })
    },
    onSuccess: changed,
  })
}

/** Folders on the server for the folder picker: the drives at the root, otherwise the subfolders of `path`. */
export function useServerFolders(path: string | null) {
  const { api } = useLibraryApi()
  return useQuery({
    queryKey: ['admin', 'folders', path],
    staleTime: 30_000,
    queryFn: async (): Promise<FolderEntry[]> => {
      const env = getEnvironmentApi(api)
      const { data } = path === null ? await env.getDrives() : await env.getDirectoryContents({ path, includeDirectories: true, includeFiles: false })
      return data
        .filter((f) => f.Path && f.Type === 'Directory')
        .map((f) => ({ name: f.Name ?? f.Path ?? '', path: f.Path ?? '' }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  })
}
