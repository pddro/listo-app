declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

export const GA_MEASUREMENT_ID = "G-3N0JE969VW";

// Track custom events
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

// Specific event helpers
export const analytics = {
  // Track when an item is created
  itemCreated: (listId: string) => {
    trackEvent("item_created", "engagement", listId);
  },

  // Track when a list is created
  listCreated: (listId: string) => {
    trackEvent("list_created", "engagement", listId);
  },

  // Track when a task is completed
  taskCompleted: (listId: string) => {
    trackEvent("task_completed", "engagement", listId);
  },

  // Track page visit
  pageVisit: (page: string) => {
    trackPageView(page);
  },
};
