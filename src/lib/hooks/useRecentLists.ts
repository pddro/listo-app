'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';

export interface SavedList {
  id: string;
  title: string | null;
  themeColor: string | null; // primary color from theme
  createdAt: string;
  archived: boolean;
}

const STORAGE_KEY = 'listo_saved_lists';

export function useRecentLists() {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const listsRef = useRef<SavedList[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  // Load lists from storage on mount
  useEffect(() => {
    const loadLists = async () => {
      try {
        const { value } = await Preferences.get({ key: STORAGE_KEY });
        if (value) {
          const parsed = JSON.parse(value);
          setLists(parsed);
          listsRef.current = parsed;
        }
      } catch (error) {
        console.error('Failed to load saved lists:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLists();
  }, []);

  // Save lists to storage
  const saveLists = useCallback(async (newLists: SavedList[]) => {
    try {
      await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(newLists),
      });
      setLists(newLists);
      listsRef.current = newLists;
    } catch (error) {
      console.error('Failed to save lists:', error);
    }
  }, []);

  // Add a new list (called when user creates a list)
  const addList = useCallback(async (id: string, title: string | null = null, themeColor: string | null = null) => {
    // Use ref to get current lists (avoids stale closure)
    const currentLists = listsRef.current;

    // Don't add if already exists
    const exists = currentLists.some(list => list.id === id);
    if (exists) return;

    const newList: SavedList = {
      id,
      title,
      themeColor,
      createdAt: new Date().toISOString(),
      archived: false,
    };

    await saveLists([newList, ...currentLists]);
  }, [saveLists]);

  // Update list metadata (title, theme color)
  const updateList = useCallback(async (id: string, updates: Partial<Pick<SavedList, 'title' | 'themeColor'>>) => {
    const currentLists = listsRef.current;
    const newLists = currentLists.map(list =>
      list.id === id ? { ...list, ...updates } : list
    );
    await saveLists(newLists);
  }, [saveLists]);

  // Archive a list (soft delete)
  const archiveList = useCallback(async (id: string) => {
    const currentLists = listsRef.current;
    const newLists = currentLists.map(list =>
      list.id === id ? { ...list, archived: true } : list
    );
    await saveLists(newLists);
  }, [saveLists]);

  // Restore a list from archive
  const restoreList = useCallback(async (id: string) => {
    const currentLists = listsRef.current;
    const newLists = currentLists.map(list =>
      list.id === id ? { ...list, archived: false } : list
    );
    await saveLists(newLists);
  }, [saveLists]);

  // Permanently delete a list
  const deleteList = useCallback(async (id: string) => {
    const currentLists = listsRef.current;
    const newLists = currentLists.filter(list => list.id !== id);
    await saveLists(newLists);
  }, [saveLists]);

  // Get active (non-archived) lists
  const activeLists = lists.filter(list => !list.archived);

  // Get archived lists
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
