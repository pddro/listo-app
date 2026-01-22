'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/lib/supabase';
import { List, Item } from '@/types';
import { ThemeColors } from '@/lib/gemini';

// Cached list data
export interface CachedList {
  list: List;
  items: Item[];
  fetchedAt: number;
}

// Context state
interface AppState {
  // Cached lists
  listCache: Map<string, CachedList>;

  // Theme being applied (for smooth transitions)
  activeTheme: ThemeColors | null;

  // Home theme (for instant access when navigating back)
  homeTheme: ThemeColors | null;

  // Navigation state
  currentListId: string | null;

  // Actions
  preloadList: (listId: string) => Promise<CachedList | null>;
  getCachedList: (listId: string) => CachedList | null;
  updateCache: (listId: string, data: Partial<CachedList>) => void;
  updateCachedItems: (listId: string, items: Item[]) => void;
  updateCachedList: (listId: string, list: List) => void;
  setActiveTheme: (theme: ThemeColors | null) => void;
  setHomeTheme: (theme: ThemeColors | null) => void;
  setCurrentListId: (listId: string | null) => void;
  invalidateCache: (listId: string) => void;
}

const CACHE_KEY = 'listo_list_cache';
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [listCache, setListCache] = useState<Map<string, CachedList>>(new Map());
  const [activeTheme, setActiveTheme] = useState<ThemeColors | null>(null);
  const [homeTheme, setHomeTheme] = useState<ThemeColors | null>(null);
  const [currentListId, setCurrentListId] = useState<string | null>(null);

  // Load home theme on mount for synchronous access
  useEffect(() => {
    const loadHomeTheme = async () => {
      try {
        const { value } = await Preferences.get({ key: 'listo_home_theme' });
        if (value) {
          const { theme } = JSON.parse(value);
          if (theme) setHomeTheme(theme);
        }
      } catch (error) {
        console.error('Failed to load home theme:', error);
      }
    };
    loadHomeTheme();
  }, []);

  // Use ref to avoid stale closures
  const cacheRef = useRef<Map<string, CachedList>>(listCache);
  useEffect(() => {
    cacheRef.current = listCache;
  }, [listCache]);

  // Load cache from storage on mount
  useEffect(() => {
    const loadCache = async () => {
      try {
        const { value } = await Preferences.get({ key: CACHE_KEY });
        if (value) {
          const parsed = JSON.parse(value);
          // Convert array back to Map
          const map = new Map<string, CachedList>(Object.entries(parsed));
          // Filter out stale entries
          const now = Date.now();
          map.forEach((cached, key) => {
            if (now - cached.fetchedAt > CACHE_MAX_AGE) {
              map.delete(key);
            }
          });
          setListCache(map);
          cacheRef.current = map;
        }
      } catch (error) {
        console.error('Failed to load list cache:', error);
      }
    };
    loadCache();
  }, []);

  // Save cache to storage (debounced)
  const saveCacheTimeout = useRef<NodeJS.Timeout | null>(null);
  const saveCache = useCallback((cache: Map<string, CachedList>) => {
    if (saveCacheTimeout.current) {
      clearTimeout(saveCacheTimeout.current);
    }
    saveCacheTimeout.current = setTimeout(async () => {
      try {
        // Convert Map to object for JSON serialization
        const obj = Object.fromEntries(cache);
        await Preferences.set({
          key: CACHE_KEY,
          value: JSON.stringify(obj),
        });
      } catch (error) {
        console.error('Failed to save list cache:', error);
      }
    }, 500);
  }, []);

  // Get cached list
  const getCachedList = useCallback((listId: string): CachedList | null => {
    const cached = cacheRef.current.get(listId);
    if (!cached) return null;

    // Check if cache is stale
    if (Date.now() - cached.fetchedAt > CACHE_MAX_AGE) {
      return null;
    }

    return cached;
  }, []);

  // Preload a list into cache
  const preloadList = useCallback(async (listId: string): Promise<CachedList | null> => {
    // Check if already cached and fresh
    const cached = getCachedList(listId);
    if (cached) {
      return cached;
    }

    try {
      // Fetch list and items in parallel
      const [listResult, itemsResult] = await Promise.all([
        supabase.from('lists').select('*').eq('id', listId).single(),
        supabase.from('items').select('*').eq('list_id', listId).order('position'),
      ]);

      if (listResult.error && listResult.error.code !== 'PGRST116') {
        console.error('Failed to preload list:', listResult.error);
        return null;
      }

      const cachedData: CachedList = {
        list: listResult.data || {
          id: listId,
          title: null,
          theme: null,
          large_mode: null,
          emojify_mode: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        items: itemsResult.data || [],
        fetchedAt: Date.now(),
      };

      // Update cache
      setListCache(prev => {
        const next = new Map(prev);
        next.set(listId, cachedData);
        saveCache(next);
        return next;
      });

      return cachedData;
    } catch (error) {
      console.error('Failed to preload list:', error);
      return null;
    }
  }, [getCachedList, saveCache]);

  // Update cache entry
  const updateCache = useCallback((listId: string, data: Partial<CachedList>) => {
    setListCache(prev => {
      const next = new Map(prev);
      const existing = next.get(listId);
      if (existing) {
        next.set(listId, { ...existing, ...data, fetchedAt: Date.now() });
      }
      saveCache(next);
      return next;
    });
  }, [saveCache]);

  // Update cached items for a list
  const updateCachedItems = useCallback((listId: string, items: Item[]) => {
    setListCache(prev => {
      const next = new Map(prev);
      const existing = next.get(listId);
      if (existing) {
        next.set(listId, { ...existing, items, fetchedAt: Date.now() });
        saveCache(next);
      }
      return next;
    });
  }, [saveCache]);

  // Update cached list metadata
  const updateCachedList = useCallback((listId: string, list: List) => {
    setListCache(prev => {
      const next = new Map(prev);
      const existing = next.get(listId);
      if (existing) {
        next.set(listId, { ...existing, list, fetchedAt: Date.now() });
        saveCache(next);
      }
      return next;
    });
  }, [saveCache]);

  // Invalidate cache entry
  const invalidateCache = useCallback((listId: string) => {
    setListCache(prev => {
      const next = new Map(prev);
      next.delete(listId);
      saveCache(next);
      return next;
    });
  }, [saveCache]);

  const value: AppState = {
    listCache,
    activeTheme,
    homeTheme,
    currentListId,
    preloadList,
    getCachedList,
    updateCache,
    updateCachedItems,
    updateCachedList,
    setActiveTheme,
    setHomeTheme,
    setCurrentListId,
    invalidateCache,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
