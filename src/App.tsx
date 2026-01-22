import { useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import HomePage from './mobile/pages/Home';
import ListPage from './mobile/pages/List';
import { SwipeBackLayout } from './mobile/components/SwipeBackLayout';
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

export default function App() {
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

  // Handle deep links (listo://listId or https://listo.to/listId)
  useEffect(() => {
    // Handle app opened via deep link (while app is running)
    CapacitorApp.addListener('appUrlOpen', (event) => {
      const url = event.url;

      // Handle listo://listId custom scheme
      if (url.startsWith('listo://')) {
        const listId = url.replace('listo://', '').replace(/^\/+/, '');
        if (listId) {
          navigate(`/${listId}`);
        }
      }

      // Handle https://listo.to/listId universal links
      if (url.includes('listo.to/')) {
        const match = url.match(/listo\.to\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          navigate(`/${match[1]}`);
        }
      }
    });

    // Check if app was launched with a URL (cold start) - only handle once
    if (!hasHandledLaunchUrl.current) {
      hasHandledLaunchUrl.current = true;

      CapacitorApp.getLaunchUrl().then((result) => {
        if (result?.url) {
          const url = result.url;

          if (url.startsWith('listo://')) {
            const listId = url.replace('listo://', '').replace(/^\/+/, '');
            if (listId) {
              navigate(`/${listId}`);
            }
          }

          if (url.includes('listo.to/')) {
            const match = url.match(/listo\.to\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
              navigate(`/${match[1]}`);
            }
          }
        }
      });
    }

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [navigate]);

  return (
    <SwipeBackLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:listId" element={<ListPage />} />
      </Routes>
    </SwipeBackLayout>
  );
}
