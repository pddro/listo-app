'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface SavedList {
  id: string;
  title: string | null;
  themeColor: string | null;
  themeTextColor: string | null;
  completedCount: number;
  totalCount: number;
  createdAt: string;
  archived: boolean;
}

const STORAGE_KEY = 'listo_saved_lists';

export function useRecentListsWeb() {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const listsRef = useRef<SavedList[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  // Load lists from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setLists(parsed);
        listsRef.current = parsed;
      }
    } catch (error) {
      console.error('Failed to load saved lists:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save lists to localStorage
  const saveLists = useCallback((newLists: SavedList[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLists));
      setLists(newLists);
      listsRef.current = newLists;
    } catch (error) {
      console.error('Failed to save lists:', error);
    }
  }, []);

  // Add a new list
  const addList = useCallback((id: string, title: string | null = null, themeColor: string | null = null) => {
    const currentLists = listsRef.current;
    const exists = currentLists.some(list => list.id === id);
    if (exists) return;

    const newList: SavedList = {
      id,
      title,
      themeColor,
      themeTextColor: null,
      completedCount: 0,
      totalCount: 0,
      createdAt: new Date().toISOString(),
      archived: false,
    };

    saveLists([newList, ...currentLists]);
  }, [saveLists]);

  // Update list metadata
  const updateList = useCallback((id: string, updates: Partial<Pick<SavedList, 'title' | 'themeColor' | 'themeTextColor' | 'completedCount' | 'totalCount'>>) => {
    const currentLists = listsRef.current;
    const newLists = currentLists.map(list =>
      list.id === id ? { ...list, ...updates } : list
    );
    saveLists(newLists);
  }, [saveLists]);

  // Archive a list
  const archiveList = useCallback((id: string) => {
    const currentLists = listsRef.current;
    const newLists = currentLists.map(list =>
      list.id === id ? { ...list, archived: true } : list
    );
    saveLists(newLists);
  }, [saveLists]);

  // Restore a list
  const restoreList = useCallback((id: string) => {
    const currentLists = listsRef.current;
    const newLists = currentLists.map(list =>
      list.id === id ? { ...list, archived: false } : list
    );
    saveLists(newLists);
  }, [saveLists]);

  // Delete a list
  const deleteList = useCallback((id: string) => {
    const currentLists = listsRef.current;
    const newLists = currentLists.filter(list => list.id !== id);
    saveLists(newLists);
  }, [saveLists]);

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
