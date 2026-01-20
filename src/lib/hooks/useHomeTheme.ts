'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import { ThemeColors } from '@/lib/gemini';

export interface HomeThemeData {
  theme: ThemeColors | null;
  description: string | null;
}

const STORAGE_KEY = 'listo_home_theme';

export function useHomeTheme() {
  const [theme, setTheme] = useState<ThemeColors | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const themeRef = useRef<HomeThemeData>({ theme: null, description: null });

  // Keep ref in sync with state
  useEffect(() => {
    themeRef.current = { theme, description };
  }, [theme, description]);

  // Load theme from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const { value } = await Preferences.get({ key: STORAGE_KEY });
        if (value) {
          const parsed: HomeThemeData = JSON.parse(value);
          setTheme(parsed.theme);
          setDescription(parsed.description);
          themeRef.current = parsed;
        }
      } catch (error) {
        console.error('Failed to load home theme:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTheme();
  }, []);

  // Save home theme
  const setHomeTheme = useCallback(async (newTheme: ThemeColors, newDescription: string) => {
    try {
      const data: HomeThemeData = { theme: newTheme, description: newDescription };
      await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(data),
      });
      setTheme(newTheme);
      setDescription(newDescription);
      themeRef.current = data;
    } catch (error) {
      console.error('Failed to save home theme:', error);
    }
  }, []);

  // Clear home theme
  const clearHomeTheme = useCallback(async () => {
    try {
      await Preferences.remove({ key: STORAGE_KEY });
      setTheme(null);
      setDescription(null);
      themeRef.current = { theme: null, description: null };
    } catch (error) {
      console.error('Failed to clear home theme:', error);
    }
  }, []);

  return {
    theme,
    description,
    isLoading,
    setHomeTheme,
    clearHomeTheme,
  };
}
