export interface SidebarItem {
  id: string;
  title: string;
  type: 'folder' | 'file';
  children?: SidebarItem[];
}

interface SidebarSearchResult {
  id: string;
}

export function ensureFolderExpanded(expandedFolders: Set<string>, folderId: string) {
  if (expandedFolders.has(folderId)) return expandedFolders;

  const next = new Set(expandedFolders);
  next.add(folderId);
  return next;
}

export function filterSidebarItems(
  sidebarItems: SidebarItem[],
  searchQuery: string,
  searchResults: SidebarSearchResult[]
) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return sidebarItems;

  const matchedMeetingIds = new Set(searchResults.map((result) => result.id));
  const hasTranscriptResults = searchResults.length > 0;

  return sidebarItems
    .map((item) => {
      if (item.type !== 'folder') {
        return matchedMeetingIds.has(item.id) || item.title.toLowerCase().includes(query) ? item : undefined;
      }

      if (!item.children) return item;

      const children = item.children.filter((child) => {
        if (hasTranscriptResults && matchedMeetingIds.has(child.id)) return true;
        return child.title.toLowerCase().includes(query);
      });

      return { ...item, children };
    })
    .filter((item): item is SidebarItem => item !== undefined);
}
