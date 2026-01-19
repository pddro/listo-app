import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

interface UseAppLifecycleOptions {
  onForeground?: () => void;
  onBackground?: () => void;
}

/**
 * Hook to handle app lifecycle events (foreground/background)
 * Works on both native (Capacitor) and web (visibility API)
 */
export function useAppLifecycle({ onForeground, onBackground }: UseAppLifecycleOptions) {
  const onForegroundRef = useRef(onForeground);
  const onBackgroundRef = useRef(onBackground);

  // Keep refs up to date
  useEffect(() => {
    onForegroundRef.current = onForeground;
    onBackgroundRef.current = onBackground;
  }, [onForeground, onBackground]);

  const handleStateChange = useCallback((isActive: boolean) => {
    if (isActive) {
      onForegroundRef.current?.();
    } else {
      onBackgroundRef.current?.();
    }
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Native: use Capacitor App plugin
      const listener = App.addListener('appStateChange', ({ isActive }) => {
        handleStateChange(isActive);
      });

      return () => {
        listener.then(l => l.remove());
      };
    } else {
      // Web: use Page Visibility API
      const handleVisibilityChange = () => {
        handleStateChange(!document.hidden);
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [handleStateChange]);
}

/**
 * Hook to handle app URL open events (deep linking)
 */
export function useAppUrlOpen(callback: (url: string) => void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = App.addListener('appUrlOpen', ({ url }) => {
      callbackRef.current(url);
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);
}
