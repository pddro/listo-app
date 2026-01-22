import { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

export const GA_MEASUREMENT_ID = "G-3N0JE969VW";

const isNative = Capacitor.isNativePlatform();

// Dynamically import Firebase Analytics only on native
let FirebaseAnalytics: typeof import('@capacitor-firebase/analytics').FirebaseAnalytics | null = null;
if (isNative) {
  import('@capacitor-firebase/analytics').then((module) => {
    FirebaseAnalytics = module.FirebaseAnalytics;
  });
}

// Track custom events (web only - gtag)
export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number
) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Track page views (for client-side navigation)
export const trackPageView = (url: string) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// Unified analytics helper - works on both web and native
export const analytics = {
  // Track when a list is created
  listCreated: async (method: 'manual' | 'ai' | 'dictation' | 'tutorial' = 'manual') => {
    if (isNative && FirebaseAnalytics) {
      try {
        await FirebaseAnalytics.logEvent({
          name: 'list_created',
          params: { method },
        });
      } catch (e) {
        console.warn('[Analytics] Failed to log list_created:', e);
      }
    } else {
      trackEvent("list_created", "engagement", method);
    }
  },

  // Track when an item is created
  itemCreated: async (method: 'manual' | 'ai' | 'dictation' | 'bulk' = 'manual') => {
    if (isNative && FirebaseAnalytics) {
      try {
        await FirebaseAnalytics.logEvent({
          name: 'item_created',
          params: { method },
        });
      } catch (e) {
        console.warn('[Analytics] Failed to log item_created:', e);
      }
    } else {
      trackEvent("item_created", "engagement", method);
    }
  },

  // Track when an item is completed
  itemCompleted: async () => {
    if (isNative && FirebaseAnalytics) {
      try {
        await FirebaseAnalytics.logEvent({
          name: 'item_completed',
        });
      } catch (e) {
        console.warn('[Analytics] Failed to log item_completed:', e);
      }
    } else {
      trackEvent("item_completed", "engagement");
    }
  },

  // Track when a list is shared
  listShared: async (method: 'native_share' | 'copy_link' = 'native_share') => {
    if (isNative && FirebaseAnalytics) {
      try {
        await FirebaseAnalytics.logEvent({
          name: 'list_shared',
          params: { method },
        });
      } catch (e) {
        console.warn('[Analytics] Failed to log list_shared:', e);
      }
    } else {
      trackEvent("list_shared", "engagement", method);
    }
  },

  // Track screen/page view
  screenView: async (screenName: string) => {
    if (isNative && FirebaseAnalytics) {
      try {
        await FirebaseAnalytics.setCurrentScreen({ screenName });
      } catch (e) {
        console.warn('[Analytics] Failed to set screen:', e);
      }
    } else {
      trackPageView(screenName);
    }
  },

  // Legacy alias for backwards compatibility
  taskCompleted: async (listId?: string) => {
    await analytics.itemCompleted();
  },

  pageVisit: (page: string) => {
    trackPageView(page);
  },
};
