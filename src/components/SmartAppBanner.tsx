'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

const APP_STORE_URL = 'https://apps.apple.com/app/list-mango/id6758048013';

interface SmartAppBannerProps {
  listId: string;
  listTitle: string | null;
}

export function SmartAppBanner({ listId, listTitle }: SmartAppBannerProps) {
  const t = useTranslations('appBanner');
  const [isVisible, setIsVisible] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const isIOSDevice = /iphone|ipad|ipod/i.test(userAgent);
    const isAndroidDevice = /android/i.test(userAgent);

    // Check if in standalone/PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    // Check if actually running inside Capacitor native app
    const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const isCapacitorNative = capacitor?.isNativePlatform?.() === true;

    // Don't show if already in app or if user dismissed it
    const wasDismissed = sessionStorage.getItem('listo_app_banner_dismissed_v2');

    if ((isIOSDevice || isAndroidDevice) && !isStandalone && !isCapacitorNative && !wasDismissed) {
      setPlatform(isIOSDevice ? 'ios' : 'android');
      const timeout = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleOpenInApp = () => {
    if (platform === 'ios') {
      // Try custom URL scheme first, fall back to App Store
      const appUrl = `listmango://${listId}`;
      const start = Date.now();
      window.location.href = appUrl;

      // If still here after 1.5s, app isn't installed — go to App Store
      setTimeout(() => {
        if (Date.now() - start < 2000) {
          window.location.href = APP_STORE_URL;
        }
      }, 1500);
    } else {
      // Android: link to App Store for now (Play Store coming soon)
      // When Play Store is live, replace with Play Store URL + deep link fallback
      window.location.href = APP_STORE_URL;
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('listo_app_banner_dismissed_v2', 'true');
  };

  if (!platform || !isVisible) return null;

  return (
    <div
      className="w-full"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.95), rgba(0,0,0,0.9))',
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{
          padding: '12px 16px',
        }}
      >
        {/* App icon */}
        <img
          src="/app-icon.png"
          alt="List Mango"
          className="w-10 h-10 rounded-xl flex-shrink-0"
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm">{t('appName')}</div>
          <div className="text-gray-400 text-xs truncate">
            {t('continueInApp')}
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={handleOpenInApp}
          className="rounded-full text-sm font-semibold flex-shrink-0 active:opacity-70"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'white',
            padding: '6px 16px',
          }}
        >
          {platform === 'ios' ? t('open') : t('getApp')}
        </button>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="p-1 flex-shrink-0 active:opacity-50"
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
