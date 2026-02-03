import { useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import HomePage from './mobile/pages/Home';
import ListPage from './mobile/pages/List';
import TemplatesPage from './mobile/pages/Templates';
import TemplateDetailPage from './mobile/pages/TemplateDetail';
import { SwipeBackLayout } from './mobile/components/SwipeBackLayout';
import { AppStateProvider } from './mobile/context/AppStateContext';
import { ThemeColors } from '@/lib/gemini';

// Initialize i18n for mobile
import './mobile/i18n';

// Apply theme to CSS variables
function applyThemeToRoot(theme: ThemeColors | null) {
  const root = document.documentElement;
  if (theme) {
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-dark', theme.primaryDark);
    root.style.setProperty('--primary-light', theme.primaryLight);
    root.style.setProperty('--primary-pale', theme.primaryPale);
    root.style.setProperty('--primary-glow', theme.primaryGlow);
    root.style.setProperty('--text-primary', theme.textPrimary);
    root.style.setProperty('--text-secondary', theme.textSecondary);
    root.style.setProperty('--text-muted', theme.textMuted);
    root.style.setProperty('--text-placeholder', theme.textPlaceholder);
    root.style.setProperty('--bg-primary', theme.bgPrimary);
    root.style.setProperty('--bg-secondary', theme.bgSecondary);
    root.style.setProperty('--bg-hover', theme.bgHover);
    root.style.setProperty('--border-light', theme.borderLight);
    root.style.setProperty('--border-medium', theme.borderMedium);
    root.style.setProperty('--error', theme.error);
  }
}

function AppContent() {
  const navigate = useNavigate();
  const hasHandledLaunchUrl = useRef(false);

  // Apply stored home theme early before routes render
  useEffect(() => {
    const applyStoredTheme = async () => {
      const { value } = await Preferences.get({ key: 'listo_home_theme' });
      if (value) {
        const { theme } = JSON.parse(value);
        if (theme) applyThemeToRoot(theme);
      }
    };
    applyStoredTheme();
  }, []);

  // Handle deep links - supports both old (listo://, listo.to) and new (listmango://, listmango.com)
  useEffect(() => {
    // Helper to extract listId from URL
    const extractListId = (url: string): string | null => {
      // Handle listmango:// or listo:// custom schemes
      if (url.startsWith('listmango://') || url.startsWith('listo://')) {
        const listId = url.replace(/^(listmango|listo):\/\//, '').replace(/^\/+/, '');
        return listId || null;
      }

      // Handle https://listmango.com/listId or https://listo.to/listId universal links
      if (url.includes('listmango.com/') || url.includes('listo.to/')) {
        const match = url.match(/(listmango\.com|listo\.to)\/([a-zA-Z0-9_-]+)/);
        if (match && match[2]) {
          return match[2];
        }
      }

      return null;
    };

    // Handle app opened via deep link (while app is running)
    CapacitorApp.addListener('appUrlOpen', (event) => {
      const listId = extractListId(event.url);
      if (listId) {
        navigate(`/${listId}`);
      }
    });

    // Check if app was launched with a URL (cold start) - only handle once
    if (!hasHandledLaunchUrl.current) {
      hasHandledLaunchUrl.current = true;

      CapacitorApp.getLaunchUrl().then((result) => {
        if (result?.url) {
          const listId = extractListId(result.url);
          if (listId) {
            navigate(`/${listId}`);
          }
        }
      });
    }

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [navigate]);

  return (
    <>
      {/* Persistent background layer - prevents white flash during navigation */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--bg-primary, #ffffff)',
          zIndex: -1,
          transition: 'background-color 150ms ease-out',
        }}
      />
      <SwipeBackLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/templates/:templateId" element={<TemplateDetailPage />} />
          <Route path="/:listId" element={<ListPage />} />
        </Routes>
      </SwipeBackLayout>
    </>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}
