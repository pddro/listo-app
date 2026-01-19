import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import HomePage from './mobile/pages/Home';
import ListPage from './mobile/pages/List';
import { SwipeBackLayout } from './mobile/components/SwipeBackLayout';

export default function App() {
  const navigate = useNavigate();

  // Handle deep links (listo://listId or https://listo.to/listId)
  useEffect(() => {
    // Handle app opened via deep link
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

    // Check if app was launched with a URL (cold start)
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
