import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { Preferences } from '@capacitor/preferences';

// Import all translation files
import en from '../../../messages/en.json';
import es from '../../../messages/es.json';
import fr from '../../../messages/fr.json';
import de from '../../../messages/de.json';
import pt from '../../../messages/pt.json';
import ja from '../../../messages/ja.json';
import zhHans from '../../../messages/zh-Hans.json';
import zhHant from '../../../messages/zh-Hant.json';
import ko from '../../../messages/ko.json';

// Supported locales (must match web config)
export const locales = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh-Hans', 'zh-Hant', 'ko'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

// Language names for UI display
export const localeNames: Record<Locale, { name: string; nativeName: string; flag: string }> = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  'zh-Hans': { name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  'zh-Hant': { name: 'Chinese (Traditional)', nativeName: '繁體中文', flag: '🇹🇼' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
};

// Resources object for i18next
const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  ja: { translation: ja },
  'zh-Hans': { translation: zhHans },
  'zh-Hant': { translation: zhHant },
  ko: { translation: ko },
};

// Custom language detector that uses Capacitor Preferences
const capacitorLanguageDetector = {
  name: 'capacitorPreferences',
  async: true,
  detect: async (callback: (lng: string) => void) => {
    try {
      const { value } = await Preferences.get({ key: 'listo_language' });
      if (value && locales.includes(value as Locale)) {
        callback(value);
        return;
      }
    } catch {
      // Preferences not available, fall through to browser detection
    }
    // Return undefined to let the next detector handle it
    callback('');
  },
  cacheUserLanguage: async (lng: string) => {
    try {
      await Preferences.set({ key: 'listo_language', value: lng });
    } catch {
      // Preferences not available
    }
  },
};

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: defaultLocale,
    supportedLngs: locales as unknown as string[],

    // Language detection options
    detection: {
      // Order of detection: stored preference > navigator > html lang
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'listo_language',
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    // Return key if translation is missing (for debugging)
    returnEmptyString: false,

    react: {
      useSuspense: false, // Disable suspense for mobile
    },
  });

// Function to change language and persist
export async function setLanguage(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale);
  try {
    await Preferences.set({ key: 'listo_language', value: locale });
  } catch {
    // Fallback to localStorage if Preferences not available
    localStorage.setItem('listo_language', locale);
  }
}

// Function to get current language
export function getCurrentLanguage(): Locale {
  const lang = i18n.language;
  // Handle partial matches (e.g., 'en-US' -> 'en')
  if (locales.includes(lang as Locale)) {
    return lang as Locale;
  }
  const baseLang = lang.split('-')[0];
  if (locales.includes(baseLang as Locale)) {
    return baseLang as Locale;
  }
  return defaultLocale;
}

export default i18n;
