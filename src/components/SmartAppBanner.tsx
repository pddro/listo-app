'use client';

import { useState, useEffect } from 'react';

interface SmartAppBannerProps {
  listId: string;
  listTitle: string | null;
}

export function SmartAppBanner({ listId, listTitle }: SmartAppBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS Safari (not in standalone/PWA mode)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    // Don't show if already in app or if user dismissed it this session
    const wasDismissed = sessionStorage.getItem('listo_app_banner_dismissed');

    if (isIOSDevice && !isStandalone && !wasDismissed) {
      setIsIOS(true);
      // Delay showing banner slightly
      const timeout = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleOpenInApp = () => {
    // Try to open the app using custom URL scheme
    const appUrl = `listo://${listId}`;
    const startTime = Date.now();

    // Create a hidden iframe to try opening the app
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = appUrl;
    document.body.appendChild(iframe);

    // Check if app opened (page will be hidden if it did)
    setTimeout(() => {
      document.body.removeChild(iframe);

      // If less than 1.5s passed and page is still visible, app probably isn't installed
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500 && !document.hidden) {
        // App not installed - could redirect to App Store when published
        // For now, just dismiss the banner
        handleDismiss();
      }
    }, 1000);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('listo_app_banner_dismissed', 'true');
  };

  if (!isIOS || !isVisible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.85))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center gap-3 p-3">
        {/* App icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
          }}
        >
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm">Listo</div>
          <div className="text-gray-400 text-xs truncate">
            {listTitle ? `Open "${listTitle}" in the app` : 'Open this list in the Listo app'}
          </div>
        </div>

        {/* Open button */}
        <button
          onClick={handleOpenInApp}
          className="px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'white',
          }}
        >
          OPEN
        </button>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="p-1 flex-shrink-0"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
