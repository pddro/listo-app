'use client';

import { useEffect, useState } from 'react';
import { useLocale, useMessages } from 'next-intl';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider as ReactI18nextProvider } from 'react-i18next';

// Initialize i18next for shared components that use react-i18next
// This bridges next-intl (used by web) with react-i18next (used by shared components)

let initialized = false;

export function I18nextBridge({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const messages = useMessages();
  const [ready, setReady] = useState(initialized);

  useEffect(() => {
    if (!initialized) {
      i18n
        .use(initReactI18next)
        .init({
          resources: {
            [locale]: { translation: messages },
          },
          lng: locale,
          fallbackLng: 'en',
          interpolation: {
            escapeValue: false,
          },
          react: {
            useSuspense: false,
          },
        })
        .then(() => {
          initialized = true;
          setReady(true);
        });
    } else {
      // Update language and resources if already initialized
      if (i18n.language !== locale) {
        i18n.addResourceBundle(locale, 'translation', messages, true, true);
        i18n.changeLanguage(locale);
      }
    }
  }, [locale, messages]);

  if (!ready) {
    return <>{children}</>;
  }

  return (
    <ReactI18nextProvider i18n={i18n}>
      {children}
    </ReactI18nextProvider>
  );
}
