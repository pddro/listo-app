'use client';

import { useState, useEffect, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { getListIds, addListId, removeListId, migrateListIds } from '@/lib/listIdStore';

export interface SavedList {
  id: string;
  title: string | null;
  themeColor: string | null;
  themeTextColor: string | null;
  createdAt: string;
  archived: boolean;
  itemCount?: number;
  completedCount?: number;
}

const METADATA_KEY = 'listo_list_metadata_v3';
const OLD_STORAGE_KEY = 'listo_saved_lists';

/**
 * Get metadata for all lists (keyed by ID)
 */
async function getMetadata(): Promise<Record<string, SavedList>> {
  try {
    const { value } = await Preferences.get({ key: METADATA_KEY });
    if (value) {
      return JSON.parse(value);
    }
  } catch (e) {
    console.error('[Metadata] GET failed:', e);
  }
  return {};
}

/**
 * Save metadata for a single list
 */
async function saveMetadata(id: string, data: SavedList): Promise<void> {
  try {
    const current = await getMetadata();
    current[id] = data;
    await Preferences.set({ key: METADATA_KEY, value: JSON.stringify(current) });
  } catch (e) {
    console.error('[Metadata] SAVE failed:', e);
  }
}

/**
 * Delete metadata for a single list
 */
async function deleteMetadata(id: string): Promise<void> {
  try {
    const current = await getMetadata();
    delete current[id];
    await Preferences.set({ key: METADATA_KEY, value: JSON.stringify(current) });
  } catch (e) {
    console.error('[Metadata] DELETE failed:', e);
  }
}

/**
 * Build full list from IDs + metadata
 */
async function buildLists(): Promise<SavedList[]> {
  const ids = await getListIds();
  const metadata = await getMetadata();

  return ids.map(id => {
    if (metadata[id]) {
      return metadata[id];
    }
    return {
      id,
      title: null,
      themeColor: null,
      themeTextColor: null,
      createdAt: new Date().toISOString(),
      archived: false,
    };
  });
}

export function useRecentLists() {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load lists from storage
  const loadLists = useCallback(async () => {
    const loaded = await buildLists();
    setLists(loaded);
    setIsLoading(false);
  }, []);

  // Initial load + migration
  useEffect(() => {
    const init = async () => {
      // Check for migration from old format
      const currentIds = await getListIds();

      if (currentIds.length === 0) {
        try {
          const { value } = await Preferences.get({ key: OLD_STORAGE_KEY });
          if (value) {
            const oldLists: SavedList[] = JSON.parse(value);
            if (oldLists.length > 0) {
              // Migrate IDs
              await migrateListIds(oldLists.map(l => l.id));
              // Migrate metadata
              const metadataMap: Record<string, SavedList> = {};
              for (const list of oldLists) {
                metadataMap[list.id] = list;
              }
              await Preferences.set({ key: METADATA_KEY, value: JSON.stringify(metadataMap) });
            }
          }
        } catch (e) {
          console.error('[useRecentLists] Migration failed:', e);
        }
      }

      await loadLists();
    };

    init();
  }, [loadLists]);

  // Add a list
  const addList = useCallback(async (
    id: string,
    title: string | null = null,
    themeColor: string | null = null,
    themeTextColor: string | null = null
  ) => {
    // Add ID to storage
    await addListId(id);

    // Save metadata
    await saveMetadata(id, {
      id,
      title,
      themeColor,
      themeTextColor,
      createdAt: new Date().toISOString(),
      archived: false,
    });

    // Reload to update UI
    await loadLists();
  }, [loadLists]);

  // Update list metadata
  const updateList = useCallback(async (
    id: string,
    updates: Partial<Pick<SavedList, 'title' | 'themeColor' | 'themeTextColor' | 'itemCount' | 'completedCount'>>
  ) => {
    const metadata = await getMetadata();
    const current = metadata[id];
    if (!current) {
      return;
    }

    await saveMetadata(id, { ...current, ...updates });
    await loadLists();
  }, [loadLists]);

  // Archive a list
  const archiveList = useCallback(async (id: string) => {
    const metadata = await getMetadata();
    const current = metadata[id];
    if (!current) return;

    await saveMetadata(id, { ...current, archived: true });
    await loadLists();
  }, [loadLists]);

  // Restore a list
  const restoreList = useCallback(async (id: string) => {
    const metadata = await getMetadata();
    const current = metadata[id];
    if (!current) return;

    await saveMetadata(id, { ...current, archived: false });
    await loadLists();
  }, [loadLists]);

  // Delete a list
  const deleteList = useCallback(async (id: string) => {
    await removeListId(id);
    await deleteMetadata(id);
    await loadLists();
  }, [loadLists]);

  // Filter lists
  const activeLists = lists.filter(list => !list.archived);
  const archivedLists = lists.filter(list => list.archived);

  return {
    lists: activeLists,
    archivedLists,
    isLoading,
    addList,
    updateList,
    archiveList,
    restoreList,
    deleteList,
  };
}
